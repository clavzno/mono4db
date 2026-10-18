import "server-only";
import { queryWithOutput } from "./db";
import { stationDelayQuery } from "./queries";
import type { StationReport, TimePeriod } from "./station-report-types";

export async function getStationReport(timeOfDay: TimePeriod, from: string, to: string, recovery = false): Promise<StationReport> {
  const { rows, sqlOutput } = await queryWithOutput<{ station_name: string; time_of_day: TimePeriod; avg_delay_change: string; total_stops: string }>(stationDelayQuery(recovery), [timeOfDay, from, to]);
  return {
    sqlOutput,
    timeOfDay,
    recovery,
    from,
    to,
    rows: rows.map((row) => ({ stationName: row.station_name, timeOfDay: row.time_of_day, averageDelayChange: Number(row.avg_delay_change), totalStops: Number(row.total_stops) })),
  };
}
