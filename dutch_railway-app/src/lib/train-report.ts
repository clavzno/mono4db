import "server-only";

import { query } from "./db";
import { companiesQuery, companyExistsQuery, underperformingTrainsQuery } from "./queries";
import type { TrainReport } from "./train-report-types";

type WarehouseRow = {
  train_id: string | null;
  train_on_time_rate: string | null;
  avg_train_delay: string | null;
  avg_company_delay: string | null;
  company_delay_gap: string | null;
};

export async function getCompanies(): Promise<string[]> {
  const rows = await query<{ company_name: string }>(companiesQuery);
  return rows.map((row) => row.company_name);
}

export async function getTrainReport(companyName: string, requestedLimit: number, from: string, to: string): Promise<TrainReport | null> {
  const [company] = await query<{ exists: boolean }>(companyExistsQuery, [companyName]);
  if (!company?.exists) return null;
  const rows = await query<WarehouseRow>(underperformingTrainsQuery(), [companyName, requestedLimit, from, to]);
  return {
    companyName,
    requestedLimit,
    from,
    to,
    companyAverageDelay: rows[0]?.avg_company_delay == null ? null : Number(rows[0].avg_company_delay),
    rows: rows.filter((row) => row.train_id !== null).map((row) => ({
      trainId: String(row.train_id!),
      rate: Number(row.train_on_time_rate),
      averageDelay: Number(row.avg_train_delay),
      gap: Number(row.company_delay_gap),
    })),
  };
}
