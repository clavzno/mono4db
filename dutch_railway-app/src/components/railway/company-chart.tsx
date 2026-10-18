"use client";

import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { monthNames, type CompanyRow } from "@/lib/company-report-types";

registerCharts([LineChart, AriaComponent, GridComponent, LegendComponent, TooltipComponent, SVGRenderer]);

export default function CompanyChart({ rows }: { rows: CompanyRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const companies = [...new Set(rows.map((row) => row.companyName))].sort();
    const values = new Map(rows.map((row) => [`${row.companyName}:${row.month}`, row.onTimeRate]));
    const chart = init(container.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: "Monthly company on-time rates from 0 to 100 percent. Missing months have gaps. Exact rates and monthly ranks are in the results table." },
      color: ["#26588c", "#22745d", "#a86422", "#8055a6", "#b6435d", "#347f91", "#676d31", "#725044"],
      grid: { left: 15, right: 20, top: 60, bottom: 45, containLabel: true },
      legend: { type: "scroll", top: 5 },
      tooltip: { trigger: "axis", renderMode: "richText", valueFormatter: (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "N/A" },
      xAxis: { type: "category", data: monthNames.map((month) => month.slice(0, 3)), boundaryGap: false },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%" }, splitLine: { lineStyle: { color: "#e6ebf2" } } },
      series: companies.map((name) => ({ name, type: "line", connectNulls: false, symbolSize: 7, emphasis: { focus: "series" }, data: monthNames.map((_, index) => values.get(`${name}:${index + 1}`) ?? null) })),
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [rows]);
  return <div ref={container} className="station-chart" />;
}
