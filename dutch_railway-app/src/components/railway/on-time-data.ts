import type { Arrival, Level, TrendRow } from "@/lib/on-time-report-types";
export type { Arrival, Level, TrendRow } from "@/lib/on-time-report-types";
const iso = (date: Date) => date.toISOString().slice(0, 10);
function startOfPeriod(date: string, level: Level): Date {
  const day = new Date(`${date}T00:00:00Z`);
  if (level === "Week") day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  else day.setUTCMonth(level === "Quarter" ? Math.floor(day.getUTCMonth() / 3) * 3 : day.getUTCMonth(), 1);
  return day;
}
function nextPeriod(start: Date, level: Level, direction = 1): Date {
  const day = new Date(start);
  if (level === "Week") day.setUTCDate(day.getUTCDate() + 7 * direction);
  else day.setUTCMonth(day.getUTCMonth() + (level === "Quarter" ? 3 : 1) * direction);
  return day;
}
function periodLabel(start: Date, level: Level): string {
  if (level === "Quarter") return `${start.getUTCFullYear()} Q${Math.floor(start.getUTCMonth() / 3) + 1}`;
  if (level === "Month") return start.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const thursday = new Date(start);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(((thursday.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year} W${String(week).padStart(2, "0")}`;
}
export function aggregateArrivals(arrivals: Arrival[], level: Level, from: string, to: string): TrendRow[] {
  const groups = new Map<string, { eligible: number; onTime: number }>();
  for (const arrival of arrivals) {
    if (arrival.date < from || arrival.date > to || arrival.eligible <= 0) continue;
    const key = iso(startOfPeriod(arrival.date, level));
    const group = groups.get(key) ?? { eligible: 0, onTime: 0 };
    group.eligible += arrival.eligible;
    group.onTime += arrival.onTime;
    groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
    const start = new Date(`${key}T00:00:00Z`);
    const end = nextPeriod(start, level);
    end.setUTCDate(end.getUTCDate() - 1);
    const previous = groups.get(iso(nextPeriod(start, level, -1)));
    const rate = 100 * group.onTime / group.eligible;
    return { period: periodLabel(start, level), start: key < from ? from : key, end: iso(end) > to ? to : iso(end), ...group, rate, change: previous ? rate - 100 * previous.onTime / previous.eligible : null };
  });
}
