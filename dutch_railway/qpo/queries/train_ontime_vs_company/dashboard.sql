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
    AND fsv.company_name = $1
    GROUP BY fsv.company_name, fst.train_id
),
calc AS (
    SELECT
        train_id,
        total_stops,
        ROUND(100.0 * SUM(on_time) OVER (PARTITION BY company_name)
              / SUM(total_stops) OVER (PARTITION BY company_name), 2) AS company_on_time_rate,
        ROUND(100.0 * on_time / total_stops, 2) AS train_on_time_rate,
        ROUND(total_delay::numeric / total_stops, 2) AS avg_train_delay
    FROM train
)
SELECT
    train_id::text AS train_id,
    train_on_time_rate,
    avg_train_delay,
    company_on_time_rate,
    ROUND(train_on_time_rate - company_on_time_rate, 2) AS rate_gap
FROM calc
ORDER BY train_on_time_rate ASC, train_id ASC
LIMIT $2;
