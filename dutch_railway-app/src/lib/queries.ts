import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

const queriesDirectory = path.resolve(process.cwd(), "../dutch_railway/qpo/queries");

function loadQuery(relativePath: string): string {
  return readFileSync(path.join(queriesDirectory, relativePath), "utf8").trim();
}

// Loaded once per server module initialization. Restart after SQL edits.
export const onTimeTrendsQuery = loadQuery("company_ontime_drilldown/dashboard.sql");
export const underperformingTrainsQuery = loadQuery("train_ontime_vs_company/dashboard.sql");
export const stationDelayQuery = loadQuery("station_delay_train_recovery/dashboard.sql");
export const companiesQuery = loadQuery("dashboard/companies.sql");
export const companyExistsQuery = loadQuery("dashboard/company_exists.sql");

// Bind the dashboard filter in place of the benchmark's fixed example value.
const monthlyRankingQuery = loadQuery("company_monthly_rank_by_tod/optimized.sql");
const timeOfDayExample = "t.time_of_day = 'morning'";
if (!monthlyRankingQuery.includes(timeOfDayExample)) {
  throw new Error("Monthly ranking SQL must define the time-of-day filter.");
}
export const companyComparisonQuery = monthlyRankingQuery.replace(timeOfDayExample, "t.time_of_day = $1");
