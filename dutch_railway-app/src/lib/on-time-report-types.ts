export const reportingLevels = ["Quarter", "Month", "Week"] as const;
export type Level = (typeof reportingLevels)[number];
export type Arrival = { date: string; eligible: number; onTime: number };
export type TrendRow = { period: string; start: string; end: string; eligible: number; onTime: number; rate: number; change: number | null };
export type OnTimeReport = { companyName: string | null; from: string; to: string; level: Level; arrivals: Arrival[] };
export function validDate(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
