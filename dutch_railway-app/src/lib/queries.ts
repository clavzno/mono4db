import "server-only";

// Query 1. Parameters: [companyName or null, fromDate, toDate].
// Daily counts support weighted calendar drill-down without mixing week-years.
export const onTimeTrendsQuery = `
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
`;

// Query 2. Parameters: [timeOfDay], using morning, afternoon, or night.
// Source: dutch_railway/qpo/queries/company_monthly_rank_by_tod/optimized.sql
export const companyComparisonQuery = `
WITH cur AS MATERIALIZED(
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
)

SELECT
    cur.company_name,
    cur.month,
    cur.on_time_rate,
    cur.avg_arrival_delay,
    1 + (
        SELECT COUNT(*)

        FROM cur AS better
        WHERE better.month = cur.month AND better.on_time_rate > cur.on_time_rate

    ) AS rank

FROM cur

ORDER BY cur.month, rank, cur.company_name;
`;

// Query 3. Parameters: [companyName, trainLimit].
// Source: dutch_railway/qpo/queries/train_ontime_vs_company/optimized.sql
// parameterized, ranked by lowest on-time rate, compared against the company on-time rate
export const underperformingTrainsQuery = `
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
// Source: dutch_railway/qpo/queries/station_delay_train_recovery/optimized.sql
// Positive change means added delay; DESC puts the largest increases first.
export const stationDelayQuery = `
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
    AND t.time_of_day = $1
    GROUP BY fst.station_code, t.time_of_day
)
SELECT
    s.station_name,
    sc_agg.time_of_day,
    sc_agg.avg_delay_change,
    sc_agg.total_stops
FROM sc_agg
JOIN dim_station AS s ON s.station_code = sc_agg.station_code
ORDER BY sc_agg.avg_delay_change DESC, s.station_name ASC;
`;
