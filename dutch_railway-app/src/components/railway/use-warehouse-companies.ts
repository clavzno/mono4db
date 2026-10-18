"use client";
import { useEffect, useRef, useState } from "react";
export function useWarehouseCompanies(active: boolean) {
  const [companies, setCompanies] = useState<string[]>([]);
  const [companyStatus, setCompanyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const companiesLoaded = useRef(false);

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

  return { companies, companyStatus, companyError, retryCompanies: () => setReload((value) => value + 1) };
}
