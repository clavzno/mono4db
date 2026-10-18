export const reports = [
  { id: "on-time", title: "On-time Trends", description: "Follow punctuality across quarters, months, and weeks.", fields: ["company", "reporting", "period"] },
  { id: "companies", title: "Company Comparison", description: "Compare monthly company punctuality and average arrival delays.", fields: ["time"] },
  { id: "trains", title: "Underperforming Trains", description: "Compare the lowest-ranked trains with their company on-time baseline.", fields: ["company", "service", "period"] },
  { id: "stations", title: "Station Delay", description: "Explore where trains lose time and where they recover it.", fields: ["station", "time", "period"] },
] as const;
export type ReportId = (typeof reports)[number]["id"];
export const filterDefinitions = {
  company: { label: "Company", options: ["All companies"] },
  reporting: { label: "Reporting level", options: ["Quarter", "Month", "Week"] },
  period: { label: "Period", options: ["Full year 2025", "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Custom dates"] },
  metric: { label: "Compare by", options: ["Punctuality", "Cancellations"] },
  service: { label: "Service type", options: ["All service types", "Intercity", "Sprinter"] },
  station: { label: "Station", options: ["All stations"] },
  time: { label: "Time of day", options: ["All day", "Morning", "Afternoon", "Night"] },
};
export type Filters = Record<keyof typeof filterDefinitions | "from" | "to" | "trainCount" | "customTrainCount", string>;
export const defaultFilters: Filters = { company: "All companies", reporting: "Quarter", period: "Full year 2025", metric: "Punctuality", service: "All service types", station: "All stations", time: "All day", from: "2025-01-01", to: "2025-12-31", trainCount: "5", customTrainCount: "25" };
export function defaultsForReport(report: ReportId): Filters {
  return { ...defaultFilters, ...(report === "trains" ? { company: "" } : {}) };
}
export function validTrainCount(value: unknown): boolean {
  return typeof value === "string" && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 100;
}
export function isConfiguration(value: unknown): value is { version: 1; report: ReportId; filters: Filters } {
  if (!value || typeof value !== "object") return false;
  const config = value as Record<string, unknown>;
  if (config.version !== 1 || !reports.some((report) => report.id === config.report) || !config.filters || typeof config.filters !== "object") return false;
  const filters = config.filters as Record<string, unknown>;
  if (!Object.entries(filterDefinitions).every(([key, field]) => key === "company" && (config.report === "trains" || config.report === "on-time") ? typeof filters.company === "string" && filters.company.length > 0 : typeof filters[key] === "string" && field.options.includes(filters[key] as string))) return false;
  if (config.report === "trains" && (!["5", "10", "20", "Custom"].includes(String(filters.trainCount)) || (filters.trainCount === "Custom" && !validTrainCount(filters.customTrainCount)))) return false;
  const validDate = (date: unknown) => typeof date === "string" && /^2025-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  return validDate(filters.from) && validDate(filters.to) && String(filters.from) <= String(filters.to);
}
