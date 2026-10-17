import { getStationReport } from "@/lib/station-report";
import { timePeriods, type TimePeriod } from "@/lib/station-report-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const timeOfDay = params.get("timeOfDay");
  if (params.getAll("timeOfDay").length !== 1 || !timePeriods.includes(timeOfDay as TimePeriod)) {
    return Response.json({ error: "Select morning, afternoon, or night." }, { status: 400 });
  }
  try {
    return Response.json(await getStationReport(timeOfDay as TimePeriod), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Warehouse station report failed.");
    return Response.json({ error: "Could not load station results. Check the warehouse connection and run the query again." }, { status: 503 });
  }
}
