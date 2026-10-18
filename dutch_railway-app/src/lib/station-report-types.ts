export const timePeriods = ["morning", "afternoon", "night"] as const;
export type TimePeriod = (typeof timePeriods)[number];
export type StationRow = {
  stationName: string;
  timeOfDay: TimePeriod;
  averageDelayChange: number;
  totalStops: number;
};
export type StationReport = { timeOfDay: TimePeriod; from: string; to: string; recovery: boolean; rows: StationRow[] };
