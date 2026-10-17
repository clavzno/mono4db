import "server-only";

import { query } from "./db";
import { companiesQuery, companyExistsQuery, underperformingTrainsQuery } from "./queries";
import type { TrainReport } from "./train-report-types";

type WarehouseRow = {
  train_id: string | null;
  train_on_time_rate: string | null;
  avg_train_delay: string | null;
  company_on_time_rate: string | null;
  rate_gap: string | null;
};

export async function getCompanies(): Promise<string[]> {
  const rows = await query<{ company_name: string }>(companiesQuery);
  return rows.map((row) => row.company_name);
}

export async function getTrainReport(companyName: string, requestedLimit: number): Promise<TrainReport | null> {
  const [company] = await query<{ exists: boolean }>(companyExistsQuery, [companyName]);
  if (!company?.exists) return null;
  const rows = await query<WarehouseRow>(underperformingTrainsQuery, [companyName, requestedLimit]);
  return {
    companyName,
    requestedLimit,
    companyOnTimeRate: rows[0]?.company_on_time_rate == null ? null : Number(rows[0].company_on_time_rate),
    rows: rows.filter((row) => row.train_id !== null).map((row) => ({
      trainId: row.train_id!,
      rate: Number(row.train_on_time_rate),
      averageDelay: Number(row.avg_train_delay),
      gap: Number(row.rate_gap),
    })),
  };
}
