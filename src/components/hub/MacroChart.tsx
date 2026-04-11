import { useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceArea, ReferenceLine,
} from "recharts";
import { Download, Camera, RotateCcw, TrendingUp, Activity } from "lucide-react";
import { sma, ema, linearRegression, type DataPoint } from "@/lib/statistics";

interface MacroChartDataPoint {
  date: string;
  value: number;
  value2?: number;
}

interface FormattedDataPoint extends MacroChartDataPoint {
  dateLabel: string;
  sma?: number;
  ema?: number;
  trend?: number;
}

export interface MacroChartEvent {
  date: string; // ISO yyyy-mm-dd
  label: string; // short tag, e.g. "COPOM +100bps"
  kind?: "hike" | "cut" | "hold" | "start";
  authority?: "COPOM" | "FOMC";
  rationale?: string;
}

interface MacroChartProps {
  data: MacroChartDataPoint[];
  title: string;
  type?: "line" | "area" | "bar";
  color?: string;
  color2?: string;
  label?: string;
  label2?: string;
  unit?: string;
  height?: number;
  loading?: boolean;
  /** Reference value to draw as horizontal dashed line (e.g. target/meta) */
  refValue?: number;
  refLabel?: string;
  /** Optional monetary policy event overlay (COPOM/FOMC) */
  events?: MacroChartEvent[];
}

/* ───── Overlay state ───── */
type Overlay = "sma" | "ema" | "trend";

/* ───── Smart Y-axis domain & tick computation ───── */
function computeYDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 0.5, 1] };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Add padding: 10% above and below, but never go below 0 if all values are positive
  const pad = range === 0 ? Math.abs(max * 0.1) || 1 : range * 0.1;
  let lo = min - pad;
  let hi = max + pad;

  // If all values are positive and lo would go negative, clamp to 0
  if (min >= 0 && lo < 0) lo = 0;

  // Compute nice tick step
  const rawStep = (hi - lo) / 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
  const niceSteps = [1, 2, 2.5, 5, 10];
  const normalized = rawStep / magnitude;
  const niceStep = magnitude * (niceSteps.find(s => s >= normalized) || 10);

  // Align domain to nice boundaries
  lo = Math.floor(lo / niceStep) * niceStep;
  hi = Math.ceil(hi / niceStep) * niceStep;

  // Generate ticks
  const ticks: number[] = [];
  for (let v = lo; v <= hi + niceStep * 0.001; v += niceStep) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }

  return { domain: [lo, hi], ticks };
}

/* ───── Smart Y-axis formatter ───── */
function smartFormat(v: number, range: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(v / 1_000).toFixed(0)}k`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  // For small ranges (e.g. 0.01 - 0.05), show more precision
  if (range < 0.1) return v.toFixed(3);
  if (range < 1) return v.toFixed(2);
  if (range < 10) return v.toFixed(1);
  return v.toFixed(0);
}

/* ───── Smart X-axis date label formatter ───── */
function formatDateLabel(date: string, totalPoints: number): string {
  const d = new Date(date);
  // If date string is not a valid date (e.g. tenor labels "30d", "2029"), return as-is
  if (isNaN(d.getTime())) return date;
  if (totalPoints > 365) {
    // Years only for very long series
    return d.toLocaleDateString("pt-BR", { year: "numeric" });
  }
  if (totalPoints > 60) {
    return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/* ───── Rich Tooltip ───── */
interface TooltipPayloadEntry {
  value: number | string;
  name: string;
  color: string;
  dataKey: string;
}

interface RichTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  unit?: string;
}

const RichTooltip = ({ active, payload, label, unit }: RichTooltipProps) => {
  if (!active || !payload?.length) return null;

  // Sort: main value first, overlays last
  const sorted = [...payload].sort((a, b) => {
    const order = { value: 0, value2: 1, sma: 2, ema: 3, trend: 4 };
    return (order[a.dataKey as keyof typeof order] ?? 5) - (order[b.dataKey as keyof typeof order] ?? 5);
  });

  return (
    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-3 py-2 shadow-xl shadow-black/40 min-w-[160px]">
      <p className="text-[10px] text-zinc-500 font-mono mb-1.5 border-b border-[#1a1a1a] pb-1">{label}</p>
      {sorted.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-[10px] text-zinc-500 font-mono">{entry.name}</span>
          </div>
          <span className="text-sm font-bold font-mono text-zinc-200">
            {typeof entry.value === "number"
              ? entry.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
              : entry.value}
            {unit || ""}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ───── Export helpers ───── */
function exportCSV(data: MacroChartDataPoint[], title: string, label: string, label2?: string) {
  const header = label2 ? `Data,${label},${label2}` : `Data,${label}`;
  const rows = data.map((d) =>
    label2 ? `${d.date},${d.value},${d.value2 ?? ""}` : `${d.date},${d.value}`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportPNG(chartRef: React.RefObject<HTMLDivElement | null>, title: string) {
  const container = chartRef.current;
  if (!container) return;
  const svg = container.querySelector("svg");
  if (!svg) return;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    ctx.scale(2, 2);
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
}

/* ───── Recharts mouse event shape ───── */
interface ChartMouseEvent {
  activeLabel?: string;
}

/* ───── Main Chart Component ───── */
export const MacroChart = ({
  data, title, type = "line", color = "#0B6C3E", color2 = "#10B981",
  label = "Valor", label2, unit, height = 260, loading,
  refValue, refLabel, events,
}: MacroChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [zoomLeft, setZoomLeft] = useState<string | null>(null);
  const [zoomRight, setZoomRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set());
  const [showEvents, setShowEvents] = useState(false);

  const toggleOverlay = useCallback((o: Overlay) => {
    setOverlays(prev => {
      const next = new Set(prev);
      if (next.has(o)) next.delete(o);
      else next.add(o);
      return next;
    });
  }, []);

  /* ─── Compute overlay data ─── */
  const smaData = useMemo(() => {
    if (!overlays.has("sma") || data.length < 5) return null;
    const window = data.length >= 20 ? Math.round(data.length * 0.15) : 3;
    return sma(data as DataPoint[], Math.max(3, window));
  }, [data, overlays]);

  const emaData = useMemo(() => {
    if (!overlays.has("ema") || data.length < 5) return null;
    const window = data.length >= 20 ? Math.round(data.length * 0.15) : 3;
    return ema(data as DataPoint[], Math.max(3, window));
  }, [data, overlays]);

  const trendData = useMemo(() => {
    if (!overlays.has("trend") || data.length < 5) return null;
    return linearRegression(data as DataPoint[], 0);
  }, [data, overlays]);

  /* ─── Merge overlay data into formatted points ─── */
  const formattedData: FormattedDataPoint[] = useMemo(() => {
    const smaMap = new Map(smaData?.map(d => [d.date, d.value]));
    const emaMap = new Map(emaData?.map(d => [d.date, d.value]));
    const trendLine = trendData
      ? data.map((_, i) => trendData.slope * i + trendData.intercept)
      : null;

    return data.map((d, i) => ({
      ...d,
      dateLabel: formatDateLabel(d.date, data.length),
      ...(smaMap.has(d.date) ? { sma: smaMap.get(d.date) } : {}),
      ...(emaMap.has(d.date) ? { ema: emaMap.get(d.date) } : {}),
      ...(trendLine ? { trend: Math.round(trendLine[i] * 100) / 100 } : {}),
    }));
  }, [data, smaData, emaData, trendData]);

  const visibleData = useMemo(() => {
    if (!zoomDomain) return formattedData;
    return formattedData.slice(zoomDomain[0], zoomDomain[1] + 1);
  }, [formattedData, zoomDomain]);

  /* ─── Y-axis auto-scale ─── */
  const { yDomain, yTicks, valueRange } = useMemo(() => {
    const allValues: number[] = [];
    for (const d of visibleData) {
      allValues.push(d.value);
      if (d.value2 != null) allValues.push(d.value2);
      if (d.sma != null) allValues.push(d.sma);
      if (d.ema != null) allValues.push(d.ema);
      if (d.trend != null) allValues.push(d.trend);
    }
    if (refValue != null) allValues.push(refValue);
    const { domain, ticks } = computeYDomain(allValues);
    return {
      yDomain: domain,
      yTicks: ticks,
      valueRange: domain[1] - domain[0],
    };
  }, [visibleData, refValue]);

  /* ─── Summary stats for header ─── */
  const summaryStats = useMemo(() => {
    if (data.length < 2) return null;
    const last = data[data.length - 1].value;
    const first = data[0].value;
    const change = last - first;
    const changePct = first !== 0 ? (change / Math.abs(first)) * 100 : 0;
    const min = Math.min(...data.map(d => d.value));
    const max = Math.max(...data.map(d => d.value));
    return { last, change, changePct, min, max };
  }, [data]);

  const handleMouseDown = useCallback((e: ChartMouseEvent) => {
    if (e?.activeLabel) {
      setZoomLeft(e.activeLabel);
      setIsSelecting(true);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: ChartMouseEvent) => {
      if (isSelecting && e?.activeLabel) {
        setZoomRight(e.activeLabel);
      }
    },
    [isSelecting]
  );

  const handleMouseUp = useCallback(() => {
    if (zoomLeft && zoomRight && zoomLeft !== zoomRight) {
      const leftIdx = formattedData.findIndex((d) => d.dateLabel === zoomLeft);
      const rightIdx = formattedData.findIndex((d) => d.dateLabel === zoomRight);
      if (leftIdx >= 0 && rightIdx >= 0) {
        const start = Math.min(leftIdx, rightIdx);
        const end = Math.max(leftIdx, rightIdx);
        if (end - start > 1) {
          setZoomDomain([start, end]);
        }
      }
    }
    setZoomLeft(null);
    setZoomRight(null);
    setIsSelecting(false);
  }, [zoomLeft, zoomRight, formattedData]);

  const resetZoom = () => setZoomDomain(null);

  if (loading) {
    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
        <div className="h-3 bg-[#1a1a1a] rounded w-1/3 mb-4" />
        <div className="animate-pulse" style={{ height }}>
          <div className="h-full bg-[#0f0f0f] rounded" />
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
        <h3 className="text-xs font-medium text-zinc-500 font-mono mb-3">{title}</h3>
        <div className="flex items-center justify-center text-zinc-700 font-mono text-[10px]" style={{ height }}>
          Sem dados disponíveis
        </div>
      </div>
    );
  }

  /* ─── X-axis interval: adaptive to data density ─── */
  const xInterval = (() => {
    const n = visibleData.length;
    if (n <= 8) return 0; // show all
    if (n <= 20) return Math.floor(n / 6);
    if (n <= 60) return Math.floor(n / 8);
    return Math.floor(n / 10);
  })();

  const chartProps = {
    data: visibleData,
    margin: { top: 5, right: 10, left: 0, bottom: 0 },
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  };

  const axisProps = {
    xAxis: {
      dataKey: "dateLabel" as const,
      tick: { fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
      axisLine: { stroke: "#1a1a1a" },
      tickLine: false,
      interval: xInterval,
    },
    yAxis: {
      tick: { fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
      axisLine: false,
      tickLine: false,
      width: 60,
      domain: yDomain,
      ticks: yTicks,
      tickFormatter: (v: number) => smartFormat(v, valueRange),
    },
  };

  const crosshairStyle = { stroke: "#3f3f46", strokeDasharray: "3 3" };

  /* Zoom reference area for drag-to-select */
  const renderZoomArea = () => {
    if (!isSelecting || !zoomLeft || !zoomRight) return null;
    return (
      <ReferenceArea
        x1={zoomLeft}
        x2={zoomRight}
        strokeOpacity={0.3}
        fill="#0B6C3E"
        fillOpacity={0.1}
      />
    );
  };

  /* Overlay lines (shared across chart types) */
  const renderOverlays = () => (
    <>
      {overlays.has("sma") && smaData && (
        <Line
          type="monotone"
          dataKey="sma"
          name={`SMA(${smaData.length > 0 ? Math.round(data.length * 0.15) : 3})`}
          stroke="#F59E0B"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      )}
      {overlays.has("ema") && emaData && (
        <Line
          type="monotone"
          dataKey="ema"
          name={`EMA(${emaData.length > 0 ? Math.round(data.length * 0.15) : 3})`}
          stroke="#8B5CF6"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      )}
      {overlays.has("trend") && trendData && (
        <Line
          type="monotone"
          dataKey="trend"
          name={`Tendência (R²=${trendData.r2.toFixed(2)})`}
          stroke="#EF4444"
          strokeWidth={1.5}
          strokeDasharray="8 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      )}
    </>
  );

  /* Event overlay — COPOM / FOMC decisions mapped to nearest data point */
  const eventMarkers = useMemo(() => {
    if (!showEvents || !events?.length || !visibleData.length) return [];
    // Build a sorted array of data timestamps for binary-search mapping
    const dataPoints = visibleData
      .map((d) => ({ t: new Date(d.date).getTime(), label: d.dateLabel, raw: d.date }))
      .filter((p) => !Number.isNaN(p.t))
      .sort((a, b) => a.t - b.t);
    if (dataPoints.length === 0) return [];
    const minT = dataPoints[0].t;
    const maxT = dataPoints[dataPoints.length - 1].t;

    return events
      .map((e) => {
        const et = new Date(e.date).getTime();
        if (Number.isNaN(et) || et < minT || et > maxT) return null;
        // Find nearest data point
        let nearest = dataPoints[0];
        let bestDiff = Math.abs(et - nearest.t);
        for (let i = 1; i < dataPoints.length; i++) {
          const diff = Math.abs(et - dataPoints[i].t);
          if (diff < bestDiff) {
            bestDiff = diff;
            nearest = dataPoints[i];
          }
        }
        return { ...e, mappedLabel: nearest.label };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [showEvents, events, visibleData]);

  const renderEventMarkers = () => {
    if (!showEvents || eventMarkers.length === 0) return null;
    return eventMarkers.map((e, idx) => {
      const strokeColor =
        e.kind === "hike" ? "#EF4444" :
        e.kind === "cut" ? "#22C55E" :
        e.kind === "start" ? "#8B5CF6" :
        "#71717A";
      const showLabel = eventMarkers.length <= 20; // avoid clutter when too many
      return (
        <ReferenceLine
          key={`ev-${idx}-${e.date}`}
          x={e.mappedLabel}
          stroke={strokeColor}
          strokeDasharray="2 3"
          strokeOpacity={0.6}
          label={
            showLabel
              ? {
                  value: e.authority === "FOMC" ? "F" : "C",
                  position: "top",
                  fill: strokeColor,
                  fontSize: 9,
                  fontFamily: "JetBrains Mono, monospace",
                }
              : undefined
          }
        />
      );
    });
  };

  /* Reference line (e.g. meta/target) */
  const renderRefLine = () => {
    if (refValue == null) return null;
    return (
      <ReferenceLine
        y={refValue}
        stroke="#3f3f46"
        strokeDasharray="4 4"
        label={{
          value: refLabel || `${refValue}`,
          position: "right",
          fill: "#52525b",
          fontSize: 9,
          fontFamily: "JetBrains Mono, monospace",
        }}
      />
    );
  };

  /* Generic chart wrapper */
  const chartContent = (
    ChartComponent: typeof AreaChart | typeof BarChart | typeof LineChart,
    children: ReactNode
  ) => (
    <ChartComponent {...chartProps}>
      <CartesianGrid strokeDasharray="3 3" stroke="#141414" vertical={false} />
      <XAxis {...axisProps.xAxis} />
      <YAxis {...axisProps.yAxis} />
      <Tooltip
        content={<RichTooltip unit={unit} />}
        cursor={crosshairStyle}
        isAnimationActive={false}
      />
      {renderRefLine()}
      {renderEventMarkers()}
      {children}
      {type !== "bar" && renderOverlays()}
      {renderZoomArea()}
    </ChartComponent>
  );

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 group" ref={chartRef}>
      {/* Header with title + summary stats + actions */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-zinc-500 font-mono">{title}</h3>
          {summaryStats && (
            <span
              className={`text-[10px] font-mono font-semibold ${
                summaryStats.changePct > 0
                  ? "text-emerald-500"
                  : summaryStats.changePct < 0
                  ? "text-red-400"
                  : "text-zinc-600"
              }`}
            >
              {summaryStats.changePct > 0 ? "+" : ""}
              {summaryStats.changePct.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Overlay toggles */}
          {type !== "bar" && data.length >= 5 && (
            <>
              <button
                onClick={() => toggleOverlay("sma")}
                className={`p-1 rounded transition-colors text-[9px] font-mono ${
                  overlays.has("sma") ? "bg-amber-500/20 text-amber-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-[#1a1a1a]"
                }`}
                title="Média Móvel Simples"
              >
                SMA
              </button>
              <button
                onClick={() => toggleOverlay("ema")}
                className={`p-1 rounded transition-colors text-[9px] font-mono ${
                  overlays.has("ema") ? "bg-violet-500/20 text-violet-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-[#1a1a1a]"
                }`}
                title="Média Móvel Exponencial"
              >
                EMA
              </button>
              <button
                onClick={() => toggleOverlay("trend")}
                className={`p-1 rounded transition-colors ${
                  overlays.has("trend") ? "bg-red-500/20 text-red-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-[#1a1a1a]"
                }`}
                title="Linha de Tendência (Regressão Linear)"
              >
                <TrendingUp className="w-3 h-3" />
              </button>
              {events && events.length > 0 && (
                <button
                  onClick={() => setShowEvents((v) => !v)}
                  className={`p-1 rounded transition-colors text-[9px] font-mono ${
                    showEvents ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-600 hover:text-zinc-400 hover:bg-[#1a1a1a]"
                  }`}
                  title="COPOM / FOMC decisions overlay"
                >
                  EV
                </button>
              )}
              <div className="w-px h-3 bg-[#1a1a1a] mx-0.5" />
            </>
          )}
          {zoomDomain && (
            <button
              onClick={resetZoom}
              className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Resetar zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => exportCSV(data, title, label, label2)}
            className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Exportar CSV"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportPNG(chartRef, title)}
            className="p-1 rounded hover:bg-[#1a1a1a] text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Exportar PNG"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Range stats bar */}
      {summaryStats && (
        <div className="flex items-center gap-3 text-[9px] text-zinc-700 font-mono mb-2">
          <span>Últ: <span className="text-zinc-400">{summaryStats.last.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{unit || ""}</span></span>
          <span>Mín: <span className="text-zinc-500">{summaryStats.min.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span></span>
          <span>Máx: <span className="text-zinc-500">{summaryStats.max.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</span></span>
          {zoomDomain && (
            <span className="text-[#0B6C3E]">
              Zoom: {visibleData.length} pts &middot; ↺ resetar
            </span>
          )}
        </div>
      )}

      {/* Zoom hint */}
      {!zoomDomain && !summaryStats && (
        <p className="text-[9px] text-zinc-700 font-mono mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Arraste para zoom &middot; Hover para detalhes
        </p>
      )}

      {/* Active overlay legend */}
      {overlays.size > 0 && (
        <div className="flex items-center gap-3 text-[9px] font-mono mb-1">
          {overlays.has("sma") && <span className="text-amber-400 flex items-center gap-1"><Activity className="w-2.5 h-2.5" />SMA</span>}
          {overlays.has("ema") && <span className="text-violet-400 flex items-center gap-1"><Activity className="w-2.5 h-2.5" />EMA</span>}
          {overlays.has("trend") && trendData && (
            <span className={`flex items-center gap-1 ${trendData.slope > 0 ? "text-emerald-400" : trendData.slope < 0 ? "text-red-400" : "text-zinc-500"}`}>
              <TrendingUp className="w-2.5 h-2.5" />
              {trendData.slope > 0 ? "↑" : trendData.slope < 0 ? "↓" : "→"} R²={trendData.r2.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {type === "area"
          ? chartContent(
              AreaChart,
              <>
                <defs>
                  <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  name={label}
                  stroke={color}
                  fill={`url(#grad-${title})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: color, stroke: "#0a0a0a", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {label2 && (
                  <Area
                    type="monotone"
                    dataKey="value2"
                    name={label2}
                    stroke={color2}
                    fill="transparent"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </>
            )
          : type === "bar"
          ? chartContent(
              BarChart,
              <>
                <Bar dataKey="value" name={label} fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                {label2 && (
                  <Bar dataKey="value2" name={label2} fill={color2} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                )}
                <Legend
                  wrapperStyle={{
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                    color: "#52525b",
                  }}
                />
              </>
            )
          : chartContent(
              LineChart,
              <>
                <Line
                  type="monotone"
                  dataKey="value"
                  name={label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3, fill: color, stroke: "#0a0a0a", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {label2 && (
                  <Line
                    type="monotone"
                    dataKey="value2"
                    name={label2}
                    stroke={color2}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                <Legend
                  wrapperStyle={{
                    fontSize: 10,
                    fontFamily: "JetBrains Mono, monospace",
                    color: "#52525b",
                  }}
                />
              </>
            )}
      </ResponsiveContainer>
    </div>
  );
};
