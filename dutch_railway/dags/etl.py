"""Airflow DAG: Dutch railway services (yearly file) -> dutch_railway_db.

Only wiring lives here. The logic is in dags/etl/ so it can be imported without Airflow.
Trigger from the UI (optionally set the `year` param); it is not scheduled because the
yearly file is published once.


This is the orchestration script.

So, this wires the steps together. This means: Extract -> Transform -> Load,
and the substeps inbetween them.
"""

from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path

from airflow.sdk import Param, dag, task, task_group

from etl import config, extract, load, transform


@dag(
    dag_id="dutch_railway_etl",
    description="Extract the NS services yearly file, then transform and load (TODO)",
    schedule=None,
    start_date=datetime(2025, 1, 1),
    catchup=False,
    params={"year": Param(config.DEFAULT_YEAR, type="integer", minimum=2019)},
    default_args={"retries": 2, "retry_delay": timedelta(minutes=2)},
    tags=["dutch_railway", "etl"],
)
def dutch_railway_etl():
    @task_group(group_id="extract")
    def extract_group():
        @task
        def fetch_remote_metadata(params=None) -> dict:
            remote = extract.fetch_remote_metadata(config.source_url(params["year"]))
            return asdict(remote)

        @task
        def download(remote: dict, params=None) -> str:
            path = extract.download(extract.RemoteFile(**remote), config.raw_path(params["year"]))
            return str(path)

        @task
        def validate_header(raw: str) -> str:
            extract.validate_header(Path(raw))
            return raw

        @task
        def stage_to_parquet(raw: str, params=None) -> str:
            return str(extract.stage_to_parquet(Path(raw), config.staged_path(params["year"])))

        @task
        def profile_staged(staged: str, params=None) -> dict:
            return {"staged": staged, **extract.profile_staged(Path(staged), params["year"])}

        raw = validate_header(download(fetch_remote_metadata()))
        return profile_staged(stage_to_parquet(raw))

    # [ to: @zrygan, fr: @all
    #   Currently this is just a @task
    #   if needed bump this up into a @task_group
    # ]
    @task
    def transform_step(extracted: dict) -> dict:
        ...

    # [ to: @zrygan, fr: @all
    #   Currently this is just a @task
    #   if needed bump this up into a @task_group
    # ]
    @task
    def load_step(transformed: dict) -> dict:
        ...
        
    load_step(transform_step(extract_group()))


dutch_railway_etl()
