from datetime import datetime, timedelta
from airflow import DAG

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'start_date': datetime(2024,6,20),
    'retries': 1,
    'retry_delay': timedelta(minutes=5)
}



dag =  DAG(
    'ETL_data',
    default_args = default_args,
    description = 'loading the data from the 2025-services csv'
)
