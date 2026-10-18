from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import psycopg2

from benchmark import parse_sql_statements

SAMPLE_ROWS = 5


@dataclass
class CheckResult:
    query_name: str
    passed: bool
    message: str
    baseline_rows: int = 0
    optimized_rows: int = 0
    only_in_baseline: list[list[Any]] = field(default_factory=list)  # up to SAMPLE_ROWS each
    only_in_optimized: list[list[Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _query(path: Path) -> tuple[list[str], str]:
    setup, query = parse_sql_statements(path.read_text(encoding="utf-8"))
    if not query:
        raise ValueError(f"No executable query found in {path}")
    return setup, query


def _columns(cur, table: str) -> list[str]:
    cur.execute(f"SELECT * FROM {table} LIMIT 0")
    return [c.name for c in cur.description]


def _difference(cur, left: str, right: str) -> tuple[int, list[list[Any]]]:
    """Count the rows of `left` missing from `right` (as a multiset) and return a sample."""
    cur.execute(f"SELECT count(*) FROM (TABLE {left} EXCEPT ALL TABLE {right}) d")
    count = cur.fetchone()[0]
    cur.execute(f"TABLE {left} EXCEPT ALL TABLE {right} LIMIT {SAMPLE_ROWS}")
    return count, [list(r) for r in cur.fetchall()]


def check_equivalence(conn, q_dir: Path) -> CheckResult:
    """Check that `q_dir`'s optimized.sql returns the same result as its baseline.sql."""
    name = q_dir.name
    baseline_setup, baseline = _query(q_dir / "baseline.sql")
    optimized_setup, optimized = _query(q_dir / "optimized.sql")

    try:
        with conn.cursor() as cur:
            for stmt in baseline_setup:
                cur.execute(stmt)
            cur.execute(f"CREATE TEMP TABLE qpo_baseline AS {baseline}")
            baseline_rows = cur.rowcount

            for stmt in optimized_setup:
                cur.execute(stmt)
            cur.execute(f"CREATE TEMP TABLE qpo_optimized AS {optimized}")
            optimized_rows = cur.rowcount

            baseline_cols = _columns(cur, "qpo_baseline")
            optimized_cols = _columns(cur, "qpo_optimized")
            if baseline_cols != optimized_cols:
                return CheckResult(
                    name, False, f"Columns differ: baseline {baseline_cols}, optimized {optimized_cols}",
                    baseline_rows, optimized_rows,
                )  # fmt: skip

            missing, only_in_baseline = _difference(cur, "qpo_baseline", "qpo_optimized")
            extra, only_in_optimized = _difference(cur, "qpo_optimized", "qpo_baseline")
    except psycopg2.Error as e:
        return CheckResult(name, False, f"Query failed: {str(e).strip()}")
    finally:
        conn.rollback()

    if missing or extra:
        message = f"{missing} row(s) only in baseline, {extra} row(s) only in optimized"
        if "LIMIT" in baseline.upper():
            message += " (with LIMIT, ties in ORDER BY can pick different rows: add a tie-breaker)"
        return CheckResult(name, False, message, baseline_rows, optimized_rows, only_in_baseline, only_in_optimized)

    return CheckResult(name, True, f"Same {baseline_rows} row(s)", baseline_rows, optimized_rows)
