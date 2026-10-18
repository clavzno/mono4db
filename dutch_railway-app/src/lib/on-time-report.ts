import "server-only";
import { query } from "./db";
import { companyExistsQuery, onTimeTrendsQuery } from "./queries";
import type { Level, OnTimeReport } from "./on-time-report-types";

export async function getOnTimeReport(companyName: string | null, from: string, to: string, level: Level): Promise<OnTimeReport | null> {
  if (companyName !== null) {
    const [company] = await query<{ exists: boolean }>(companyExistsQuery, [companyName]);
    if (!company?.exists) return null;
  }
  const rows = await query<{ date: string; eligible: string; on_time: string }>(onTimeTrendsQuery, [companyName, from, to]);
  return { companyName, from, to, level, arrivals: rows.map((row) => ({ date: row.date, eligible: Number(row.eligible), onTime: Number(row.on_time) })) };
}
