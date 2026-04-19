import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Filter, Search, TrendingUp, TrendingDown, AlertTriangle,
  ChevronDown, ChevronUp, Banknote, Percent, ShieldAlert,
  RotateCcw, Download, BarChart3, Info,
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
}: {
  mods: Modalidade[];
  seriesMap: Record<string, { saldo: SeriesDataPoint[]; taxa: SeriesDataPoint[]; inadim: SeriesDataPoint[]; hasSaldo: boolean }>;
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
                className={`border-b border-[#111] ${i % 2 === 0 ? "bg-[#0a0a0a]" : ""} hover:bg-zinc-900/50 transition-colors`}
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
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export function CreditOperationsPanel() {
  /* ─── State ─── */
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>("PF");
  const [recurso, setRecurso] = useState<Recurso>("Livres");
  const [selectedMods, setSelectedMods] = useState<string[]>([]);
  const [period, setPeriod] = useState<string>("2y");
  const [showTable, setShowTable] = useState(true);

  /* ─── Fetch 5 category bundles (all credit operations live here) ─── */
  const saldoCreditoBundle = useHubSeriesBundle("saldo_credito", period, "credito");
  const saldoPFBundle = useHubSeriesBundle("saldo_pf_modal", period, "credito");
  const saldoPJBundle = useHubSeriesBundle("saldo_pj_modal", period, "credito");
  const taxaBundle = useHubSeriesBundle("taxa", period, "credito");
  const inadimDetalheBundle = useHubSeriesBundle("inadim_detalhe", period, "credito");
  const inadimplenciaBundle = useHubSeriesBundle("inadimplencia", period, "credito");

  const isLoading =
    saldoCreditoBundle.isLoading ||
    saldoPFBundle.isLoading ||
    saldoPJBundle.isLoading ||
    taxaBundle.isLoading ||
    inadimDetalheBundle.isLoading ||
    inadimplenciaBundle.isLoading;

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
          {showTable && <ComparisonTable mods={filteredMods} seriesMap={seriesMap} />}
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
    </div>
  );
}
