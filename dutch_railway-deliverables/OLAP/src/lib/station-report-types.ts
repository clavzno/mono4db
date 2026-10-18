import type { ExportableResult } from "./report-export-types";
export const timePeriods = ["morning", "afternoon", "night"] as const;
export type TimePeriod = (typeof timePeriods)[number];
export type StationRow = {
  stationName: string;
  timeOfDay: TimePeriod;
  averageDelayChange: number;
  totalStops: number;
};
export type StationReport = ExportableResult & { timeOfDay: TimePeriod; from: string; to: string; recovery: boolean; requestedLimit: number; rows: StationRow[] };

export function validStationCount(value: unknown): boolean {
  return typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100;
}
