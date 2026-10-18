import type { Level, RollupRow, TrendRow } from "@/lib/on-time-report-types";
export type { Level, TrendRow } from "@/lib/on-time-report-types";

export type RollupView = { level: Level; quarter?: number; month?: number; companyName?: string };
export function selectRollups(rows: RollupRow[], view: RollupView): TrendRow[] {
  return rows.filter((row) => {
    if (view.companyName !== undefined && row.companyName !== view.companyName) return false;
    if (view.quarter !== undefined && row.quarter !== view.quarter) return false;
    if (view.month !== undefined && row.month !== view.month) return false;
    if (view.level === "Quarter") return row.quarter !== null && row.month === null && row.week === null;
    if (view.level === "Month") return row.month !== null && row.week === null;
    return row.week !== null;
  }).map((row) => ({ ...row,
    period: view.level === "Quarter" ? `Q${row.quarter}` : view.level === "Month" ? `Month ${row.month}` : `Week ${row.week}`,
    key: JSON.stringify([row.companyName, row.quarter, row.month, row.week]),
  }));
}

export type DisplayTrendRow = TrendRow & { order: number };

// Presentation only: combine company rows at one grain, never parent rollups.
export function combineRollups(rows: RollupRow[], view: RollupView, year: string): DisplayTrendRow[] {
  const periods = new Map<string, { row: TrendRow; eligible: number; weightedRate: number; companies: number }>();
  for (const row of selectRollups(rows, { level: view.level })) {
    const key = JSON.stringify([row.quarter, row.month, row.week]);
    const group = periods.get(key) ?? { row, eligible: 0, weightedRate: 0, companies: 0 };
    group.eligible += row.eligible;
    group.weightedRate += row.rate * row.eligible;
    group.companies += 1;
    periods.set(key, group);
  }
  const orderOf = (row: TrendRow) => (view.level === "Quarter" ? row.quarter : view.level === "Month" ? row.month : row.week) ?? 0;
  const grouped = [...periods].map(([key, group]) => ({
    ...group.row, key, eligible: group.eligible,
    rate: group.eligible ? group.weightedRate / group.eligible : 0,
    order: orderOf(group.row), companies: group.companies,
  }));
  return grouped.filter((row) =>
    (view.quarter === undefined || row.quarter === view.quarter) &&
    (view.month === undefined || row.month === view.month)
  ).sort((a, b) => a.order - b.order).map((row) => {
    const previous = grouped.find((candidate) => candidate.order === row.order - 1);
    const change = row.companies === 1 && previous?.companies === 1 ? row.change : previous ? row.rate - previous.rate : null;
    const period = view.level === "Quarter" ? `${year} Q${row.quarter}` : view.level === "Month"
      ? new Date(Date.UTC(Number(year), row.month! - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })
      : `Week ${String(row.week).padStart(2, "0")}`;
    return { ...row, period, change };
  });
}
