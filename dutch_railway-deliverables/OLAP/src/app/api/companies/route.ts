import { getCompanies } from "@/lib/train-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ companies: await getCompanies() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Warehouse company lookup failed.");
    return Response.json({ error: "Could not load companies. Check the warehouse connection and retry." }, { status: 503 });
  }
}
