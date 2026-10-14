"""Dump stage for the Dutch Railway ETL pipeline.

Snapshots the warehouse tables in PostgreSQL (dutch_railway_db) into a pg_dump
custom-format archive, so others can restore the database with
scripts/setup_db.py instead of re-running the whole pipeline.
"""

import logging
import subprocess
from pathlib import Path

import etl_config as config

log = logging.getLogger(__name__)


def dump_database(dump: Path = config.DUMP_PATH, db_url: str = config.DB_URL) -> dict:
    """Write the warehouse tables to `dump`, replacing any previous dump atomically.

    Args:
        dump: Destination `.dump` file (pg_dump custom format).
        db_url: libpq connection URL. Defaults to config.DB_URL.

    Returns:
        dict: The dump path and its size in bytes.
    """
    dump.parent.mkdir(parents=True, exist_ok=True)
    tmp = dump.with_name(f".{dump.name}.tmp")
    cmd = [
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        f"--file={tmp}",
        *(f"--table={table}" for table in config.TABLES),
        f"--dbname={db_url}",
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"pg_dump failed: {e.stderr.strip()}") from e
    tmp.replace(dump)

    size = dump.stat().st_size
    log.info("Dumped %s to %s (%.1f MB)", ", ".join(config.TABLES), dump, size / 1e6)
    return {"dump": str(dump), "bytes": size}
