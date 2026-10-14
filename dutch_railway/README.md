# dutch_railway

Dutch Railway OLAP project.

## Quickstart

**Requirements.** You need Docker (Docker Desktop on Windows/macOS) and, for the notebook and the setup
script, Python 3.11+.

Run every command from this folder (`dutch_railway/`). It has its own
`compose.yaml`, separate from the other projects in the repo.

### Starting Things Up with Docker

Get the `.env` file from our Discord server (it is in `#environment-variables` channel) and save it as `dutch_railway/.env`, then:

```sh
docker compose up -d
```

### Getting the Database

There are two ways to get the dutchrailway database.

#### Via ETL Script

In the Airflow UI, open **dutch_railway_etl**, unpause it with the toggle, then click
**Trigger** (the `year` parameter defaults to 2025).

The DAG runs the ETL and the dump and its output goes to `data/`

- `raw/`, `staging/`, `warehouse/`: the intermediate files.
- `dumps/dutch_railway_db.dump`

### Via a Dump

The dump is a result of the ETL script:

```sh
python scripts/setup_db.py
```

The dump may be downloaded at this [Release](https://github.com/zrygan/mono4db/releases/tag/dutch-railway-db-2025).

## Query Optimization

**Note.** The query processing optimization is (for the most part) adapted from the [query processing project](/query_processing/).

---

Each query lives in its own folder in `qpo/queries/` with two files:

- `baseline.sql`: the unoptimized query only.
- `optimized.sql`: any schema changes (e.g. `CREATE INDEX`), then the optimized query. The last
  statement is the one that is benchmarked.

With the database up, run all queries or just one:

```sh
docker compose run --rm qpo
docker compose run --rm qpo --query example --iterations 5 --warmup 2
docker compose run --rm qpo --check-only
```

This tool performs two things: (1) it **times** each query to get a numerical value for the performance difference; (2) it checks the **correctness** of the optimized query assuming the baseline query as the gold standard or trusted reference.

Notes for correctness checking. With `LIMIT`, give `ORDER BY` a tie-breaker (e.g. `ORDER BY avg_delay DESC, station_name`), so that this will always give the same row.

Results go to `qpo/results/` (`<query>_all.json` with the full plans, `<query>_short.json` for a shorter version of the plan).
Each file runs in a transaction that is rolled back, so the schema changes never stay in the database.
