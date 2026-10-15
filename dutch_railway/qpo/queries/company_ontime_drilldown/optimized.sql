SELECT
	cur.company_name,
	cur.quarter,
	cur.month,
	cur.week,
	cur.total_stops,
	cur.on_time_rate,
	ROUND(cur.on_time_rate - prev.on_time_rate, 2) AS rate_change

FROM (
	SELECT
		fsv.company_name,
		wm.min_quarter AS quarter,
		wm.min_month AS month,
		d.week,
		COUNT(*) AS total_stops,
		ROUND(100.0 * SUM(CASE WHEN fst.arrival_delay = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate

	FROM fact_stop AS fst
	JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
	JOIN dim_date AS d ON d.date_key = fsv.date_key
	JOIN (
		SELECT week, MIN(quarter) AS min_quarter, MIN(month) AS min_month
		FROM dim_date
		GROUP BY week
	) AS wm ON wm.week = d.week

	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL

	GROUP BY fsv.company_name,
	ROLLUP (wm.min_quarter, wm.min_month, d.week)
) AS cur

LEFT JOIN (
	SELECT
		fsv.company_name,
		wm.min_quarter AS quarter,
		wm.min_month AS month,
		d.week,
		ROUND(100.0 * SUM(CASE WHEN fst.arrival_delay = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate

	FROM fact_stop AS fst
	JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
	JOIN dim_date AS d ON d.date_key = fsv.date_key
	JOIN (
		SELECT week, MIN(quarter) AS min_quarter, MIN(month) AS min_month
		FROM dim_date
		GROUP BY week
	) AS wm ON wm.week = d.week

	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL

	GROUP BY fsv.company_name,
	ROLLUP (wm.min_quarter, wm.min_month, d.week)
) AS prev

ON prev.company_name = cur.company_name
AND (
		(cur.month IS NULL AND cur.quarter IS NOT NULL
		AND prev.month IS NULL AND prev.quarter = cur.quarter - 1)
	OR
		(cur.week IS NULL AND cur.month IS NOT NULL
		AND prev.week IS NULL AND prev.month = cur.month - 1)
	OR
		(cur.week IS NOT NULL AND prev.week = cur.week - 1)
	)

ORDER BY cur.company_name, cur.quarter, cur.month, cur.week;
