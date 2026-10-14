# dutch_railway

# Installation for dutch_railway
1. `$env:AIRFLOW_UID = "50000"` if you don't have the env, skip if you do
2. `docker compose build airflow-init` or `docker compose build` nalang
3. `docker compose up -d` or `docker compose up`
4. Install parquet file from Google Drive, include in data/staging/services-2025.parquet