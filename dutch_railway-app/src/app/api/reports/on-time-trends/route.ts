import { getOnTimeReport } from "@/lib/on-time-report";
import { reportingLevels, validDate, type Level } from "@/lib/on-time-report-types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from"); const to = params.get("to");
  const level = params.get("level"); const company = params.get("company");
  if (["from", "to", "level"].some((key) => params.getAll(key).length !== 1) || params.getAll("company").length > 1 || company === "" ||
      !validDate(from) || !validDate(to) || from > to || !reportingLevels.includes(level as Level)) {
    return Response.json({ error: "Choose valid dates in order, a reporting level, and at most one company." }, { status: 400 });
  }
  try {
    const report = await getOnTimeReport(company, from, to, level as Level);
    if (!report) return Response.json({ error: "This company does not exist in the warehouse. Reload company choices and retry." }, { status: 404 });
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Warehouse on-time report failed.");
    return Response.json({ error: "Could not load on-time results. Check the warehouse connection and run the query again." }, { status: 503 });
  }
}
