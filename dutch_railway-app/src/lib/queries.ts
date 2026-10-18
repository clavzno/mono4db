import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { adaptOnTimeQuery, adaptCompanyQuery, adaptTrainQuery, adaptStationQuery } from "./report-sql";

const queriesDirectory = path.resolve(process.cwd(), "../dutch_railway/qpo/queries");
function loadQuery(relativePath: string): string {
  return readFileSync(path.join(queriesDirectory, relativePath), "utf8").trim();
}

// Read per request so external SQL edits cannot leave stale parameter contracts.
export function onTimeTrendsQuery(): string {
  return adaptOnTimeQuery(loadQuery("company_ontime_drilldown/optimized.sql"));
}
export function companyComparisonQuery(): string {
  return adaptCompanyQuery(loadQuery("company_monthly_rank_by_tod/optimized.sql"));
}
export function underperformingTrainsQuery(): string {
  return adaptTrainQuery(loadQuery("train_ontime_vs_company/optimized.sql"));
}
export function stationDelayQuery(recovery = false): string {
  return adaptStationQuery(loadQuery("station_delay_train_recovery/optimized.sql"), recovery);
}
export const companiesQuery = loadQuery("dashboard/companies.sql");
export const companyExistsQuery = loadQuery("dashboard/company_exists.sql");
