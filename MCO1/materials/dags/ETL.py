import pandas as pd

def extract_data():
    df = pd.read_csv('/opt/airflow/data/services-2025.csv')

    return df
