"""Transform stage for the Dutch Railway ETL pipeline.

Transforms staged services Parquet data into a star schema comprising
dimensional tables (dim_date, dim_time, dim_station) and fact tables
(fact_service, fact_stop).

Schema questions raised against the EDA notebook, and the answers agreed on before implementing:

Q1. FACT_STOP has one `next_day` flag, but stop days relative to Service:Date are 0 (~17M),
    +1 (~818k), -1 (13), +2/+3/+6 (a handful) and +92/+107 (11 stops, likely bad data), and
    11,503 stops arrive on day 0 but depart on day +1. How should this be stored?
A1. Two int offsets: arrival_day_offset and departure_day_offset (days after service_date).
    No next_day flag.

Q2. Stop cancel_status (completely / departure-only / arrival-only / none): the origin has no
    arrival and the terminus no departure (NULL). How are a cancelled origin (116k stops) and a
    cancelled terminus (119k stops) classified?
A2. As 'completely': a missing side counts as cancelled when the other side is, the same as
    the EDA's "stop cancelled" rule, coalesce(a, true) AND coalesce(d, true).

Q3. Cancelled stops always have delay 0, and some services never report a delay. Store those
    delays as NULL?
A3. NULL for cancelled arrivals/departures only. Everything else is kept as is.

Q4. Service:Company changes format on 14 Dec (DB -> 'Deutsche B', numeric codes, suffixed
    names). Normalize it?
A4. Keep it raw. A mapping can be a later step.
"""
import logging
import os
from pathlib import Path

from etl import config
from etl.extract import _connect, _sql_str

log = logging.getLogger(__name__)

TABLES = ["dim_date", "dim_time", "dim_station", "fact_service", "fact_stop"]


def _station_code_sql() -> str:
    """Generate SQL CASE expression applying station code renames and merges.

    Returns:
        str: DuckDB SQL CASE expression returning the canonical station code.
    """
    whens = [
        f'WHEN "Stop:Station code" = {_sql_str(code)} AND "Stop:Station name" = {_sql_str(name)} THEN {_sql_str(new)}'
        for (code, name), new in config.STATION_CODE_RENAMES.items()
    ] + [
        f'WHEN "Stop:Station code" = {_sql_str(old)} THEN {_sql_str(new)}'
        for old, new in config.STATION_CODE_MERGES.items()
    ]
    return f'CASE {" ".join(whens)} ELSE "Stop:Station code" END'


def _time_of_day_sql(hour: str) -> str:
    """Generate SQL CASE expression categorizing an hour into a time-of-day bucket.

    Args:
        hour: SQL expression or column name representing the hour integer (0-23).

    Returns:
        str: DuckDB SQL CASE expression returning the time-of-day bucket label.
    """
    whens = []
    for label, (start, end) in config.TIME_OF_DAY.items():
        cond = f"{hour} >= {start} AND {hour} < {end}" if start < end else f"({hour} >= {start} OR {hour} < {end})"
        whens.append(f"WHEN {cond} THEN {_sql_str(label)}")
    return f"CASE {' '.join(whens)} END"


def _time_key(ts: str) -> str:
    """Generate SQL expression converting a timestamp column into an HHMM integer key.

    Args:
        ts: SQL expression or column name representing a timestamp.

    Returns:
        str: DuckDB SQL expression yielding an HHMM SMALLINT key, or NULL if ts is NULL.
    """
    return f"(hour({ts}) * 100 + minute({ts}))::SMALLINT"


def _date_key(d: str) -> str:
    """Generate SQL expression converting a date column into a YYYYMMDD integer key.

    Args:
        d: SQL expression or column name representing a date.

    Returns:
        str: DuckDB SQL expression yielding a YYYYMMDD INTEGER key.
    """
    return f"strftime({d}, '%Y%m%d')::INTEGER"


_QUERIES: dict[str, str] = {
    "dim_date": f"""
        SELECT {_date_key("d")}  AS date_key,
               d::DATE           AS service_date,
               week(d)::SMALLINT AS week,     -- ISO week: 29-31 Dec 2025 are week 1
               month(d)::SMALLINT AS month,
               quarter(d)::SMALLINT AS quarter
        FROM range(
            (SELECT min("Service:Date") FROM stops),
            (SELECT max("Service:Date") FROM stops) + INTERVAL 1 DAY,
            INTERVAL 1 DAY
        ) t(d)
    """,
    "dim_time": f"""
        SELECT (h * 100 + m)::SMALLINT AS time_key,
               h::SMALLINT             AS hour,
               m::SMALLINT             AS minute,
               {_time_of_day_sql("h")} AS time_of_day
        FROM range(24) hs(h), range(60) ms(m)
    """,
    "dim_station": """
        SELECT station_code, any_value(station_name) AS station_name
        FROM stops GROUP BY station_code
    """,

    "fact_service": f"""
        SELECT "Service:RDT-ID"                         AS rdt_id,
               {_date_key('any_value("Service:Date")')} AS date_key,
               arg_min("Service:Train number", stop_order) AS first_train_number,
               arg_max("Service:Train number", stop_order) AS last_train_number,
               count(DISTINCT "Service:Train number") > 1  AS train_id_changed,
               CASE WHEN any_value("Service:Completely cancelled") THEN 'completely'
                    WHEN any_value("Service:Partly cancelled")     THEN 'partially'
                    ELSE 'none' END                     AS cancel_status,
               any_value("Service:Type")                AS service_type,
               any_value("Service:Company")             AS company_name
        FROM stops
        GROUP BY "Service:RDT-ID"
    """,

    "fact_stop": f"""
        SELECT "Stop:RDT-ID"                            AS stop_id,
               "Service:RDT-ID"                         AS rdt_id,
               {_time_key('"Stop:Arrival time"')}       AS arrival_time,
               {_time_key('"Stop:Departure time"')}     AS departure_time,
               station_code,
               "Service:Train number"                   AS train_id,
               date_diff('day', "Service:Date", "Stop:Arrival time"::DATE)::SMALLINT   AS arrival_day_offset,
               date_diff('day', "Service:Date", "Stop:Departure time"::DATE)::SMALLINT AS departure_day_offset,
               CASE WHEN coalesce("Stop:Arrival cancelled", true)
                     AND coalesce("Stop:Departure cancelled", true) THEN 'completely'
                    WHEN "Stop:Arrival cancelled"                   THEN 'arrival-only'
                    WHEN "Stop:Departure cancelled"                 THEN 'departure-only'
                    ELSE 'none' END                     AS cancel_status,
               CASE WHEN NOT "Stop:Arrival cancelled"   THEN "Stop:Arrival delay"   END::INTEGER AS arrival_delay,
               CASE WHEN NOT "Stop:Departure cancelled" THEN "Stop:Departure delay" END::INTEGER AS departure_delay
        FROM stops
    """,
}


def _validate(con, out: Path) -> dict:
    """Validate transformed tables against data integrity and foreign key constraints.

    Args:
        con: Active DuckDB database connection containing staged views.
        out: Path to the directory containing transformed Parquet files.

    Returns:
        dict: Table row counts if all validation checks succeed.

    Raises:
        ValueError: If any integrity constraint or foreign key check fails.
    """
    for t in TABLES:
        con.execute(f"CREATE OR REPLACE VIEW {t} AS FROM read_parquet({_sql_str(out / f'{t}.parquet')})")
    counts = {t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in TABLES}

    checks = {
        "fact_stop rows != staged rows": f"SELECT {counts['fact_stop']} <> (SELECT count(*) FROM stops)",
        "dim_station: code with several names": """
            SELECT count(*) > 0 FROM (SELECT station_code FROM stops GROUP BY 1 HAVING count(DISTINCT station_name) > 1)
        """,
        "fact_service: date_key not in dim_date": """
            SELECT count(*) > 0 FROM fact_service s ANTI JOIN dim_date d USING (date_key)
        """,
        "fact_stop: rdt_id not in fact_service": """
            SELECT count(*) > 0 FROM fact_stop f ANTI JOIN fact_service s USING (rdt_id)
        """,
        "fact_stop: station_code not in dim_station": """
            SELECT count(*) > 0 FROM fact_stop f ANTI JOIN dim_station s USING (station_code)
        """,
        "fact_stop: arrival/departure_time not in dim_time": """
            SELECT count(*) > 0 FROM fact_stop
            WHERE (arrival_time IS NOT NULL AND arrival_time NOT IN (SELECT time_key FROM dim_time))
               OR (departure_time IS NOT NULL AND departure_time NOT IN (SELECT time_key FROM dim_time))
        """,
        "dim_time: hour without time_of_day": "SELECT count(*) > 0 FROM dim_time WHERE time_of_day IS NULL",
    }
    problems = [name for name, sql in checks.items() if con.execute(sql).fetchone()[0]]
    if problems:
        raise ValueError(f"Transform failed checks: {'; '.join(problems)}. Counts: {counts}")
    return counts


def run_transform(staged: Path, out: Path) -> dict:
    """Build every table from the staged Parquet into `out/<table>.parquet`.

    Each file is written to a `.part` first and renamed, so a failed run never leaves a
    half-written table next to good ones.

    Args:
        staged: Staged services Parquet from the extract.
        out: Warehouse directory for this year (config.warehouse_dir).

    Returns:
        dict: The output directory and the row count of each table.
    """
    out.mkdir(parents=True, exist_ok=True)
    con = _connect()
    try:
        con.execute(
            f"""
            CREATE VIEW stops AS
            SELECT *,
                   {_station_code_sql()} AS station_code,
                   "Stop:Station name" AS station_name,
                   (coalesce("Stop:Arrival time", "Stop:Departure time"), "Stop:RDT-ID") AS stop_order
            FROM read_parquet({_sql_str(staged)})
            """
        )
        for table in TABLES:
            dest = out / f"{table}.parquet"
            part = dest.with_name(dest.name + ".part")
            con.execute(f"COPY ({_QUERIES[table]}) TO {_sql_str(part)} (FORMAT parquet, COMPRESSION zstd)")
            os.replace(part, dest)
            log.info("Wrote %s (%.1f MB)", dest, dest.stat().st_size / 1e6)
        counts = _validate(con, out)
    finally:
        con.close()

    log.info("Transform counts: %s", counts)
    return {"warehouse_dir": str(out), **counts}
