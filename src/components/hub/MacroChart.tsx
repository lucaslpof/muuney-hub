import { useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceArea,
} from "recharts";
import { Download, ZoomIn, RotateCcw } from "lucide-react";

interface DataPoint {
  date: string;
  value: number;
  value2?: number;
}

interface FormattedDataPoint extends DataPoint {
  dateLabel: string;
}

interface MacroChartProps {
  data: DataPoint[];
  title: string;
  type?: "line" | "area" | "bar";
  color?: string;
  color2?: string;
  label?: string;
  label2?: string;
  unit?: string;
  height?: number;
  loading?: boolean;
}

/* ───── Rich Tooltip with crosshair styling ───── */
interface TooltipPayloadEntry {
  value: number | string;
  name: string;
  color: string;
}

interface RichTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  unit?: string;
}

const RichTooltip = ({ active, payload, label, unit }: RichTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md px-3 py-2 shadow-xl shadow-black/40 min-w-[140px]">
      <p className="text-[10px] text-zinc-500 font-mono mb-1.5 border-b border-[#1a1a1a] pb-1">{label}</p>
      {payload.map((entry, i) => (
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
function exportCSV(data: DataPoint[], title: string, label: string, label2?: string) {
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
}: MacroChartProps) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [zoomLeft, setZoomLeft] = useState<string | null>(null);
  const [zoomRight, setZoomRight] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null);

  const formattedData: FormattedDataPoint[] = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      })),
    [data]
  );

  const visibleData = useMemo(() => {
    if (!zoomDomain) return formattedData;
    return formattedData.slice(zoomDomain[0], zoomDomain[1] + 1);
  }, [formattedData, zoomDomain]);

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
      interval: Math.max(0, Math.floor(visibleData.length / 7)),
    },
    yAxis: {
      tick: { fill: "#52525b", fontSize: 10, fontFamily: "JetBrains Mono, monospace" },
      axisLine: false,
      tickLine: false,
      width: 55,
      tickFormatter: (v: number) =>
        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(1),
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

  /* Generic chart wrapper using React element type */
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
      {children}
      {renderZoomArea()}
    </ChartComponent>
  );

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 group" ref={chartRef}>
      {/* Header with title + actions */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-500 font-mono">{title}</h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Zoom hint */}
      {!zoomDomain && (
        <p className="text-[9px] text-zinc-700 font-mono mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Arraste para zoom &middot; Clique nos botões para exportar
        </p>
      )}
      {zoomDomain && (
        <p className="text-[9px] text-[#0B6C3E] font-mono mb-2">
          Zoom ativo — {visibleData.length} pontos &middot; Clique ↺ para resetar
        </p>
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
                  />
                )}
              </>
            )
          : type === "bar"
          ? chartContent(
              BarChart,
              <>
                <Bar dataKey="value" name={label} fill={color} radius={[2, 2, 0, 0]} />
                {label2 && (
                  <Bar dataKey="value2" name={label2} fill={color2} radius={[2, 2, 0, 0]} />
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
