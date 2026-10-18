import "server-only";
import { query } from "./db";
import { companyExistsQuery, onTimeTrendsQuery } from "./queries";
import type { Level, OnTimeReport } from "./on-time-report-types";

type WarehouseRow = {
  company_name: string; quarter: number | null; month: number | null; week: number | null;
  total_stops: string; on_time_rate: string; rate_change: string | null;
};
export async function getOnTimeReport(companyName: string | null, from: string, to: string, level: Level): Promise<OnTimeReport | null> {
  if (companyName !== null) {
    const [company] = await query<{ exists: boolean }>(companyExistsQuery, [companyName]);
    if (!company?.exists) return null;
  }
  const rows = await query<WarehouseRow>(onTimeTrendsQuery(), [companyName, from, to]);
  return { companyName, from, to, level, rows: rows.map((row) => ({
    companyName: row.company_name, quarter: row.quarter, month: row.month, week: row.week,
    eligible: Number(row.total_stops), rate: Number(row.on_time_rate),
    change: row.rate_change === null ? null : Number(row.rate_change),
  })) };
}
