CREATE INDEX ON fact_service (company_name);

WITH train AS (
	SELECT
		fsv.company_name,
		fst.train_id,
		COUNT(*) AS total_stops,
		SUM(fst.arrival_delay) AS total_delay,
		COUNT(*) FILTER (WHERE fst.arrival_delay = 0) AS on_time
	FROM fact_stop AS fst
	JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL
	AND fsv.company_name = 'Arriva' -- TO EDIT WITH SELECTED COMPANY
	GROUP BY fsv.company_name, fst.train_id
),
calc AS (
	SELECT
		company_name,
		train_id,
		ROUND(SUM(total_delay) OVER (PARTITION BY company_name)::numeric / SUM(total_stops) OVER (PARTITION BY company_name), 2) AS avg_company_delay,
		ROUND(100.0 * on_time / total_stops, 2) AS train_on_time_rate,
		ROUND(total_delay::numeric / total_stops, 2) AS avg_train_delay
	FROM train
)
SELECT
	company_name,
	train_id,
	avg_company_delay,
	train_on_time_rate,
	avg_train_delay,
	ROUND(avg_company_delay - avg_train_delay, 2) AS company_delay_gap
FROM calc
ORDER BY company_delay_gap ASC
LIMIT 5 -- EDIT HERE WITH NUM OF TRAINS TO SHOW;
