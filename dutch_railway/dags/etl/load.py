"""Load stage for the Dutch Railway ETL pipeline.

Loads transformed dimensional and fact tables into PostgreSQL (dutch_railway_db)
using streaming COPY commands within an atomic transaction.
"""

import logging
import tempfile
from pathlib import Path

import psycopg2

import etl_config as config
from etl.extract import _connect, _sql_str

log = logging.getLogger(__name__)

SCHEMA_SQL = (
    Path(__file__).parent / "sql" / "schema.sql"
    if (Path(__file__).parent / "sql" / "schema.sql").exists()
    else Path(__file__).with_name("schema.sql")
)

_DIM_KEYS = {"dim_date": "date_key", "dim_time": "time_key", "dim_station": "station_code"}


def _columns(parquet: Path) -> list[str]:
    """Inspect and return column names from a Parquet file using DuckDB.

    Args:
        parquet: Path to the target Parquet file.

    Returns:
        list[str]: Column names in schema order.
    """
    con = _connect()
    try:
        return [r[0] for r in con.execute(f"DESCRIBE SELECT * FROM read_parquet({_sql_str(parquet)})").fetchall()]
    finally:
        con.close()


def _to_csv(parquet: Path, csv: Path) -> None:
    """Export Parquet table data to headerless CSV format for PostgreSQL COPY.

    Args:
        parquet: Source Parquet file path.
        csv: Destination CSV file path.
    """
    con = _connect()
    try:
        con.execute(f"COPY (FROM read_parquet({_sql_str(parquet)})) TO {_sql_str(csv)} (FORMAT csv, HEADER false)")
    finally:
        con.close()


def _copy(cur, table: str, columns: list[str], csv: Path) -> None:
    """Stream CSV rows into PostgreSQL table via COPY FROM STDIN.

    Args:
        cur: Active psycopg2 database cursor.
        table: Destination database table name.
        columns: Ordered list of column names matching CSV fields.
        csv: Path to the headerless CSV file to stream.
    """
    with open(csv, encoding="utf-8") as f:
        cur.copy_expert(f"COPY {table} ({', '.join(columns)}) FROM STDIN WITH (FORMAT csv)", f)


_FACTS = ("fact_service", "fact_stop")


def _fact_foreign_keys(cur) -> list[tuple[str, str, str]]:
    """Query foreign key constraints defined on fact tables from the catalog.

    Args:
        cur: Active psycopg2 database cursor.

    Returns:
        list[tuple[str, str, str]]: List of (table_name, constraint_name, definition).
    """
    cur.execute(
        """
        SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE contype = 'f' AND conrelid::regclass::text = ANY(%s)
        ORDER BY 1, 2
        """,
        (list(_FACTS),),
    )
    return cur.fetchall()


def _fact_secondary_indexes(cur) -> list[tuple[str, str]]:
    """Query non-constraint secondary indexes defined on fact tables.

    Args:
        cur: Active psycopg2 database cursor.

    Returns:
        list[tuple[str, str]]: List of (index_name, create_index_sql).
    """
    cur.execute(
        """
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = current_schema() AND tablename = ANY(%s)
          AND indexname NOT IN (SELECT conname FROM pg_constraint)
        ORDER BY 1
        """,
        (list(_FACTS),),
    )
    return cur.fetchall()


def load_warehouse(warehouse: Path, year: int, db_url: str = config.DB_URL) -> dict:
    """Load every table in `warehouse` into Postgres, replacing the facts of `year`.

    Args:
        warehouse: Directory with the transform's `<table>.parquet` files.
        year: Year of the facts in `warehouse`; its existing facts are replaced.
        db_url: libpq connection URL. Defaults to config.DB_URL.

    Returns:
        dict: Row counts per table in the database after the load.
    """
    year_range = (year * 10000 + 101, year * 10000 + 1231)

    with tempfile.TemporaryDirectory(dir=warehouse, prefix=".load-") as tmp:
        csvs = {}
        for table in config.TABLES:
            parquet = warehouse / f"{table}.parquet"
            csvs[table] = (Path(tmp) / f"{table}.csv", _columns(parquet))
            _to_csv(parquet, csvs[table][0])

        conn = psycopg2.connect(db_url)
        try:
            with conn, conn.cursor() as cur:  
                cur.execute(SCHEMA_SQL.read_text())

                for table, key in _DIM_KEYS.items():
                    csv, cols = csvs[table]
                    cur.execute(f"CREATE TEMP TABLE {table}_in (LIKE {table}) ON COMMIT DROP")
                    _copy(cur, f"{table}_in", cols, csv)
                    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != key)
                    cur.execute(
                        f"INSERT INTO {table} ({', '.join(cols)}) SELECT {', '.join(cols)} FROM {table}_in "
                        f"ON CONFLICT ({key}) DO UPDATE SET {updates}"
                    )
                    log.info("Upserted %s: %d rows", table, cur.rowcount)

                fks = _fact_foreign_keys(cur)
                for table, name, _ in fks:
                    cur.execute(f"ALTER TABLE {table} DROP CONSTRAINT {name}")

                cur.execute(
                    "DELETE FROM fact_stop WHERE rdt_id IN "
                    "(SELECT rdt_id FROM fact_service WHERE date_key BETWEEN %s AND %s)",
                    year_range,
                )
                log.info("Deleted %d existing fact_stop rows for %d", cur.rowcount, year)
                cur.execute("DELETE FROM fact_service WHERE date_key BETWEEN %s AND %s", year_range)
                log.info("Deleted %d existing fact_service rows for %d", cur.rowcount, year)

                indexes = _fact_secondary_indexes(cur)
                for name, _ in indexes:
                    cur.execute(f"DROP INDEX {name}")

                for table in ("fact_service", "fact_stop"):
                    csv, cols = csvs[table]
                    _copy(cur, table, cols, csv)
                    log.info("Copied %s: %d rows", table, cur.rowcount)

                for _, definition in indexes:
                    cur.execute(definition)
                for table, name, definition in fks:
                    cur.execute(f"ALTER TABLE {table} ADD CONSTRAINT {name} {definition}")
                log.info("Rebuilt %d indexes and %d foreign keys", len(indexes), len(fks))

                counts = {}
                for table in config.TABLES:
                    cur.execute(f"SELECT count(*) FROM {table}")
                    counts[table] = cur.fetchone()[0]
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("ANALYZE")  
        finally:
            conn.close()

    log.info("Database counts: %s", counts)
    return counts
