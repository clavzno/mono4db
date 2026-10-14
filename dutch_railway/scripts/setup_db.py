"""Set up dutch_railway_db from a dump made by the ETL's dump step (no ETL run needed).

Restores the warehouse tables into the Postgres container, replacing any that
already exist. Works on Linux, macOS and Windows; only needs Docker and Python.

Usage (from anywhere in the repo):
    python dutch_railway/scripts/setup_db.py                    # data/dumps/dutch_railway_db.dump
    python dutch_railway/scripts/setup_db.py path/to/file.dump  # a dump you were sent
    python dutch_railway/scripts/setup_db.py --yes              # skip the overwrite prompt
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path, PurePosixPath

PROJECT = Path(__file__).resolve().parents[1]
COMPOSE_FILE = PROJECT.parent / "compose.yaml"  

os.environ.setdefault("DUTCH_RAILWAY_DATA_DIR", str(PROJECT / "data"))
sys.path.insert(0, str(PROJECT / "config"))
import etl_config as config


def compose(*args: str, **kwargs) -> subprocess.CompletedProcess:
    """Run `docker compose` against the monorepo's root compose file."""
    return subprocess.run(["docker", "compose", "-f", str(COMPOSE_FILE), *args], **kwargs)


def in_airflow_image(script: str, *args: str, **kwargs) -> subprocess.CompletedProcess:
    """Run a bash script in a throwaway container of the Airflow image.

    The image ships the same pg_dump/pg_restore version the dump was made with, and
    has DUTCH_RAILWAY_DB_URL set; `--no-deps` keeps the rest of Airflow stopped.
    """
    kwargs.setdefault("stdin", subprocess.DEVNULL)  # else `compose run` swallows our own stdin
    return compose(
        "run", "--rm", "--no-deps", "-T", "--entrypoint", "bash", "airflow-worker",
        "-c", script, "_", *args,
        **kwargs,
    )  


def existing_tables() -> list[str]:
    """Return which warehouse tables already exist in dutch_railway_db."""
    names = ",".join(config.TABLES)
    result = in_airflow_image(
        'psql "$DUTCH_RAILWAY_DB_URL" -tAc "SELECT tablename FROM pg_tables '
        f"WHERE schemaname = current_schema() AND tablename = ANY('{{{names}}}')\"",
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.split()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dump", nargs="?", type=Path, default=config.DUMP_PATH, help="pg_dump custom-format file")
    parser.add_argument("-y", "--yes", action="store_true", help="replace existing tables without asking")
    args = parser.parse_args()

    dump = args.dump.resolve()
    if not dump.is_file():
        print(f"Dump not found: {dump}", file=sys.stderr)
        print("Run the ETL (it writes one), or ask a teammate for dutch_railway_db.dump.", file=sys.stderr)
        return 1

    print("Starting dutch_railway_db ...", flush=True)
    compose("up", "-d", "--wait", "dutch_railway_db", check=True)

    existing = existing_tables()
    if existing and not args.yes:
        print(f"dutch_railway_db already has: {', '.join(existing)}")
        if input("Replace them with the dump? [y/N] ").strip().lower() != "y":
            print("Aborted, nothing changed.")
            return 1

    restore = (
        'pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error '
        '--dbname "$DUTCH_RAILWAY_DB_URL" ${1:+"$1"} '
        '&& psql "$DUTCH_RAILWAY_DB_URL" -qc ANALYZE'
    )
    print(f"Restoring {dump} (a few minutes for a full year) ...", flush=True)
    if dump.is_relative_to(config.DATA_DIR):
        container_path = PurePosixPath(config.CONTAINER_DATA_DIR, *dump.relative_to(config.DATA_DIR).parts)
        result = in_airflow_image(restore, str(container_path))
    else:
        with open(dump, "rb") as f:
            result = in_airflow_image(restore, stdin=f)
    if result.returncode != 0:
        print("Restore failed; the database was left as it was.", file=sys.stderr)
        return result.returncode

    counts = " UNION ALL ".join(f"SELECT '{t}', count(*) FROM {t}" for t in config.TABLES)
    in_airflow_image(f'psql "$DUTCH_RAILWAY_DB_URL" -c "{counts}"', check=True)
    print("Done. Connect at localhost:5433 (see dutch_railway/README.md).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
