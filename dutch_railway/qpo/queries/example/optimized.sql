-- The baseline seq-scans all 2.4M services to find ~39k December Intercity ones.
-- A composite index finds them directly; filtering on date_key (YYYYMMDD) instead of
-- dim_date.month makes the date a range on that same index and drops the dim_date join.
CREATE INDEX fact_service_type_date_idx ON fact_service (service_type, date_key) INCLUDE (rdt_id);
ANALYZE fact_service;

SELECT
    s.station_name,
    ROUND(AVG(fs.arrival_delay), 2) AS avg_arrival_delay,
    COUNT(*) AS stops
FROM fact_service sv
JOIN fact_stop fs ON fs.rdt_id = sv.rdt_id
JOIN dim_station s ON s.station_code = fs.station_code
WHERE sv.service_type = 'Intercity' AND sv.date_key BETWEEN 20251201 AND 20251231
GROUP BY s.station_name
ORDER BY avg_arrival_delay DESC NULLS LAST, s.station_name
LIMIT 10;
