import "server-only";
import { query } from "./db";
import { companyComparisonQuery } from "./queries";
import type { CompanyReport } from "./company-report-types";
import type { TimePeriod } from "./station-report-types";

export async function getCompanyReport(timeOfDay: TimePeriod): Promise<CompanyReport> {
  const rows = await query<{ company_name: string; month: number; on_time_rate: string; avg_arrival_delay: string; rank: string }>(companyComparisonQuery(), [timeOfDay]);
  return {
    timeOfDay,
    rows: rows.map((row) => ({ companyName: row.company_name, month: Number(row.month), onTimeRate: Number(row.on_time_rate), averageArrivalDelay: Number(row.avg_arrival_delay), rank: Number(row.rank) })),
  };
}
