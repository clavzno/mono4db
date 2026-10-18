import type { TimePeriod } from "./station-report-types";

export interface CompanyRow {
  companyName: string;
  month: number;
  onTimeRate: number;
  averageArrivalDelay: number;
  rank: number;
}

export interface CompanyReport {
  timeOfDay: TimePeriod;
  rows: CompanyRow[];
}

export const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
