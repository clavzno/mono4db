export type Level = "Quarter" | "Month" | "Week";
export type Arrival = { date: string; eligible: number; onTime: number };
export type TrendRow = {
  period: string;
  start: string;
  end: string;
  eligible: number;
  rate: number;
  change: number | null;
};

// Deterministic UI fixtures, never presented as warehouse results.
export const sampleArrivals: Arrival[] = Array.from({ length: 365 }, (_, index) => {
  const date = new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10);
  const eligible = 42000 + ((index * 173) % 9000);
  const rate = 0.86 + Math.sin(index / 28) * 0.045;
  return { date, eligible, onTime: Math.round(eligible * rate) };
});

function periodFor(date: string, level: Level) {
  const day = new Date(`${date}T00:00:00Z`);
  const year = day.getUTCFullYear();
  const month = day.getUTCMonth();
  if (level === "Quarter") return `${year} Q${Math.floor(month / 3) + 1}`;
  if (level === "Month") return day.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const weekYear = day.getUTCFullYear();
  const firstDay = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil(((day.getTime() - firstDay.getTime()) / 86400000 + 1) / 7);
  return `${weekYear} W${String(week).padStart(2, "0")}`;
}

export function aggregateArrivals(arrivals: Arrival[], level: Level, from: string, to: string): TrendRow[] {
  const groups = new Map<string, { start: string; end: string; eligible: number; onTime: number }>();
  for (const arrival of arrivals) {
    if (arrival.date < from || arrival.date > to) continue;
    const period = periodFor(arrival.date, level);
    const group = groups.get(period) ?? { start: arrival.date, end: arrival.date, eligible: 0, onTime: 0 };
    group.start = group.start < arrival.date ? group.start : arrival.date;
    group.end = group.end > arrival.date ? group.end : arrival.date;
    group.eligible += arrival.eligible;
    group.onTime += arrival.onTime;
    groups.set(period, group);
  }
  const rows = [...groups].sort((a, b) => a[1].start.localeCompare(b[1].start));
  return rows.map(([period, group], index) => {
    const rate = group.eligible ? group.onTime / group.eligible * 100 : 0;
    const previous = rows[index - 1]?.[1];
    return { period, start: group.start, end: group.end, eligible: group.eligible, rate,
      change: previous?.eligible ? rate - previous.onTime / previous.eligible * 100 : null };
  });
}
