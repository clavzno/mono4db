"""Configuration settings and path helpers for the Dutch Railway ETL pipeline."""

import os
from pathlib import Path

CONTAINER_DATA_DIR = Path("/opt/airflow/data")  # where compose mounts dutch_railway/data
DATA_DIR = Path(os.environ.get("DUTCH_RAILWAY_DATA_DIR", CONTAINER_DATA_DIR))
RAW_DIR = DATA_DIR / "raw"
STAGING_DIR = DATA_DIR / "staging"
WAREHOUSE_DIR = DATA_DIR / "warehouse"
DUMP_DIR = DATA_DIR / "dumps"
DUMP_PATH = DUMP_DIR / "dutch_railway_db.dump"

DB_URL = os.environ.get(
    "DUTCH_RAILWAY_DB_URL",
    "postgresql://dutch_railway_user:dutch_railway_password@localhost:5433/dutch_railway_db",
)

SOURCE_URL_TEMPLATE = "https://blobs.duckdb.org/nl-railway/services-{year}.csv.gz"
DEFAULT_YEAR = 2025

SOURCE_TIMEZONE = "Europe/Amsterdam"
DUCKDB_MEMORY_LIMIT = os.environ.get("DUTCH_RAILWAY_DUCKDB_MEMORY_LIMIT", "2GB")
DUCKDB_THREADS = int(os.environ.get("DUTCH_RAILWAY_DUCKDB_THREADS", "4"))

SERVICES_COLUMNS: dict[str, str] = {
    "Service:RDT-ID": "BIGINT",
    "Service:Date": "DATE",
    "Service:Type": "VARCHAR",
    "Service:Company": "VARCHAR",
    "Service:Train number": "BIGINT",
    "Service:Completely cancelled": "BOOLEAN",
    "Service:Partly cancelled": "BOOLEAN",
    "Service:Maximum delay": "BIGINT",
    "Stop:RDT-ID": "BIGINT",
    "Stop:Station code": "VARCHAR",
    "Stop:Station name": "VARCHAR",
    "Stop:Arrival time": "TIMESTAMPTZ",
    "Stop:Arrival delay": "BIGINT",
    "Stop:Arrival cancelled": "BOOLEAN",
    "Stop:Departure time": "TIMESTAMPTZ",
    "Stop:Departure delay": "BIGINT",
    "Stop:Departure cancelled": "BOOLEAN",
    "Stop:Platform change": "BOOLEAN",
    "Stop:Planned platform": "VARCHAR",
    "Stop:Actual platform": "VARCHAR",
}

TABLES = ["dim_date", "dim_time", "dim_station", "fact_service", "fact_stop"]

STATION_CODE_MERGES: dict[str, str] = {"BERHBT": "BERHBL"}
STATION_CODE_RENAMES: dict[tuple[str, str], str] = {("LAND", "Venezia Santa Lucia"): "VENEZ"}
TIME_OF_DAY: dict[str, tuple[int, int]] = {"morning": (5, 12), "afternoon": (12, 18), "night": (18, 5)}


def source_url(year: int) -> str:
    """Format remote download URL for a given dataset year.

    Args:
        year: Calendar year of the NS services dataset.

    Returns:
        str: Fully-qualified HTTP download URL.
    """
    return SOURCE_URL_TEMPLATE.format(year=year)


def raw_path(year: int) -> Path:
    """Return local filesystem path for the raw compressed services archive.

    Args:
        year: Calendar year of the NS services dataset.

    Returns:
        Path: Path to the destination `.csv.gz` file.
    """
    return RAW_DIR / f"services-{year}.csv.gz"


def staged_path(year: int) -> Path:
    """Return local filesystem path for the staged typed Parquet file.

    Args:
        year: Calendar year of the NS services dataset.

    Returns:
        Path: Path to the destination staged `.parquet` file.
    """
    return STAGING_DIR / f"services-{year}.parquet"


def warehouse_dir(year: int) -> Path:
    """Return directory path for transformed warehouse Parquet tables.

    Args:
        year: Calendar year of the NS services dataset.

    Returns:
        Path: Directory path containing the dimensional star schema tables.
    """
    return WAREHOUSE_DIR / str(year)
