"""
Main entry point for query benchmarking (ported from query_processing/src/main.py).
Expects baseline.sql and optimized.sql in each query directory.

# How To
Create a directory in `qpo/queries/`. Then create two sql files in that
directory.

- `baseline.sql`:   contains the unoptimized query ONLY.
- `optimized.sql`:  contains schema optimizations (like CREATE INDEX) followed by
                    the optimized query. The last statement is the one benchmarked.

Unlike query_processing, the database is not restored before every query pair:
the warehouse is ~3 GB and a restore takes minutes. Instead each file runs in a
transaction that is rolled back afterwards, so the schema changes in optimized.sql
never persist and every query pair starts from the schema the ETL created.

The pseudocode of the pipeline is below:
1. Get the query_pairs from each directory in `qpo/queries/`.
2. For each (baseline, optimized) in query_pairs.
    1. Check that optimized returns the same result as baseline (see checker.py);
       if not, report the difference and skip the pair.
    2. Execute and time baseline, then roll back.
    3. Execute and time optimized (setup statements first), then roll back.

`--check-only` runs step 1 alone, e.g. to test queries before benchmarking them.
"""

import argparse
import json
import sys
from pathlib import Path

import psycopg2

from benchmark import benchmark_query_file, compute_metrics, extract_short_plan
from checker import CheckResult, check_equivalence

QPO_DIR = Path(__file__).resolve().parent
QUERIES_DIR = QPO_DIR / "queries"
RESULTS_DIR = QPO_DIR / "results"

sys.path.insert(0, str(QPO_DIR.parent / "config"))
import etl_config as config  


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Query Processing Performance Runner")
    parser.add_argument(
        "--query",
        type=str,
        default=None,
        help="Run only a specific query directory in queries/.",
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=3,
        help="Number of measured benchmark iterations.",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=1,
        help="Number of warmup iterations.",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Only check that each optimized query returns the same result as its baseline.",
    )
    return parser.parse_args()


def find_query_dirs(query: str | None) -> list[Path]:
    """Return the query directories to benchmark, warning about incomplete ones."""
    if query:
        target = QUERIES_DIR / query
        if not target.is_dir():
            sys.exit(f"Error: Query directory '{query}' not found in {QUERIES_DIR}")
        for name in ("baseline.sql", "optimized.sql"):
            if not (target / name).exists():
                sys.exit(f"Error: Query '{query}' is missing {name}")
        return [target]

    query_dirs = []
    for p in sorted(QUERIES_DIR.iterdir(), key=lambda p: p.name):
        if p.is_dir():
            has_baseline = (p / "baseline.sql").exists()
            has_optimized = (p / "optimized.sql").exists()
            if has_baseline and has_optimized:
                query_dirs.append(p)
            elif has_baseline:
                print(f"Warning: Skipping '{p.name}' (missing optimized.sql)")
            elif has_optimized:
                print(f"Warning: Skipping '{p.name}' (missing baseline.sql)")
    return query_dirs


def print_summary_table(all_metrics: list[dict]) -> None:
    print("\nQUERY PERFORMANCE BENCHMARK SUMMARY")
    header = (
        f"{'Query':<30} | "
        f"{'Base (ms)':<11} | "
        f"{'Opt (ms)':<11} | "
        f"{'Speedup':<9} | "
        f"{'Base Cost':<11} | "
        f"{'Opt Cost':<11} | "
        f"{'Reduction':<9}"
    )
    print(header)
    for m in all_metrics:
        row = (
            f"{m['query_name']:<30} | "
            f"{m['baseline_median_exec_ms']:<11.2f} | "
            f"{m['optimized_median_exec_ms']:<11.2f} | "
            f"{m['speedup_ratio']:<8.2f}x | "
            f"{m['baseline_estimated_cost']:<11.2f} | "
            f"{m['optimized_estimated_cost']:<11.2f} | "
            f"{m['exec_time_reduction_pct']:<8.1f}%"
        )
        print(row)


def print_check_failure(check: CheckResult) -> None:
    print(f"  FAILED: {check.message}")
    for label, rows in (("only in baseline", check.only_in_baseline), ("only in optimized", check.only_in_optimized)):
        for row in rows:
            print(f"    {label}: {tuple(row)}")


def main() -> int:
    args = parse_args()

    query_dirs = find_query_dirs(args.query)
    if not query_dirs:
        print(f"No complete queries (with both baseline.sql and optimized.sql) found in {QUERIES_DIR}.")
        return 1

    RESULTS_DIR.mkdir(exist_ok=True)
    if not args.query and not args.check_only:
        for stale in RESULTS_DIR.glob("*.json"):
            stale.unlink()

    print(f"Connecting to {config.DB_URL.rsplit('@', 1)[-1]}...")
    try:
        conn = psycopg2.connect(config.DB_URL)
    except psycopg2.OperationalError as e:
        print(f"Failed to connect: {e}".strip())
        print("Is the database up? (`docker compose up -d dutch_railway_db`)")
        return 1

    print(f"Queries to {'check' if args.check_only else 'benchmark'}: {[q.name for q in query_dirs]}")
    all_metrics = []
    failed = []

    try:
        for q_dir in query_dirs:
            print(f"\n  Processing Query: {q_dir.name}")

            print(" - [1 Check] Comparing the results of baseline.sql and optimized.sql...")
            check = check_equivalence(conn, q_dir)
            if not check.passed:
                print_check_failure(check)
                failed.append(q_dir.name)
                continue
            print(f"  OK: {check.message}")
            if args.check_only:
                continue

            print(f" - [2 Baseline] Running baseline.sql ({args.warmup} warmup, {args.iterations} iterations)...")
            base_runs, base_plan = benchmark_query_file(
                conn, q_dir / "baseline.sql", iterations=args.iterations, warmup=args.warmup
            )

            print(f" - [3 Optimized] Running optimized.sql ({args.warmup} warmup, {args.iterations} iterations)...")
            opt_runs, opt_plan = benchmark_query_file(
                conn, q_dir / "optimized.sql", iterations=args.iterations, warmup=args.warmup
            )

            metrics = compute_metrics(q_dir.name, base_runs, opt_runs)
            all_metrics.append(metrics.to_dict())

            result_payload_all = {
                "metrics": metrics.to_dict(),
                "check": check.to_dict(),
                "baseline_plan": base_plan,
                "optimized_plan": opt_plan,
            }
            result_all_file = RESULTS_DIR / f"{q_dir.name}_all.json"
            result_all_file.write_text(json.dumps(result_payload_all, indent=2), encoding="utf-8")

            result_payload_short = {
                "baseline": extract_short_plan(base_plan),
                "optimized": extract_short_plan(opt_plan),
            }
            result_short_file = RESULTS_DIR / f"{q_dir.name}_short.json"
            result_short_file.write_text(json.dumps(result_payload_short, indent=2), encoding="utf-8")

            print(
                f"  Result: {metrics.speedup_ratio}x speedup "
                f"({metrics.baseline_median_exec_ms:.2f}ms -> {metrics.optimized_median_exec_ms:.2f}ms, "
                f"{metrics.exec_time_reduction_pct:.1f}% reduction)"
            )
    except ValueError as e:
        print(f"Error: {e}")
        return 1
    finally:
        conn.close()

    if all_metrics:
        print_summary_table(all_metrics)
    if failed:
        print(f"\nFAILED (optimized result differs from baseline): {failed}")
        return 1
    if args.check_only:
        print(f"\nAll {len(query_dirs)} optimized queries return the same result as their baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())