"""Shared settings for the dutch_railway ETL.

Kept free of Airflow imports so the notebooks can import the ETL code on the host.
"""

import os
from pathlib import Path

# Mounted from ./data in compose.yaml. DUTCH_RAILWAY_DATA_DIR overrides it for running outside Docker.
DATA_DIR = Path(os.environ.get("DUTCH_RAILWAY_DATA_DIR", "/opt/airflow/data"))
RAW_DIR = DATA_DIR / "raw"
STAGING_DIR = DATA_DIR / "staging"

SOURCE_URL_TEMPLATE = "https://blobs.duckdb.org/nl-railway/services-{year}.csv.gz"
DEFAULT_YEAR = 2025

# Source data is Dutch, so timestamps are interpreted in Europe/Amsterdam no matter where the
# worker runs (see the EDA notebook: a host on UTC+8 renders the same instant differently).
SOURCE_TIMEZONE = "Europe/Amsterdam"

# DuckDB limits for the extract. The streaming CSV -> Parquet copy peaked at ~0.5 GB RSS for 2025.
DUCKDB_MEMORY_LIMIT = os.environ.get("DUTCH_RAILWAY_DUCKDB_MEMORY_LIMIT", "2GB")
DUCKDB_THREADS = int(os.environ.get("DUTCH_RAILWAY_DUCKDB_THREADS", "4"))

# Exact header of the yearly files, in order, with the types we read them as.
# The DuckDB docs list 17 columns. The 2025 file has 20 (it adds the three platform columns).
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
    # Platforms look numeric ("1", "2") but include values like "4b" and "1/2", so they stay text.
    "Stop:Planned platform": "VARCHAR",
    "Stop:Actual platform": "VARCHAR",
}


def source_url(year: int) -> str:
    return SOURCE_URL_TEMPLATE.format(year=year)


def raw_path(year: int) -> Path:
    return RAW_DIR / f"services-{year}.csv.gz"


def staged_path(year: int) -> Path:
    return STAGING_DIR / f"services-{year}.parquet"
