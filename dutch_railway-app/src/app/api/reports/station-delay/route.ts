import { validDate } from "@/lib/on-time-report-types";
import { getStationReport } from "@/lib/station-report";
import { timePeriods, type TimePeriod } from "@/lib/station-report-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeOfDay = params.get("timeOfDay");
  const order = params.get("order") ?? "addition";
  if (params.getAll("order").length > 1 || !["addition", "recovery"].includes(order)) {
    return Response.json({ error: "Choose delay addition or recovery." }, { status: 400 });
  }
  const from = params.get("from");
  const to = params.get("to");
  if (params.getAll("from").length !== 1 || params.getAll("to").length !== 1 ||
      !validDate(from) || !validDate(to) || from > to || from < "2025-01-01" || to > "2025-12-31") {
    return Response.json({ error: "Choose a valid date range within 2025, with the end on or after the start." }, { status: 400 });
  }
  if (params.getAll("timeOfDay").length !== 1 || !timePeriods.includes(timeOfDay as TimePeriod)) {
    return Response.json({ error: "Select morning, afternoon, or night." }, { status: 400 });
  }
  try {
    return Response.json(await getStationReport(timeOfDay as TimePeriod, from, to, order === "recovery"), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error(`Warehouse station report failed. Code: ${code}`);
    return Response.json({ error: "Could not load station results. Check the warehouse connection and run the query again." }, { status: 503 });
  }
}
