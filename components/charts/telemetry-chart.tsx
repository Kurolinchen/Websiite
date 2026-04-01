"use client";

import { useEffect, useMemo, useRef } from "react";
import { AreaSeries, ColorType, createChart, LineStyle, type Time } from "lightweight-charts";
import { Panel } from "@/components/ui/panel";

export function TelemetryChart({
  title,
  eyebrow,
  values,
  currentIndex,
  formatter,
}: {
  title: string;
  eyebrow: string;
  values: number[];
  currentIndex: number;
  formatter?: (value: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const stats = useMemo(() => {
    const current = values[Math.max(0, currentIndex)] ?? values[values.length - 1] ?? 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const delta = current - (values[Math.max(0, currentIndex - 1)] ?? current);

    return { current, min, max, delta };
  }, [currentIndex, values]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      height: 180,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(255,255,255,0.56)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.05)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.2, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        tickMarkFormatter: (time) => `L${time}`,
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.16)", labelBackgroundColor: "rgba(15,23,42,0.95)" },
        horzLine: { color: "rgba(255,255,255,0.14)", labelBackgroundColor: "rgba(15,23,42,0.95)" },
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "rgba(120, 132, 255, 0.95)",
      topColor: "rgba(120, 132, 255, 0.26)",
      bottomColor: "rgba(120, 132, 255, 0.02)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    series.setData(values.map((value, index) => ({ time: (index + 1) as Time, value })));
    series.createPriceLine({
      price: stats.current,
      color: "rgba(255,255,255,0.26)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "NOW",
    });

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => chart.applyOptions({ width: container.clientWidth }));
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [stats.current, values]);

  return (
    <Panel
      eyebrow={eyebrow}
      title={title}
      action={<div className="text-right text-[10px] uppercase tracking-[0.26em] text-white/45">Live sample</div>}
      className="h-full"
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-xs uppercase tracking-[0.18em] text-white/42">
        <TelemetryStat label="Current" value={formatter?.(stats.current) ?? stats.current.toFixed(0)} />
        <TelemetryStat label="Peak" value={formatter?.(stats.max) ?? stats.max.toFixed(0)} />
        <TelemetryStat label="Δ lap" value={`${stats.delta > 0 ? "+" : ""}${formatter ? formatter(stats.delta) : stats.delta.toFixed(1)}`} />
      </div>
      <div ref={containerRef} className="h-[180px] w-full" />
    </Panel>
  );
}

function TelemetryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] px-3 py-2">
      <div className="mb-1 text-[9px] tracking-[0.28em] text-white/38">{label}</div>
      <div className="text-sm font-medium tracking-wide text-white/90">{value}</div>
    </div>
  );
}
