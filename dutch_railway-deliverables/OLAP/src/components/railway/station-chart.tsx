"use client";

import { useEffect, useRef } from "react";
import { init, use as registerCharts } from "echarts/core";
import { BarChart } from "echarts/charts";
import { AriaComponent, DataZoomComponent, GridComponent, TooltipComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { StationRow } from "@/lib/station-report-types";

registerCharts([BarChart, AriaComponent, DataZoomComponent, GridComponent, TooltipComponent, SVGRenderer]);

export default function StationChart({ rows }: { rows: StationRow[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = init(container.current, undefined, { renderer: "svg" });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: "Station delay change in minutes. Positive values mean added delay; negative values mean recovery. Exact values are in the results table." },
      grid: { left: 12, right: 55, top: 18, bottom: 45, containLabel: true },
      tooltip: { trigger: "axis", renderMode: "richText", axisPointer: { type: "shadow" }, valueFormatter: (value: number) => `${value.toFixed(2)} min` },
      xAxis: { type: "value", name: "Delay change (min)", nameLocation: "middle", nameGap: 30, splitLine: { lineStyle: { color: "#e6ebf2" } } },
      yAxis: { type: "category", inverse: true, data: rows.map((row) => row.stationName), axisLabel: { width: 130, overflow: "truncate", fontSize: 11 }, axisTick: { show: false } },
      dataZoom: rows.length > 15 ? [{ type: "slider", yAxisIndex: 0, right: 3, width: 15, startValue: 0, endValue: 14, filterMode: "filter" }] : [],
      series: [{ type: "bar", name: "Average delay change", barMaxWidth: 26, data: rows.map((row) => ({ value: row.averageDelayChange, itemStyle: { color: row.averageDelayChange < 0 ? "#22745d" : "#26588c" } })) }],
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container.current);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [rows]);
  return <div ref={container} className="station-chart" />;
}
