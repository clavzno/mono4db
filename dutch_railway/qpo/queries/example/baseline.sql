-- Example: the 10 stations with the highest average arrival delay for Intercity services
-- in December 2025.
SELECT
    s.station_name,
    ROUND(AVG(fs.arrival_delay), 2) AS avg_arrival_delay,
    COUNT(*) AS stops
FROM fact_stop fs
JOIN fact_service sv ON sv.rdt_id = fs.rdt_id
JOIN dim_date d ON d.date_key = sv.date_key
JOIN dim_station s ON s.station_code = fs.station_code
WHERE d.month = 12 AND sv.service_type = 'Intercity'
GROUP BY s.station_name
ORDER BY avg_arrival_delay DESC NULLS LAST, s.station_name
LIMIT 10;
