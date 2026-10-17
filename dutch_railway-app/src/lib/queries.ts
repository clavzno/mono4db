import "server-only";

// Query 1. No parameters. Preserves the baseline week grouping and prior-period joins.
// Source: dutch_railway/qpo/queries/company_ontime_drilldown/baseline.sql
export const onTimeTrendsQuery = `
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
`;

// Query 2. Parameters: [timeOfDay], using morning, afternoon, or night.
// Source: dutch_railway/qpo/queries/company_monthly_rank_by_tod/baseline.sql
export const companyComparisonQuery = `
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
            AND t2.time_of_day = $1
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
    AND t.time_of_day = $1

    GROUP BY fsv.company_name, d.month
) AS cur

ORDER BY cur.month, rank;
`;

// Query 3. Parameters: [companyName, trainLimit].
// Adapted for Report 3: rank by on-time rate and compare against all company arrivals.
export const underperformingTrainsQuery = `
WITH train_stats AS (
    SELECT
        fst.train_id,
        COUNT(*) AS eligible_arrivals,
        COUNT(*) FILTER (WHERE fst.arrival_delay = 0) AS on_time_arrivals,
        AVG(fst.arrival_delay) AS average_delay
    FROM fact_stop AS fst
    JOIN fact_service AS fsv ON fsv.rdt_id = fst.rdt_id
    WHERE fsv.company_name = $1
      AND fst.cancel_status IN ('none', 'departure-only')
      AND fst.arrival_delay IS NOT NULL
    GROUP BY fst.train_id
), company AS (
    SELECT 100.0 * SUM(on_time_arrivals) / NULLIF(SUM(eligible_arrivals), 0) AS on_time_rate
    FROM train_stats
)
SELECT
    train.train_id::text AS train_id,
    100.0 * train.on_time_arrivals / train.eligible_arrivals AS train_on_time_rate,
    train.average_delay AS avg_train_delay,
    company.on_time_rate AS company_on_time_rate,
    100.0 * train.on_time_arrivals / train.eligible_arrivals - company.on_time_rate AS rate_gap
FROM company
LEFT JOIN train_stats AS train ON TRUE
ORDER BY train_on_time_rate ASC, train.train_id ASC
LIMIT $2;
`;

export const companiesQuery = `
SELECT DISTINCT company_name
FROM fact_service
ORDER BY company_name;
`;

export const companyExistsQuery = `
SELECT EXISTS (SELECT 1 FROM fact_service WHERE company_name = $1) AS exists;
`;

// Query 4. Parameters: [timeOfDay], using morning, afternoon, or night. No row limit.
// Source: dutch_railway/qpo/queries/station_delay_train_recovery/baseline.sql
// Positive change means added delay; DESC puts the largest increases first.
export const stationDelayQuery = `
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
AND t.time_of_day = $1
GROUP BY s.station_name, t.time_of_day
ORDER BY avg_delay_change DESC, s.station_name ASC;
`;
