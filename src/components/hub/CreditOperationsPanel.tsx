import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Filter, Search, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, Banknote, Percent, ShieldAlert,
  RotateCcw, Download, BarChart3, Info, X, ExternalLink,
} from "lucide-react";
import {
  useHubSeriesBundle,
  pickSeries,
  type SeriesBundle,
  type SeriesDataPoint,
} from "@/hooks/useHubData";
import { formatMonthShort, fmtNum } from "@/lib/format";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { exportCsv, csvFilename, type CsvColumn } from "@/lib/csvExport";

/* ═══════════════════════════════════════════════════════════════════════════
   PAINEL DE OPERAÇÕES DE CRÉDITO — BACEN SGS Query Builder (REAL CODES)
   Filters: Tipo Cliente · Recurso · Modalidade
   Panels: Saldo · Taxa · Inadimplência (time series charts + CSV export)
   Data policy: uses only real, ingested series. Modalidades sem cobertura via
   SGS mostram badge "dado indisponível" e taxa/inadim fazem fallback para
   o agregado por tipo+recurso (ex.: Livres PF) quando a série específica não
   existe (limitação estrutural BACEN — muitas séries por modalidade são
   descontinuadas ou não publicadas).
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Filter dimension types ─── */
type TipoCliente = "PF" | "PJ" | "Total";
type Recurso = "Livres" | "Direcionados" | "Total";

interface SeriesRef {
  cat: "saldo_credito" | "saldo_pf_modal" | "saldo_pj_modal" | "taxa" | "inadim_detalhe" | "inadimplencia";
  code: number;
  /** true when this code represents the PF/PJ/Recurso aggregate (not the specific modality). */
  aggregate?: boolean;
}

interface Modalidade {
  id: string;
  label: string;
  tipo: TipoCliente;
  recurso: Recurso;
  saldo: SeriesRef;
  taxa: SeriesRef;
  inadim: SeriesRef;
}

/* ─── BACEN SGS Operations Catalog — REAL ingested codes only ─── */
/* Verified against hub_macro_series_meta em 19/04/2026: todas as séries
 * listadas aqui existem no meta e (salvo quando explicitamente marcado)
 * possuem last_date dentro dos últimos 45 dias. Modalidades sem taxa/inadim
 * específica caem no agregado por tipo+recurso (flag aggregate=true).         */
const MODALIDADES: Modalidade[] = [
  // ── PF Livres ──
  {
    id: "pf_pessoal_nc",
    label: "Pessoal Não Consignado",
    tipo: "PF",
    recurso: "Livres",
    saldo: { cat: "saldo_pf_modal", code: 20570 },
    taxa: { cat: "taxa", code: 20740, aggregate: true }, // PF Livres agg
    inadim: { cat: "inadim_detalhe", code: 21087, aggregate: true }, // PF Livres agg
  },
  {
    id: "pf_consignado_inss",
    label: "Consignado INSS",
    tipo: "PF",
    recurso: "Livres",
    saldo: { cat: "saldo_pf_modal", code: 20572 },
    taxa: { cat: "taxa", code: 20740, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21087, aggregate: true },
  },
  {
    id: "pf_veiculos",
    label: "Veículos",
    tipo: "PF",
    recurso: "Livres",
    saldo: { cat: "saldo_credito", code: 20581 },
    taxa: { cat: "taxa", code: 20749 }, // taxa específica veículos PF
    inadim: { cat: "inadim_detalhe", code: 21087, aggregate: true },
  },
  {
    id: "pf_cartao",
    label: "Cartão de Crédito",
    tipo: "PF",
    recurso: "Livres",
    saldo: { cat: "saldo_credito", code: 20590 },
    taxa: { cat: "taxa", code: 20740, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21087, aggregate: true },
  },
  // ── PF Direcionados ──
  {
    id: "pf_rural",
    label: "Rural PF",
    tipo: "PF",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pf_modal", code: 20593 },
    taxa: { cat: "taxa", code: 20760, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21089, aggregate: true },
  },
  {
    id: "pf_habitacional",
    label: "Habitacional PF",
    tipo: "PF",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pf_modal", code: 20599 },
    taxa: { cat: "taxa", code: 20760, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21089, aggregate: true },
  },
  {
    id: "pf_bndes",
    label: "BNDES Repasses PF",
    tipo: "PF",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pf_modal", code: 20606 },
    taxa: { cat: "taxa", code: 20760, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21089, aggregate: true },
  },
  // ── PJ Livres ──
  {
    id: "pj_capital_giro",
    label: "Capital de Giro",
    tipo: "PJ",
    recurso: "Livres",
    saldo: { cat: "saldo_pj_modal", code: 20551 },
    taxa: { cat: "taxa", code: 20751, aggregate: true }, // PJ Livres agg
    inadim: { cat: "inadim_detalhe", code: 21088, aggregate: true }, // PJ Livres agg
  },
  {
    id: "pj_cartao_rotativo",
    label: "Cartão Rotativo PJ",
    tipo: "PJ",
    recurso: "Livres",
    saldo: { cat: "saldo_credito", code: 20561 },
    taxa: { cat: "taxa", code: 20751, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21088, aggregate: true },
  },
  // ── PJ Direcionados ──
  {
    id: "pj_rural",
    label: "Rural PJ",
    tipo: "PJ",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pj_modal", code: 20611 },
    taxa: { cat: "taxa", code: 20763, aggregate: true }, // PJ Direc agg
    inadim: { cat: "inadim_detalhe", code: 21090, aggregate: true }, // PJ Direc agg
  },
  {
    id: "pj_habitacional",
    label: "Habitacional PJ",
    tipo: "PJ",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pj_modal", code: 20614 },
    taxa: { cat: "taxa", code: 20763, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21090, aggregate: true },
  },
  {
    id: "pj_bndes",
    label: "BNDES Repasses PJ",
    tipo: "PJ",
    recurso: "Direcionados",
    saldo: { cat: "saldo_pj_modal", code: 20622 },
    taxa: { cat: "taxa", code: 20763, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21090, aggregate: true },
  },
  {
    id: "pj_direcionado_finan",
    label: "Financ. Direcionado PJ",
    tipo: "PJ",
    recurso: "Direcionados",
    saldo: { cat: "saldo_credito", code: 20602 },
    taxa: { cat: "taxa", code: 20763, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21090, aggregate: true },
  },
  // ── Agregados ──
  {
    id: "total_pf",
    label: "Total PF",
    tipo: "PF",
    recurso: "Total",
    saldo: { cat: "saldo_credito", code: 20541 },
    taxa: { cat: "taxa", code: 20714 },
    inadim: { cat: "inadimplencia", code: 21082 },
  },
  {
    id: "total_pj",
    label: "Total PJ",
    tipo: "PJ",
    recurso: "Total",
    saldo: { cat: "saldo_credito", code: 20542 },
    taxa: { cat: "taxa", code: 20715 },
    inadim: { cat: "inadimplencia", code: 21083 },
  },
  {
    id: "total_livres",
    label: "Total Livres SFN",
    tipo: "Total",
    recurso: "Livres",
    saldo: { cat: "saldo_credito", code: 20543 },
    taxa: { cat: "taxa", code: 20714, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21085 },
  },
  {
    id: "total_direcionados",
    label: "Total Direcionados SFN",
    tipo: "Total",
    recurso: "Direcionados",
    saldo: { cat: "saldo_credito", code: 20544 },
    taxa: { cat: "taxa", code: 20714, aggregate: true },
    inadim: { cat: "inadim_detalhe", code: 21086 }, // stale (2021-02), handled downstream
  },
  {
    id: "total_sfn",
    label: "Total SFN",
    tipo: "Total",
    recurso: "Total",
    saldo: { cat: "saldo_credito", code: 20540 },
    taxa: { cat: "taxa", code: 20714, aggregate: true },
    inadim: { cat: "inadimplencia", code: 21084 },
  },
];

/* ─── Period options ─── */
const PERIODS = ["6m", "1y", "2y", "5y", "10y"] as const;

/* ─── Colors (Tech-Noir palette — 8 series max) ─── */
const COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

/* ─── Unit normalization ──────────────────────────────────────────────
 * hub_macro_series_meta mistura unidades em saldo_credito: algumas séries
 * em "R$ milhões" (ex.: 20540, 20541) e outras em "R$ bi" (ex.: 20543).
 * Normalizamos tudo para R$ bi para os gráficos de Saldo.
 * ──────────────────────────────────────────────────────────────────── */
function normalizeToBi(points: SeriesDataPoint[], unit: string | undefined): SeriesDataPoint[] {
  const u = (unit ?? "").toLowerCase();
  if (u.includes("bi") || u.includes("bilh")) return points;
  if (u.includes("milh") || u.includes("mi")) {
    return points.map((p) => ({ date: p.date, value: p.value / 1_000 }));
  }
  return points;
}

/* ─── Format helpers ─── */
function fmtSaldoBi(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1_000) return `R$ ${fmtNum(v / 1_000, 2)} T`;
  if (Math.abs(v) >= 1) return `R$ ${fmtNum(v, 1)} bi`;
  return `R$ ${fmtNum(v * 1_000, 0)} mi`;
}

/* ─── Tooltip ─── */
interface TooltipPayload {
  value: number;
  name: string;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900/95 border border-zinc-800/80 rounded-lg p-2.5 shadow-xl backdrop-blur">
      <div className="text-[9px] text-zinc-500 font-mono mb-1.5 uppercase tracking-wider">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-zinc-400 truncate max-w-[160px]">{p.name}:</span>
          <span className="text-zinc-100 font-bold">
            {typeof p.value === "number" ? fmtNum(p.value, 2) : p.value}
            {unit !== "R$ bi" ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── FilterPill ─── */
function FilterPill({
  label,
  active,
  onClick,
  count,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`px-2.5 py-1 text-[10px] font-mono rounded-md transition-all whitespace-nowrap ${
        active
          ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
          : "bg-zinc-900/50 text-zinc-500 border border-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1 text-[8px] opacity-60">({count})</span>}
    </button>
  );
}

/* ─── OperationCard — summary card for a selected modalidade ─── */
function OperationCard({
  mod,
  color,
  saldoData,
  taxaData,
  inadimData,
  hasSaldo,
}: {
  mod: Modalidade;
  color: string;
  saldoData: SeriesDataPoint[];
  taxaData: SeriesDataPoint[];
  inadimData: SeriesDataPoint[];
  hasSaldo: boolean;
}) {
  const lastSaldo = saldoData.length ? saldoData[saldoData.length - 1].value : 0;
  const prevSaldo = saldoData.length >= 2 ? saldoData[saldoData.length - 2].value : lastSaldo;
  const saldoChg = prevSaldo ? ((lastSaldo - prevSaldo) / prevSaldo) * 100 : 0;

  const lastTaxa = taxaData.length ? taxaData[taxaData.length - 1].value : null;
  const lastInad = inadimData.length ? inadimData[inadimData.length - 1].value : null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-[11px] font-mono text-zinc-200 font-bold truncate">{mod.label}</span>
        <span className="text-[8px] text-zinc-600 ml-auto font-mono flex-shrink-0">
          {mod.tipo} · {mod.recurso}
        </span>
      </div>
      {!hasSaldo ? (
        <div className="text-[9px] font-mono text-amber-400/70 py-2 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          Série indisponível via BACEN SGS
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="text-[8px] text-zinc-600 font-mono">Saldo</div>
            <div className="text-[11px] text-zinc-100 font-bold font-mono">{fmtSaldoBi(lastSaldo)}</div>
            <div
              className={`text-[9px] font-mono flex items-center gap-0.5 ${
                saldoChg >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {saldoChg >= 0 ? (
                <TrendingUp className="w-2.5 h-2.5" />
              ) : (
                <TrendingDown className="w-2.5 h-2.5" />
              )}
              {saldoChg >= 0 ? "+" : ""}
              {fmtNum(saldoChg, 1)}%
            </div>
          </div>
          <div>
            <div className="text-[8px] text-zinc-600 font-mono flex items-center gap-0.5">
              Taxa
              {mod.taxa.aggregate && (
                <span title="Taxa agregada (tipo+recurso) — BACEN SGS não publica taxa específica por modalidade">
                  <Info className="w-2 h-2 text-zinc-700" />
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-100 font-bold font-mono">
              {lastTaxa != null ? `${fmtNum(lastTaxa, 1)}%` : "—"}
            </div>
            <div className="text-[8px] text-zinc-700 font-mono">a.a.</div>
          </div>
          <div>
            <div className="text-[8px] text-zinc-600 font-mono flex items-center gap-0.5">
              Inadim.
              {mod.inadim.aggregate && (
                <span title="Inadimplência agregada (tipo+recurso) — série específica não publicada pelo BACEN">
                  <Info className="w-2 h-2 text-zinc-700" />
                </span>
              )}
            </div>
            <div
              className={`text-[11px] font-bold font-mono ${
                lastInad == null
                  ? "text-zinc-500"
                  : lastInad > 5
                    ? "text-red-400"
                    : lastInad > 3
                      ? "text-amber-400"
                      : "text-emerald-400"
              }`}
            >
              {lastInad != null ? `${fmtNum(lastInad, 2)}%` : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ChartPanel — Reusable time-series chart section ─── */
function ChartPanel({
  title,
  icon,
  series,
  unit,
  chartType = "line",
  exportTag,
}: {
  title: string;
  icon: React.ReactNode;
  series: { label: string; data: SeriesDataPoint[]; color: string; modId: string }[];
  unit: string;
  chartType?: "line" | "area" | "bar";
  exportTag: string;
}) {
  const [expanded, setExpanded] = useState(true);

  // Merge all series into a single dataset for recharts (outer join por data).
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();
    series.forEach((s) => {
      s.data.forEach((d) => {
        if (!dateMap.has(d.date)) {
          dateMap.set(d.date, { date: d.date, dateLabel: formatMonthShort(d.date) });
        }
        dateMap.get(d.date)![s.label] = d.value;
      });
    });
    return Array.from(dateMap.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [series]);

  const hasData = series.some((s) => s.data.length > 0);

  const downloadCSV = useCallback(() => {
    if (!hasData) return;
    type Row = Record<string, number | string>;
    const columns: CsvColumn<Row>[] = [
      { header: "data", accessor: (r) => String(r.date ?? "") },
      ...series.map((s) => ({
        header: s.label,
        accessor: (r: Row) => (typeof r[s.label] === "number" ? (r[s.label] as number) : ""),
      })),
    ];
    exportCsv(chartData as Row[], columns, csvFilename("credito_operacoes", exportTag));
  }, [chartData, series, hasData, exportTag]);

  if (!series.length) return null;

  const Chart = chartType === "area" ? AreaChart : chartType === "bar" ? BarChart : LineChart;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-bold text-zinc-100 font-mono">{title}</span>
          <span className="text-[9px] text-zinc-600 font-mono">
            {series.length} série{series.length !== 1 ? "s" : ""} · {unit}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadCSV();
            }}
            disabled={!hasData}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            title={hasData ? "Exportar CSV (pt-BR, ;)" : "Sem dados para exportar"}
            aria-label="Exportar CSV"
          >
            <Download className="w-3 h-3" />
          </button>
          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            {series.map((s) => (
              <div key={s.modId} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-[9px] text-zinc-500 font-mono">{s.label}</span>
                {s.data.length === 0 && (
                  <span className="text-[8px] text-amber-500/70 font-mono italic">(sem dados)</span>
                )}
              </div>
            ))}
          </div>

          {!hasData ? (
            <div className="py-12 flex flex-col items-center gap-2 text-center">
              <AlertTriangle className="w-5 h-5 text-amber-500/50" />
              <span className="text-[10px] text-zinc-500 font-mono">
                Série indisponível via BACEN SGS para as modalidades selecionadas
              </span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <Chart data={chartData}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#1a1a1a" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                  tickFormatter={(v: number) => fmtNum(v, v >= 100 ? 0 : 1)}
                />
                <Tooltip content={<CustomTooltip unit={unit} />} />
                {series.map((s) =>
                  chartType === "area" ? (
                    <Area
                      key={s.modId}
                      type="monotone"
                      dataKey={s.label}
                      stroke={s.color}
                      fill={s.color}
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  ) : chartType === "bar" ? (
                    <Bar
                      key={s.modId}
                      dataKey={s.label}
                      fill={s.color}
                      fillOpacity={0.7}
                      radius={[2, 2, 0, 0]}
                    />
                  ) : (
                    <Line
                      key={s.modId}
                      type="monotone"
                      dataKey={s.label}
                      stroke={s.color}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: s.color }}
                      connectNulls
                    />
                  ),
                )}
              </Chart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── ComparisonTable ─── */
function ComparisonTable({
  mods,
  seriesMap,
  onDrillDown,
}: {
  mods: Modalidade[];
  seriesMap: Record<string, { saldo: SeriesDataPoint[]; taxa: SeriesDataPoint[]; inadim: SeriesDataPoint[]; hasSaldo: boolean }>;
  onDrillDown?: (modId: string) => void;
}) {
  const [sortKey, setSortKey] = useState<"label" | "saldo" | "taxa" | "inadim">("saldo");
  const [sortDesc, setSortDesc] = useState(true);

  const rows = useMemo(() => {
    return mods
      .map((m) => {
        const d = seriesMap[m.id] || { saldo: [], taxa: [], inadim: [], hasSaldo: false };
        const lastSaldo = d.saldo.length ? d.saldo[d.saldo.length - 1].value : null;
        const lastTaxa = d.taxa.length ? d.taxa[d.taxa.length - 1].value : null;
        const lastInadim = d.inadim.length ? d.inadim[d.inadim.length - 1].value : null;
        const prevSaldo = d.saldo.length >= 2 ? d.saldo[d.saldo.length - 2].value : lastSaldo;
        const saldoChg =
          lastSaldo != null && prevSaldo != null && prevSaldo !== 0
            ? ((lastSaldo - prevSaldo) / prevSaldo) * 100
            : null;
        return { ...m, lastSaldo, lastTaxa, lastInadim, saldoChg, hasSaldo: d.hasSaldo };
      })
      .sort((a, b) => {
        const valA =
          sortKey === "label"
            ? a.label
            : sortKey === "saldo"
              ? a.lastSaldo
              : sortKey === "taxa"
                ? a.lastTaxa
                : a.lastInadim;
        const valB =
          sortKey === "label"
            ? b.label
            : sortKey === "saldo"
              ? b.lastSaldo
              : sortKey === "taxa"
                ? b.lastTaxa
                : b.lastInadim;
        if (sortKey === "label") {
          return sortDesc
            ? String(valB).localeCompare(String(valA))
            : String(valA).localeCompare(String(valB));
        }
        const nA = valA == null ? -Infinity : (valA as number);
        const nB = valB == null ? -Infinity : (valB as number);
        return sortDesc ? nB - nA : nA - nB;
      });
  }, [mods, seriesMap, sortKey, sortDesc]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => (
    <span className="ml-0.5 inline-flex">
      {sortKey === col ? (
        sortDesc ? (
          <ChevronDown className="w-2.5 h-2.5" />
        ) : (
          <ChevronUp className="w-2.5 h-2.5" />
        )
      ) : null}
    </span>
  );

  const handleExport = useCallback(() => {
    const columns: CsvColumn<typeof rows[number]>[] = [
      { header: "modalidade", accessor: (r) => r.label },
      { header: "tipo", accessor: (r) => r.tipo },
      { header: "recurso", accessor: (r) => r.recurso },
      { header: "saldo_bi", accessor: (r) => (r.lastSaldo != null ? fmtNum(r.lastSaldo, 2) : "") },
      { header: "var_mom_pct", accessor: (r) => (r.saldoChg != null ? fmtNum(r.saldoChg, 2) : "") },
      { header: "taxa_aa_pct", accessor: (r) => (r.lastTaxa != null ? fmtNum(r.lastTaxa, 2) : "") },
      { header: "inadim_pct", accessor: (r) => (r.lastInadim != null ? fmtNum(r.lastInadim, 2) : "") },
      { header: "sgs_saldo", accessor: (r) => r.saldo.code },
      { header: "sgs_taxa", accessor: (r) => r.taxa.code },
      { header: "sgs_inadim", accessor: (r) => r.inadim.code },
    ];
    exportCsv(rows, columns, csvFilename("credito_operacoes", "comparativo"));
  }, [rows]);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5 text-[#10B981]" />
        <span className="text-[11px] font-bold text-zinc-100 font-mono">Comparativo de Modalidades</span>
        <span className="text-[9px] text-zinc-600 font-mono">{rows.length} modalidades</span>
        {onDrillDown && (
          <span className="text-[8px] text-zinc-600 font-mono italic hidden sm:inline-block">
            · clique para detalhar
          </span>
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={!rows.length}
          className="ml-auto p-1 rounded hover:bg-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-30"
          title="Exportar comparativo (CSV pt-BR)"
          aria-label="Exportar CSV"
        >
          <Download className="w-3 h-3" />
        </button>
      </div>
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-800/30">
              {(
                [
                  ["label", "Modalidade"],
                  ["saldo", "Saldo (R$ bi)"],
                  ["taxa", "Taxa (% a.a.)"],
                  ["inadim", "Inadim. (%)"],
                ] as [typeof sortKey, string][]
              ).map(([key, lbl]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-3 py-2 text-[9px] font-mono text-zinc-500 text-left cursor-pointer hover:text-zinc-300 transition-colors whitespace-nowrap uppercase tracking-wider"
                >
                  {lbl}
                  <SortIcon col={key} />
                </th>
              ))}
              <th className="px-3 py-2 text-[9px] font-mono text-zinc-500 text-left uppercase tracking-wider">
                Var. MoM
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                onClick={() => onDrillDown?.(r.id)}
                onKeyDown={(e) => {
                  if (onDrillDown && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onDrillDown(r.id);
                  }
                }}
                role={onDrillDown ? "button" : undefined}
                tabIndex={onDrillDown ? 0 : undefined}
                aria-label={onDrillDown ? `Detalhar ${r.label}` : undefined}
                className={`border-b border-[#111] ${i % 2 === 0 ? "bg-[#0a0a0a]" : ""} ${
                  onDrillDown
                    ? "cursor-pointer hover:bg-[#10B981]/8 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#10B981]/50"
                    : "hover:bg-zinc-900/50"
                } transition-colors`}
              >
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-200">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate">{r.label}</span>
                    {!r.hasSaldo && (
                      <span className="text-[8px] text-amber-500/70">⚠</span>
                    )}
                    {onDrillDown && r.hasSaldo && (
                      <ExternalLink className="w-2.5 h-2.5 text-zinc-700 flex-shrink-0 ml-auto" />
                    )}
                  </div>
                  <span className="text-[8px] text-zinc-600">
                    {r.tipo} · {r.recurso}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-100 font-bold">
                  {r.lastSaldo != null ? fmtNum(r.lastSaldo, 2) : "—"}
                </td>
                <td className="px-3 py-2 text-[10px] font-mono text-zinc-100">
                  {r.lastTaxa != null ? fmtNum(r.lastTaxa, 1) : "—"}
                  {r.taxa.aggregate && r.lastTaxa != null && (
                    <span className="ml-0.5 text-[8px] text-zinc-700" title="Agregado">
                      ⓘ
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-[10px] font-mono font-bold ${
                    r.lastInadim == null
                      ? "text-zinc-500"
                      : r.lastInadim > 5
                        ? "text-red-400"
                        : r.lastInadim > 3
                          ? "text-amber-400"
                          : "text-emerald-400"
                  }`}
                >
                  {r.lastInadim != null ? fmtNum(r.lastInadim, 2) : "—"}
                  {r.inadim.aggregate && r.lastInadim != null && (
                    <span className="ml-0.5 text-[8px] text-zinc-700" title="Agregado">
                      ⓘ
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-[10px] font-mono ${
                    r.saldoChg == null
                      ? "text-zinc-500"
                      : r.saldoChg >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                  }`}
                >
                  {r.saldoChg == null
                    ? "—"
                    : `${r.saldoChg >= 0 ? "+" : ""}${fmtNum(r.saldoChg, 1)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ModalityDetailDrawer — drill-down modal por modalidade
   - Série histórica (5y) de Saldo, Taxa e Inadimplência
   - Benchmark peer: média das outras modalidades do mesmo tipo+recurso
   - KPIs: nível atual vs peer médio, delta MoM, delta 12m
   ═══════════════════════════════════════════════════════════════════════════ */

interface DrawerData {
  saldo: SeriesDataPoint[];
  taxa: SeriesDataPoint[];
  inadim: SeriesDataPoint[];
  hasSaldo: boolean;
}

function meanByDate(seriesList: SeriesDataPoint[][]): SeriesDataPoint[] {
  // Build a per-date sum + count, then collapse to mean. O(N) where N is total points.
  const acc = new Map<string, { sum: number; n: number }>();
  for (const s of seriesList) {
    for (const p of s) {
      if (!Number.isFinite(p.value)) continue;
      const cur = acc.get(p.date);
      if (cur) {
        cur.sum += p.value;
        cur.n += 1;
      } else {
        acc.set(p.date, { sum: p.value, n: 1 });
      }
    }
  }
  const out: SeriesDataPoint[] = [];
  for (const [date, { sum, n }] of acc) {
    out.push({ date, value: sum / n });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

function lastValue(s: SeriesDataPoint[]): number | null {
  return s.length ? s[s.length - 1].value : null;
}
function valueAtIndex(s: SeriesDataPoint[], offsetFromEnd: number): number | null {
  const idx = s.length - 1 - offsetFromEnd;
  if (idx < 0) return null;
  return s[idx].value;
}

function DrawerKPI({
  label,
  current,
  peer,
  unit,
  digits = 2,
  lowerIsBetter = false,
}: {
  label: string;
  current: number | null;
  peer: number | null;
  unit: string;
  digits?: number;
  lowerIsBetter?: boolean;
}) {
  const fmt = (v: number | null) =>
    v == null || !Number.isFinite(v) ? "—" : `${fmtNum(v, digits)}${unit}`;
  const delta =
    current != null && peer != null && Number.isFinite(current) && Number.isFinite(peer)
      ? current - peer
      : null;
  const aboveBenchmark = delta != null && delta > 0;
  const goodSign = delta == null ? null : lowerIsBetter ? !aboveBenchmark : aboveBenchmark;
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-md p-3">
      <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-[15px] font-bold text-zinc-100 font-mono tabular-nums">
          {fmt(current)}
        </div>
        {delta != null && (
          <div
            className={`text-[10px] font-mono ${
              goodSign ? "text-emerald-400" : "text-red-400"
            }`}
            title={`Δ vs peer médio: ${delta > 0 ? "+" : ""}${fmtNum(delta, digits)}${unit}`}
          >
            {delta > 0 ? "+" : ""}
            {fmtNum(delta, digits)}
            {unit}
          </div>
        )}
      </div>
      <div className="text-[9px] text-zinc-600 font-mono mt-0.5">
        Peer médio: {fmt(peer)}
      </div>
    </div>
  );
}

function DrawerChart({
  title,
  unit,
  modSeries,
  peerSeries,
  color,
  chartType = "line",
}: {
  title: string;
  unit: string;
  modSeries: SeriesDataPoint[];
  peerSeries: SeriesDataPoint[];
  color: string;
  chartType?: "line" | "area";
}) {
  const data = useMemo(() => {
    const map = new Map<string, { date: string; dateLabel: string; mod?: number; peer?: number }>();
    modSeries.forEach((p) => {
      map.set(p.date, { date: p.date, dateLabel: formatMonthShort(p.date), mod: p.value });
    });
    peerSeries.forEach((p) => {
      const cur = map.get(p.date);
      if (cur) cur.peer = p.value;
      else map.set(p.date, { date: p.date, dateLabel: formatMonthShort(p.date), peer: p.value });
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [modSeries, peerSeries]);

  const Chart = chartType === "area" ? AreaChart : LineChart;
  const hasData = modSeries.length > 0;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-mono font-bold text-zinc-200 uppercase tracking-wider">
          {title}
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-zinc-400">Modalidade</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-px bg-zinc-500" style={{ borderTop: "1px dashed #71717a" }} />
            <span className="text-zinc-500">Peer médio</span>
          </div>
        </div>
      </div>
      {!hasData ? (
        <div className="py-10 text-center text-[10px] font-mono text-zinc-600">
          Sem dados na janela.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <Chart data={data}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dateLabel"
              tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
              axisLine={{ stroke: "#1a1a1a" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#52525b", fontSize: 9, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => fmtNum(v, v >= 100 ? 0 : 1)}
            />
            <Tooltip content={<CustomTooltip unit={unit} />} />
            {chartType === "area" ? (
              <>
                <Area
                  type="monotone"
                  dataKey="mod"
                  name="Modalidade"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.18}
                  strokeWidth={1.6}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="peer"
                  name="Peer médio"
                  stroke="#71717a"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  dot={false}
                  connectNulls
                />
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="mod"
                  name="Modalidade"
                  stroke={color}
                  strokeWidth={1.6}
                  dot={false}
                  activeDot={{ r: 3, fill: color }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="peer"
                  name="Peer médio"
                  stroke="#71717a"
                  strokeDasharray="3 3"
                  strokeWidth={1.2}
                  dot={false}
                  connectNulls
                />
              </>
            )}
          </Chart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function ModalityDetailDrawer({
  mod,
  modData,
  peerSaldoMean,
  peerTaxaMean,
  peerInadimMean,
  peerCount,
  onClose,
}: {
  mod: Modalidade;
  modData: DrawerData;
  peerSaldoMean: SeriesDataPoint[];
  peerTaxaMean: SeriesDataPoint[];
  peerInadimMean: SeriesDataPoint[];
  peerCount: number;
  onClose: () => void;
}) {
  // ESC closes the drawer.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    // lock body scroll while open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const saldoNow = lastValue(modData.saldo);
  const taxaNow = lastValue(modData.taxa);
  const inadimNow = lastValue(modData.inadim);
  const peerSaldoNow = lastValue(peerSaldoMean);
  const peerTaxaNow = lastValue(peerTaxaMean);
  const peerInadimNow = lastValue(peerInadimMean);

  // 12m delta on the modality's own series.
  const saldoDelta12m = useMemo(() => {
    const cur = saldoNow;
    const prev = valueAtIndex(modData.saldo, 12);
    if (cur == null || prev == null || !prev) return null;
    return ((cur - prev) / Math.abs(prev)) * 100;
  }, [modData.saldo, saldoNow]);
  const taxaDelta12m = useMemo(() => {
    const cur = taxaNow;
    const prev = valueAtIndex(modData.taxa, 12);
    if (cur == null || prev == null) return null;
    return cur - prev;
  }, [modData.taxa, taxaNow]);
  const inadimDelta12m = useMemo(() => {
    const cur = inadimNow;
    const prev = valueAtIndex(modData.inadim, 12);
    if (cur == null || prev == null) return null;
    return cur - prev;
  }, [modData.inadim, inadimNow]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm no-print"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modality-drawer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto bg-[#0a0a0a] border border-zinc-800/80 rounded-t-2xl sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-zinc-800/60 px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[#10B981]">
              Detalhamento de modalidade
            </div>
            <h3
              id="modality-drawer-title"
              className="text-sm font-bold text-zinc-100 font-mono truncate"
            >
              {mod.label}
            </h3>
            <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
              {mod.tipo} · {mod.recurso} · SGS saldo {mod.saldo.code} · taxa {mod.taxa.code}
              {mod.taxa.aggregate ? " (agg)" : ""} · inadim {mod.inadim.code}
              {mod.inadim.aggregate ? " (agg)" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Fechar detalhamento"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Context strip */}
          <div className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            Comparando esta modalidade contra a média de{" "}
            <span className="text-zinc-300">{peerCount}</span>{" "}
            modalidade{peerCount === 1 ? "" : "s"} peer{" "}
            <span className="text-zinc-600">
              ({mod.tipo === "Total" ? "totais SFN" : `${mod.tipo} ${mod.recurso}`})
            </span>
            . Janela: até 5 anos disponíveis no BACEN SGS.
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <DrawerKPI
              label="Saldo (R$ bi)"
              current={saldoNow}
              peer={peerSaldoNow}
              unit=""
              digits={2}
              lowerIsBetter={false}
            />
            <DrawerKPI
              label="Taxa a.a."
              current={taxaNow}
              peer={peerTaxaNow}
              unit="%"
              digits={2}
              lowerIsBetter={true}
            />
            <DrawerKPI
              label="Inadim. >90d"
              current={inadimNow}
              peer={peerInadimNow}
              unit="%"
              digits={2}
              lowerIsBetter={true}
            />
          </div>

          {/* 12m deltas strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono">
            <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-md px-3 py-2">
              <span className="text-zinc-500">Δ Saldo 12m: </span>
              <span
                className={
                  saldoDelta12m == null
                    ? "text-zinc-500"
                    : saldoDelta12m >= 0
                      ? "text-emerald-400 font-bold"
                      : "text-red-400 font-bold"
                }
              >
                {saldoDelta12m == null
                  ? "—"
                  : `${saldoDelta12m >= 0 ? "+" : ""}${fmtNum(saldoDelta12m, 1)}%`}
              </span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-md px-3 py-2">
              <span className="text-zinc-500">Δ Taxa 12m: </span>
              <span
                className={
                  taxaDelta12m == null
                    ? "text-zinc-500"
                    : taxaDelta12m <= 0
                      ? "text-emerald-400 font-bold"
                      : "text-red-400 font-bold"
                }
              >
                {taxaDelta12m == null
                  ? "—"
                  : `${taxaDelta12m >= 0 ? "+" : ""}${fmtNum(taxaDelta12m, 2)} p.p.`}
              </span>
            </div>
            <div className="bg-zinc-900/30 border border-zinc-800/40 rounded-md px-3 py-2">
              <span className="text-zinc-500">Δ Inadim. 12m: </span>
              <span
                className={
                  inadimDelta12m == null
                    ? "text-zinc-500"
                    : inadimDelta12m <= 0
                      ? "text-emerald-400 font-bold"
                      : "text-red-400 font-bold"
                }
              >
                {inadimDelta12m == null
                  ? "—"
                  : `${inadimDelta12m >= 0 ? "+" : ""}${fmtNum(inadimDelta12m, 2)} p.p.`}
              </span>
            </div>
          </div>

          {/* Charts */}
          <div className="space-y-3">
            <DrawerChart
              title="Saldo histórico vs peer"
              unit="R$ bi"
              modSeries={modData.saldo}
              peerSeries={peerSaldoMean}
              color="#10B981"
              chartType="area"
            />
            <DrawerChart
              title="Taxa histórica vs peer"
              unit="%"
              modSeries={modData.taxa}
              peerSeries={peerTaxaMean}
              color="#6366F1"
            />
            <DrawerChart
              title="Inadimplência histórica vs peer"
              unit="%"
              modSeries={modData.inadim}
              peerSeries={peerInadimMean}
              color="#EF4444"
            />
          </div>

          {/* Footer note */}
          <div className="text-[8px] text-zinc-700 font-mono pt-2 border-t border-zinc-800/30">
            Peer médio: média aritmética simples das séries das outras modalidades do mesmo
            recorte (tipo + recurso). Use ESC ou clique fora para fechar.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
/**
 * URL query param namespace for this panel's filters. Prefixed with `op_` to
 * avoid colliding with HubCredito-level params (?section=, ?period=).
 *   - op_tipo=PF|PJ|Total
 *   - op_rec=Livres|Direcionados|Total
 *   - op_period=1m|3m|6m|1y|2y|5y|all
 *   - op_mods=id1,id2,id3  (comma-separated modalidade ids)
 *   - op_table=0|1
 */
const VALID_TIPO = new Set(["PF", "PJ", "Total"]);
const VALID_RECURSO = new Set(["Livres", "Direcionados", "Total"]);
const VALID_PERIOD = new Set(["1m", "3m", "6m", "1y", "2y", "5y", "all"]);

export function CreditOperationsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ─── State (hydrated from URL on first render) ─── */
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>(() => {
    const v = searchParams.get("op_tipo");
    return v && VALID_TIPO.has(v) ? (v as TipoCliente) : "PF";
  });
  const [recurso, setRecurso] = useState<Recurso>(() => {
    const v = searchParams.get("op_rec");
    return v && VALID_RECURSO.has(v) ? (v as Recurso) : "Livres";
  });
  const [selectedMods, setSelectedMods] = useState<string[]>(() => {
    const v = searchParams.get("op_mods");
    if (!v) return [];
    return v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  });
  const [period, setPeriod] = useState<string>(() => {
    const v = searchParams.get("op_period");
    return v && VALID_PERIOD.has(v) ? v : "2y";
  });
  const [showTable, setShowTable] = useState(() => searchParams.get("op_table") !== "0");
  const [detailModalityId, setDetailModalityId] = useState<string | null>(null);

  /* ─── Sync state → URL (replace to preserve history navigation) ─── */
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, value: string, defaultValue: string) => {
      if (value === defaultValue) next.delete(key);
      else next.set(key, value);
    };
    setOrDelete("op_tipo", tipoCliente, "PF");
    setOrDelete("op_rec", recurso, "Livres");
    setOrDelete("op_period", period, "2y");
    if (selectedMods.length === 0) next.delete("op_mods");
    else next.set("op_mods", selectedMods.join(","));
    if (showTable) next.delete("op_table");
    else next.set("op_table", "0");
    // avoid spurious updates if the string already matches
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoCliente, recurso, period, selectedMods, showTable]);

  /* ─── Fetch 6 category bundles at page `period` (all credit operations live here) ─── */
  const saldoCreditoBundle = useHubSeriesBundle("saldo_credito", period, "credito");
  const saldoPFBundle = useHubSeriesBundle("saldo_pf_modal", period, "credito");
  const saldoPJBundle = useHubSeriesBundle("saldo_pj_modal", period, "credito");
  const taxaBundle = useHubSeriesBundle("taxa", period, "credito");
  const inadimDetalheBundle = useHubSeriesBundle("inadim_detalhe", period, "credito");
  const inadimplenciaBundle = useHubSeriesBundle("inadimplencia", period, "credito");

  /* ─── Drill-down 5y bundles (lazy-enabled only when drawer is open) ─── */
  const drillEnabled = detailModalityId != null;
  const saldoCreditoBundle5y = useHubSeriesBundle("saldo_credito", "5y", "credito", drillEnabled);
  const saldoPFBundle5y = useHubSeriesBundle("saldo_pf_modal", "5y", "credito", drillEnabled);
  const saldoPJBundle5y = useHubSeriesBundle("saldo_pj_modal", "5y", "credito", drillEnabled);
  const taxaBundle5y = useHubSeriesBundle("taxa", "5y", "credito", drillEnabled);
  const inadimDetalheBundle5y = useHubSeriesBundle("inadim_detalhe", "5y", "credito", drillEnabled);
  const inadimplenciaBundle5y = useHubSeriesBundle("inadimplencia", "5y", "credito", drillEnabled);

  const isLoading =
    saldoCreditoBundle.isLoading ||
    saldoPFBundle.isLoading ||
    saldoPJBundle.isLoading ||
    taxaBundle.isLoading ||
    inadimDetalheBundle.isLoading ||
    inadimplenciaBundle.isLoading;

  const drillLoading =
    drillEnabled &&
    (saldoCreditoBundle5y.isLoading ||
      saldoPFBundle5y.isLoading ||
      saldoPJBundle5y.isLoading ||
      taxaBundle5y.isLoading ||
      inadimDetalheBundle5y.isLoading ||
      inadimplenciaBundle5y.isLoading);

  /* ─── Filtered modalidades ─── */
  const filteredMods = useMemo(() => {
    return MODALIDADES.filter((m) => {
      const matchTipo = tipoCliente === "Total" ? m.tipo === "Total" : m.tipo === tipoCliente;
      const matchRecurso = recurso === "Total" ? m.recurso === "Total" : m.recurso === recurso;
      return matchTipo && matchRecurso;
    });
  }, [tipoCliente, recurso]);

  /* Auto-select first 3 when filters change */
  const activeMods = useMemo(() => {
    if (selectedMods.length > 0) {
      const valid = selectedMods.filter((id) => filteredMods.some((m) => m.id === id));
      if (valid.length > 0) return valid;
    }
    return filteredMods.slice(0, 3).map((m) => m.id);
  }, [selectedMods, filteredMods]);

  const toggleMod = useCallback((id: string) => {
    setSelectedMods((prev) => {
      const exists = prev.includes(id);
      if (exists) return prev.filter((x) => x !== id);
      return [...prev, id].slice(-6); // max 6 concurrent
    });
  }, []);

  const modObjects = useMemo(
    () => activeMods.map((id) => MODALIDADES.find((m) => m.id === id)!).filter(Boolean),
    [activeMods],
  );

  /* ─── Bundle resolver by category ─── */
  const getBundle = useCallback(
    (cat: SeriesRef["cat"]): SeriesBundle | undefined => {
      switch (cat) {
        case "saldo_credito":
          return saldoCreditoBundle.data;
        case "saldo_pf_modal":
          return saldoPFBundle.data;
        case "saldo_pj_modal":
          return saldoPJBundle.data;
        case "taxa":
          return taxaBundle.data;
        case "inadim_detalhe":
          return inadimDetalheBundle.data;
        case "inadimplencia":
          return inadimplenciaBundle.data;
      }
    },
    [
      saldoCreditoBundle.data,
      saldoPFBundle.data,
      saldoPJBundle.data,
      taxaBundle.data,
      inadimDetalheBundle.data,
      inadimplenciaBundle.data,
    ],
  );

  /* ─── Build per-modalidade series from REAL bundles ─── */
  const seriesMap = useMemo(() => {
    const map: Record<string, { saldo: SeriesDataPoint[]; taxa: SeriesDataPoint[]; inadim: SeriesDataPoint[]; hasSaldo: boolean }> = {};
    MODALIDADES.forEach((m) => {
      const saldoBundle = getBundle(m.saldo.cat);
      const taxaBundleResolved = getBundle(m.taxa.cat);
      const inadimBundleResolved = getBundle(m.inadim.cat);

      const saldoMeta = saldoBundle?.[String(m.saldo.code)];
      const saldoRaw = pickSeries(saldoBundle, m.saldo.code);
      const saldoBi = normalizeToBi(saldoRaw, saldoMeta?.unit);

      map[m.id] = {
        saldo: saldoBi,
        taxa: pickSeries(taxaBundleResolved, m.taxa.code),
        inadim: pickSeries(inadimBundleResolved, m.inadim.code),
        hasSaldo: saldoBi.length > 0,
      };
    });
    return map;
  }, [getBundle]);

  /* ─── Drill-down series map (5y bundles) — only built while drawer open ─── */
  const getBundle5y = useCallback(
    (cat: SeriesRef["cat"]): SeriesBundle | undefined => {
      switch (cat) {
        case "saldo_credito":
          return saldoCreditoBundle5y.data;
        case "saldo_pf_modal":
          return saldoPFBundle5y.data;
        case "saldo_pj_modal":
          return saldoPJBundle5y.data;
        case "taxa":
          return taxaBundle5y.data;
        case "inadim_detalhe":
          return inadimDetalheBundle5y.data;
        case "inadimplencia":
          return inadimplenciaBundle5y.data;
      }
    },
    [
      saldoCreditoBundle5y.data,
      saldoPFBundle5y.data,
      saldoPJBundle5y.data,
      taxaBundle5y.data,
      inadimDetalheBundle5y.data,
      inadimplenciaBundle5y.data,
    ],
  );

  const drillDetail = useMemo(() => {
    if (!detailModalityId) return null;
    const mod = MODALIDADES.find((m) => m.id === detailModalityId);
    if (!mod) return null;

    const buildSeries = (m: Modalidade) => {
      const saldoB = getBundle5y(m.saldo.cat);
      const taxaB = getBundle5y(m.taxa.cat);
      const inadimB = getBundle5y(m.inadim.cat);
      const saldoMeta = saldoB?.[String(m.saldo.code)];
      const saldoRaw = pickSeries(saldoB, m.saldo.code);
      const saldoBi = normalizeToBi(saldoRaw, saldoMeta?.unit);
      return {
        saldo: saldoBi,
        taxa: pickSeries(taxaB, m.taxa.code),
        inadim: pickSeries(inadimB, m.inadim.code),
        hasSaldo: saldoBi.length > 0,
      };
    };

    const target = buildSeries(mod);

    // Peer set: same tipo+recurso, excluding the target itself.
    const peers = MODALIDADES.filter(
      (m) => m.id !== mod.id && m.tipo === mod.tipo && m.recurso === mod.recurso,
    );
    const peerSeries = peers.map(buildSeries);

    return {
      mod,
      data: target,
      peerSaldoMean: meanByDate(peerSeries.map((p) => p.saldo)),
      peerTaxaMean: meanByDate(peerSeries.map((p) => p.taxa)),
      peerInadimMean: meanByDate(peerSeries.map((p) => p.inadim)),
      peerCount: peers.length,
    };
  }, [detailModalityId, getBundle5y]);

  /* ─── Latest reference date across all bundles (for DataAsOfStamp) ─── */
  const latestDate = useMemo(() => {
    const dates: string[] = [];
    [
      saldoCreditoBundle.data,
      saldoPFBundle.data,
      saldoPJBundle.data,
      taxaBundle.data,
      inadimDetalheBundle.data,
      inadimplenciaBundle.data,
    ].forEach((b) => {
      if (!b) return;
      Object.values(b).forEach((serie) => {
        if (serie.data.length) dates.push(serie.data[serie.data.length - 1].date);
      });
    });
    if (!dates.length) return null;
    dates.sort();
    return dates[dates.length - 1];
  }, [
    saldoCreditoBundle.data,
    saldoPFBundle.data,
    saldoPJBundle.data,
    taxaBundle.data,
    inadimDetalheBundle.data,
    inadimplenciaBundle.data,
  ]);

  /* ─── Chart series builders ─── */
  const saldoSeries = useMemo(
    () =>
      modObjects.map((m, i) => ({
        label: m.label,
        modId: m.id,
        data: seriesMap[m.id]?.saldo || [],
        color: COLORS[i % COLORS.length],
      })),
    [modObjects, seriesMap],
  );

  const taxaSeries = useMemo(
    () =>
      modObjects.map((m, i) => ({
        label: m.label,
        modId: m.id,
        data: seriesMap[m.id]?.taxa || [],
        color: COLORS[i % COLORS.length],
      })),
    [modObjects, seriesMap],
  );

  const inadimSeries = useMemo(
    () =>
      modObjects.map((m, i) => ({
        label: m.label,
        modId: m.id,
        data: seriesMap[m.id]?.inadim || [],
        color: COLORS[i % COLORS.length],
      })),
    [modObjects, seriesMap],
  );

  const resetFilters = useCallback(() => {
    setTipoCliente("PF");
    setRecurso("Livres");
    setSelectedMods([]);
    setPeriod("2y");
  }, []);

  /* ─── Count helpers for filter pill badges ─── */
  const tipoCounts = useMemo(() => {
    const counts: Record<TipoCliente, number> = { PF: 0, PJ: 0, Total: 0 };
    MODALIDADES.forEach((m) => (counts[m.tipo] += 1));
    return counts;
  }, []);

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#10B981]" />
            <h2 className="text-sm font-bold text-zinc-100 font-mono">
              Painel de Operações de Crédito
            </h2>
            <DataAsOfStamp date={latestDate} cadence="monthly" source="BACEN SGS" compact />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono text-zinc-500 hover:text-zinc-300 border border-zinc-800/50 rounded hover:border-zinc-700 transition-colors"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              Reset
            </button>
            <div className="flex items-center gap-0.5 bg-[#0a0a0a] border border-zinc-800/50 rounded-md p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-0.5 text-[9px] font-mono rounded transition-colors ${
                    period === p ? "bg-[#10B981] text-white" : "text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter rows */}
        <div className="space-y-2.5">
          {/* Tipo Cliente */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600 font-mono w-24 shrink-0">Tipo Cliente</span>
            <div className="flex gap-1 flex-wrap">
              {(["PF", "PJ", "Total"] as TipoCliente[]).map((t) => (
                <FilterPill
                  key={t}
                  label={t === "PF" ? "Pessoa Física" : t === "PJ" ? "Pessoa Jurídica" : "Total SFN"}
                  active={tipoCliente === t}
                  onClick={() => {
                    setTipoCliente(t);
                    setSelectedMods([]);
                  }}
                  count={tipoCounts[t]}
                />
              ))}
            </div>
          </div>

          {/* Recurso */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600 font-mono w-24 shrink-0">Recurso</span>
            <div className="flex gap-1 flex-wrap">
              {(["Livres", "Direcionados", "Total"] as Recurso[]).map((r) => (
                <FilterPill
                  key={r}
                  label={r}
                  active={recurso === r}
                  onClick={() => {
                    setRecurso(r);
                    setSelectedMods([]);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Modalidades (multi-select) */}
          <div className="flex items-start gap-2">
            <span className="text-[9px] text-zinc-600 font-mono w-24 shrink-0 pt-1">Modalidade</span>
            <div className="flex gap-1 flex-wrap">
              {filteredMods.map((m) => {
                const has = seriesMap[m.id]?.hasSaldo ?? true;
                return (
                  <FilterPill
                    key={m.id}
                    label={m.label}
                    active={activeMods.includes(m.id)}
                    onClick={() => toggleMod(m.id)}
                    title={
                      has
                        ? `SGS saldo ${m.saldo.code} · taxa ${m.taxa.code}${m.taxa.aggregate ? " (agg)" : ""} · inadim ${m.inadim.code}${m.inadim.aggregate ? " (agg)" : ""}`
                        : "Série indisponível via BACEN SGS"
                    }
                  />
                );
              })}
              {filteredMods.length === 0 && (
                <span className="text-[9px] text-zinc-600 font-mono italic">
                  Nenhuma modalidade disponível para essa combinação
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-[8px] text-zinc-700 font-mono">
          <Search className="w-2.5 h-2.5" />
          <span>
            {activeMods.length} selecionadas · Máx. 6 simultâneas · SGS:{" "}
            {modObjects.map((m) => m.saldo.code).join(", ") || "—"}
          </span>
          {modObjects.some((m) => m.taxa.aggregate || m.inadim.aggregate) && (
            <span className="text-zinc-600 italic">
              · ⓘ taxa/inadim agregada quando série específica não publicada
            </span>
          )}
        </div>
      </div>

      {/* ─── Loading state ─── */}
      {isLoading && !modObjects.length && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-8 text-center">
          <div className="inline-block w-4 h-4 border-2 border-zinc-700 border-t-[#10B981] rounded-full animate-spin mb-2" />
          <p className="text-[10px] text-zinc-500 font-mono">Carregando séries BACEN SGS…</p>
        </div>
      )}

      {/* ─── Summary Cards ─── */}
      {modObjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {modObjects.map((m, i) => (
            <OperationCard
              key={m.id}
              mod={m}
              color={COLORS[i % COLORS.length]}
              saldoData={seriesMap[m.id]?.saldo || []}
              taxaData={seriesMap[m.id]?.taxa || []}
              inadimData={seriesMap[m.id]?.inadim || []}
              hasSaldo={seriesMap[m.id]?.hasSaldo ?? false}
            />
          ))}
        </div>
      )}

      {/* ─── Chart Panels (3 panels) ─── */}
      {modObjects.length > 0 && (
        <div className="space-y-3">
          <ChartPanel
            title="Saldo da Carteira"
            icon={<Banknote className="w-3.5 h-3.5 text-[#10B981]" />}
            series={saldoSeries}
            unit="R$ bi"
            chartType="area"
            exportTag="saldo"
          />
          <ChartPanel
            title="Taxas de Juros"
            icon={<Percent className="w-3.5 h-3.5 text-[#6366F1]" />}
            series={taxaSeries}
            unit="% a.a."
            chartType="line"
            exportTag="taxas"
          />
          <ChartPanel
            title="Inadimplência (>90 dias)"
            icon={<ShieldAlert className="w-3.5 h-3.5 text-[#EF4444]" />}
            series={inadimSeries}
            unit="%"
            chartType="line"
            exportTag="inadimplencia"
          />
        </div>
      )}

      {/* ─── Comparison Table ─── */}
      {filteredMods.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowTable((t) => !t)}
            className="flex items-center gap-1.5 mb-2 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <BarChart3 className="w-3 h-3" />
            {showTable ? "Ocultar" : "Mostrar"} Tabela Comparativa
            {showTable ? (
              <ChevronUp className="w-2.5 h-2.5" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5" />
            )}
          </button>
          {showTable && (
            <ComparisonTable
              mods={filteredMods}
              seriesMap={seriesMap}
              onDrillDown={setDetailModalityId}
            />
          )}
        </div>
      )}

      {/* ─── Empty state ─── */}
      {!isLoading && modObjects.length === 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-8 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500/50 mx-auto mb-2" />
          <p className="text-[11px] text-zinc-500 font-mono">
            Selecione ao menos uma modalidade para visualizar os dados
          </p>
        </div>
      )}

      {/* ─── Footer ─── */}
      <div className="text-[8px] text-zinc-700 font-mono flex items-center justify-between pt-2 border-t border-zinc-800/30">
        <span>Fonte: BACEN SGS · Operações de crédito por modalidade</span>
        <span>
          {MODALIDADES.length} modalidades catalogadas · Dados mensais
          {modObjects.some((m) => m.taxa.aggregate || m.inadim.aggregate) && " · ⓘ agregado"}
        </span>
      </div>

      {/* ─── Drill-down Drawer ─── */}
      {detailModalityId && drillLoading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Carregando detalhamento"
        >
          <div className="bg-[#0a0a0a] border border-zinc-800/80 rounded-2xl px-6 py-5 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-zinc-700 border-t-[#10B981] rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-zinc-400">
              Carregando histórico 5y da BACEN SGS…
            </span>
          </div>
        </div>
      )}
      {detailModalityId && !drillLoading && drillDetail && (
        <ModalityDetailDrawer
          mod={drillDetail.mod}
          modData={drillDetail.data}
          peerSaldoMean={drillDetail.peerSaldoMean}
          peerTaxaMean={drillDetail.peerTaxaMean}
          peerInadimMean={drillDetail.peerInadimMean}
          peerCount={drillDetail.peerCount}
          onClose={() => setDetailModalityId(null)}
        />
      )}
    </div>
  );
}
