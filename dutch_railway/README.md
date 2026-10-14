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
