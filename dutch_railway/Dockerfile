ARG AIRFLOW_BASE_IMAGE=apache/airflow:3.3.2
FROM ${AIRFLOW_BASE_IMAGE}

COPY requirements.txt /requirements.txt
RUN pip install --no-cache-dir -r /requirements.txt
