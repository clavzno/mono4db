SELECT
	s.station_name,
	t.time_of_day,
	ROUND(AVG(fst.departure_delay - fst.arrival_delay), 2) AS avg_delay_change,
	COUNT(*) AS total_stops
FROM fact_stop AS fst
JOIN dim_station AS s ON s.station_code = fst.station_code
JOIN dim_time    AS t ON t.time_key     = fst.arrival_time
WHERE fst.cancel_status = 'none'
AND fst.arrival_delay   IS NOT NULL
AND fst.departure_delay IS NOT NULL
AND t.time_of_day = 'morning' -- EDIT HERE TO MORNING/NOON/NIGHT BASED ON INPUT
GROUP BY s.station_name, t.time_of_day
ORDER BY avg_delay_change DESC -- EDIT HERE FROM ASC TO DESC. DESC = RECOVERY, ASC = DELAYERS
LIMIT 5;
