WITH sc_agg AS (
    SELECT
        fst.station_code,
        t.time_of_day,
        ROUND(AVG(fst.departure_delay - fst.arrival_delay), 2) AS avg_delay_change,
        COUNT(*) AS total_stops
    FROM fact_stop AS fst
    JOIN dim_time AS t ON t.time_key = fst.arrival_time
    WHERE fst.cancel_status = 'none'
    AND fst.arrival_delay   IS NOT NULL
    AND fst.departure_delay IS NOT NULL
    AND t.time_of_day = 'morning'
    GROUP BY fst.station_code, t.time_of_day
)

SELECT
    s.station_name,
    sc_agg.time_of_day,
    sc_agg.avg_delay_change,
    sc_agg.total_stops
FROM sc_agg
JOIN dim_station AS s ON s.station_code = sc_agg.station_code
ORDER BY avg_delay_change DESC 
LIMIT 5;