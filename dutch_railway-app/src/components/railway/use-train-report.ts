"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrainReport } from "@/lib/train-report-types";

export function useTrainReport(active: boolean) {
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyStatus, setCompanyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const companiesLoaded = useRef(false);
  const [result, setResult] = useState<TrainReport | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active || companiesLoaded.current) return;
    const controller = new AbortController();
    async function loadCompanies() {
      setCompanyStatus("loading");
      setCompanyError(null);
      try {
        const response = await fetch("/api/companies", { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setCompanies(data.companies);
        companiesLoaded.current = true;
        setCompanyStatus("ready");
      } catch (failure) {
        if (controller.signal.aborted) return;
        setCompanyError(failure instanceof Error ? failure.message : "Could not load companies. Retry the company lookup.");
        setCompanyStatus("error");
      }
    }
    void loadCompanies();
    return () => controller.abort();
  }, [active, reload]);

  useEffect(() => () => reportRequest.current?.abort(), []);

  const run = useCallback(async (company: string, limit: number) => {
    if (reportRequest.current) return;
    const controller = new AbortController();
    reportRequest.current = controller;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ company, limit: String(limit) });
      const response = await fetch(`/api/reports/underperforming-trains?${params}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted && reportRequest.current === controller) {
        setResult(data);
        setVersion((value) => value + 1);
      }
    } catch (failure) {
      if (!controller.signal.aborted && reportRequest.current === controller) {
        setError(failure instanceof Error ? failure.message : "Could not load train results. Run the query again.");
      }
    } finally {
      if (!controller.signal.aborted && reportRequest.current === controller) {
        reportRequest.current = null;
        setBusy(false);
      }
    }
  }, []);

  return { companies, companyStatus, companyError, retryCompanies: () => setReload((value) => value + 1), result, version, busy, error, run };
}
