import "server-only";
import { query } from "./db";
import { stationDelayQuery } from "./queries";
import type { StationReport, TimePeriod } from "./station-report-types";

export async function getStationReport(timeOfDay: TimePeriod): Promise<StationReport> {
  const rows = await query<{ station_name: string; time_of_day: TimePeriod; avg_delay_change: string; total_stops: string }>(stationDelayQuery, [timeOfDay]);
  return {
    timeOfDay,
    rows: rows.map((row) => ({ stationName: row.station_name, timeOfDay: row.time_of_day, averageDelayChange: Number(row.avg_delay_change), totalStops: Number(row.total_stops) })),
  };
}
