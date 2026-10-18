"use client";
import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { BarChart } from "echarts/charts";
import { AriaComponent, GridComponent, TooltipComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { DisplayTrendRow as TrendRow } from "./on-time-data";
registerCharts([BarChart, AriaComponent, GridComponent, TooltipComponent, DataZoomComponent, SVGRenderer]);

export default function OnTimeChart({ rows, canDrill, onDrill }: { rows: TrendRow[]; canDrill: boolean; onDrill: (row: TrendRow) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = init(container.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: "On-time arrival rates from 0 to 100 percent. Use period buttons in the results table to drill down with the keyboard." },
      grid: { left: 15, right: 20, top: 30, bottom: rows.length > 12 ? 80 : 35, containLabel: true },
      xAxis: { type: "category", data: rows.map((row) => row.period), axisLabel: { hideOverlap: true } },
      yAxis: { type: "value", min: 0, max: 100, axisLabel: { formatter: "{value}%" } },
      tooltip: { trigger: "axis", renderMode: "richText", valueFormatter: (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}%` : "N/A" },
      dataZoom: rows.length > 12 ? [{ type: "slider", xAxisIndex: 0, startValue: 0, endValue: 11 }] : [],
      series: [{ name: "On-time arrivals", type: "bar", cursor: canDrill ? "pointer" : "default", barMaxWidth: 58, itemStyle: { color: "#26588c", borderRadius: [4, 4, 0, 0] }, label: { show: rows.length <= 12, position: "top", formatter: (params: { value: number }) => `${params.value.toFixed(2)}%` }, data: rows.map((row) => row.rate) }],
    });
    chart.on("click", (event) => { if (canDrill && typeof event.dataIndex === "number" && rows[event.dataIndex]) onDrill(rows[event.dataIndex]); });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [rows, canDrill, onDrill]);
  return <div className="on-time-echart" ref={container} />;
}
