# Dashboard queries

The Next.js app loads SQL from this queries tree on server startup. Restart the
app after editing SQL. Run Next.js from the `dutch_railway-app` directory.

- Company comparison loads `company_monthly_rank_by_tod/optimized.sql` and binds
  its example `morning` filter as `$1`.
- On-time trends loads `company_ontime_drilldown/dashboard.sql`, with parameters
  `[companyName or null, fromDate, toDate]`. Daily counts preserve date filtering
  and weighted calendar drill-down, which the benchmark rollups cannot provide.
- Underperforming trains loads `train_ontime_vs_company/dashboard.sql`, with
  parameters `[companyName, trainLimit]`. It compares on-time rates; the benchmark
  compares average delays.
- Station delay loads `station_delay_train_recovery/dashboard.sql`, with parameter
  `[timeOfDay]`. It returns all stations instead of the benchmark's top five.
- Company lookup SQL lives in this directory. Company existence binds `$1`.

The baseline and optimized benchmark files remain usable by the QPO workflow.
Dashboard variants keep the app's existing result columns and parameter contracts.
Next.js output tracing includes SQL from this tree for production packaging.
