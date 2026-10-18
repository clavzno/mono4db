CREATE TABLE IF NOT EXISTS dim_date (
    date_key     INTEGER  PRIMARY KEY,
    service_date DATE     NOT NULL UNIQUE,
    week         SMALLINT NOT NULL,
    month        SMALLINT NOT NULL,
    quarter      SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_time (
    time_key    SMALLINT PRIMARY KEY,
    hour        SMALLINT NOT NULL,
    minute      SMALLINT NOT NULL,
    time_of_day TEXT     NOT NULL CHECK (time_of_day IN ('morning', 'afternoon', 'night'))
);

CREATE TABLE IF NOT EXISTS dim_station (
    station_code TEXT PRIMARY KEY,
    station_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fact_service (
    rdt_id             BIGINT  PRIMARY KEY,
    date_key           INTEGER NOT NULL REFERENCES dim_date,
    first_train_number BIGINT  NOT NULL,
    last_train_number  BIGINT  NOT NULL,
    train_id_changed   BOOLEAN NOT NULL,
    cancel_status      TEXT    NOT NULL CHECK (cancel_status IN ('completely', 'partially', 'none')),
    service_type       TEXT    NOT NULL,
    company_name       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS fact_service_date_key_idx ON fact_service (date_key);

CREATE TABLE IF NOT EXISTS fact_stop (
    stop_id              BIGINT   PRIMARY KEY,
    rdt_id               BIGINT   NOT NULL REFERENCES fact_service,
    arrival_time         SMALLINT REFERENCES dim_time,      
    departure_time       SMALLINT REFERENCES dim_time,      
    station_code         TEXT     NOT NULL REFERENCES dim_station,
    train_id             BIGINT   NOT NULL,
    arrival_day_offset   SMALLINT,
    departure_day_offset SMALLINT,
    cancel_status        TEXT     NOT NULL
        CHECK (cancel_status IN ('completely', 'departure-only', 'arrival-only', 'none')),
    arrival_delay        INTEGER,
    departure_delay      INTEGER
);
CREATE INDEX IF NOT EXISTS fact_stop_rdt_id_idx ON fact_stop (rdt_id);
CREATE INDEX IF NOT EXISTS fact_stop_station_code_idx ON fact_stop (station_code);
