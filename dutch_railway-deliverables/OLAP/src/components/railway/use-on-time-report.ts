"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Filters } from "./reports";
import type { OnTimeReport } from "@/lib/on-time-report-types";

export function useOnTimeReport() {
  const [result, setResult] = useState<OnTimeReport | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRequest = useRef<AbortController | null>(null);

  useEffect(() => () => reportRequest.current?.abort(), []);

  const run = useCallback(async (filters: Filters) => {
    if (reportRequest.current) return;
    const controller = new AbortController();
    reportRequest.current = controller;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: filters.from, to: filters.to, level: filters.reporting });
      if (filters.company !== "All companies") params.set("company", filters.company);
      const response = await fetch(`/api/reports/on-time-trends?${params}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted && reportRequest.current === controller) {
        setResult(data);
        setVersion((value) => value + 1);
      }
    } catch (failure) {
      if (!controller.signal.aborted && reportRequest.current === controller) {
        setError(failure instanceof Error ? failure.message : "Could not load on-time results. Run the query again.");
      }
    } finally {
      if (!controller.signal.aborted && reportRequest.current === controller) {
        reportRequest.current = null;
        setBusy(false);
      }
    }
  }, []);

  return { result, version, busy, error, run };
}
