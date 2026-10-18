import { getTrainReport } from "@/lib/train-report";

import { validDate } from "@/lib/on-time-report-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const company = params.get("company");
  const limit = params.get("limit");
  const from = params.get("from");
  const to = params.get("to");
  if (params.getAll("from").length !== 1 || params.getAll("to").length !== 1 ||
      !validDate(from) || !validDate(to) || from > to || from < "2025-01-01" || to > "2025-12-31") {
    return Response.json({ error: "Choose a valid date range within 2025, with the end on or after the start." }, { status: 400 });
  }
  if (params.getAll("company").length !== 1 || params.getAll("limit").length !== 1 ||
      !company || !limit || !/^\d+$/.test(limit) || !Number.isSafeInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100) {
    return Response.json({ error: "Select one company and a whole number of trains from 1 to 100." }, { status: 400 });
  }
  try {
    const result = await getTrainReport(company, Number(limit), from, to);
    if (!result) return Response.json({ error: "This company does not exist in the warehouse. Reload the company list and retry." }, { status: 404 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error(`Warehouse train report failed. Code: ${code}`);
    return Response.json({ error: "Could not load train results. Check the warehouse connection and run the query again." }, { status: 503 });
  }
}
