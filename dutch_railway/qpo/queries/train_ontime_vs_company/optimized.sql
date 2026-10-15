SELECT
	company.company_name,
	train.train_ID,
	company.avg_delay AS avg_company_delay,
	train.on_time_rate AS train_on_time_rate,
	train.avg_delay AS avg_train_delay,
	ROUND(company.avg_delay - train.avg_delay, 2) AS company_delay_gap

FROM (
	SELECT
		fsv.company_name,
		fst.train_ID,
		ROUND(100.0 * SUM(CASE WHEN fst.arrival_delay = 0 THEN 1 ELSE 0 END) / COUNT(*), 2) AS on_time_rate,
		ROUND(AVG(fst.arrival_delay), 2) AS avg_delay
	FROM fact_stop AS fst 
	JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL
	AND company_name = 'Arriva' -- TO EDIT WITH SELECTED COMPANY TO CHECK DATA OF
	GROUP BY fsv.company_name, fst.train_ID
) AS train

JOIN (
	SELECT
		fsv.company_name,
		ROUND(AVG(fst.arrival_delay), 2) AS avg_delay
	FROM fact_service AS fsv
	JOIN fact_stop AS fst ON fst.rdt_id = fsv.rdt_id
	WHERE fst.cancel_status IN ('none', 'departure-only')
	AND fst.arrival_delay IS NOT NULL
	AND company_name = 'Arriva' -- TO EDIT WITH SELECTED COMPANY TO CHECK DATA OF
	GROUP BY fsv.company_name
) AS company
ON company.company_name = train.company_name

ORDER BY company_delay_gap ASC
LIMIT 5; -- TO EDIT WITH SELECTED NUMBER OF TRAINS TO SEE
