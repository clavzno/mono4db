SELECT
	cur.company_name,
	cur.month,
	cur.on_time_rate,
	cur.avg_arrival_delay,
	1 + (
		SELECT COUNT(*)

		FROM (
			SELECT fsv2.company_name

			FROM fact_stop AS fst2
			JOIN fact_service AS fsv2 ON fsv2.rdt_id = fst2.rdt_id
			JOIN dim_date AS d2 ON d2.date_key = fsv2.date_key
			JOIN dim_time AS t2 ON t2.time_key = fst2.arrival_time

			WHERE fst2.cancel_status IN ('none', 'departure-only')
			AND fst2.arrival_delay IS NOT NULL
			AND t2.time_of_day = 'morning' -- THIS WHERE CLAUSE CAN CHANGE DEPENDING ON SELECTED TIME
			AND d2.month = cur.month

			GROUP BY fsv2.company_name, d2.month
			HAVING ROUND(100.0 * SUM(CASE WHEN fst2.arrival_delay = 0 THEN 1 ELSE 0 END) / COUNT(*), 2)
			       > cur.on_time_rate
		) AS better_thans
	) AS rank

FROM (
	SELECT
		fsv.company_name,
		d.month,
		ROUND(100.0 * SUM(CASE WHEN fst.arrival_delay = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate,
		ROUND(AVG(fst.arrival_delay), 2) AS avg_arrival_delay

	FROM fact_stop AS fst
	JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
	JOIN dim_date AS d ON d.date_key = fsv.date_key
	JOIN dim_time AS t ON t.time_key = fst.arrival_time

	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL
	AND t.time_of_day = 'morning' -- THIS WHERE CLAUSE CAN CHANGE DEPENDING ON SELECTED TIME

	GROUP BY fsv.company_name, d.month
) AS cur

ORDER BY cur.month, rank;
