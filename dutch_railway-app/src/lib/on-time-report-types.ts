import type { ExportableResult } from "./report-export-types";
export const reportingLevels = ["Quarter", "Month", "Week"] as const;
export type Level = (typeof reportingLevels)[number];
export type RollupRow = {
  companyName: string;
  quarter: number | null;
  month: number | null;
  week: number | null;
  eligible: number;
  rate: number;
  change: number | null;
};
export type TrendRow = RollupRow & { period: string; key: string };
export type OnTimeReport = ExportableResult & { companyName: string | null; from: string; to: string; level: Level; rows: RollupRow[] };
export function validDate(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
