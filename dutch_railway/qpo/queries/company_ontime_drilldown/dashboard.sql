SELECT d.service_date::text AS date,
    COUNT(*) AS eligible,
    COUNT(*) FILTER (WHERE fst.arrival_delay = 0) AS on_time
FROM fact_stop AS fst
JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
JOIN dim_date AS d ON d.date_key = fsv.date_key
WHERE fst.cancel_status IN ('none', 'departure-only')
  AND fst.arrival_delay IS NOT NULL
  AND ($1::text IS NULL OR fsv.company_name = $1)
  AND d.service_date BETWEEN $2::date AND $3::date
GROUP BY d.service_date
ORDER BY d.service_date;
