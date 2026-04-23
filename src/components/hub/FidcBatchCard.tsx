/**
 * FidcBatchCard.tsx — V5-D4 (22/04/2026)
 *
 * Compact single-FIDC card rendered inside the batch print layout.
 * Fetches detail + monthly via the same hooks FidcLamina uses, but
 * strips the interactive chrome (sidebar, tabs, export buttons) and
 * renders a print-friendly summary: header, KPI row, rentab line
 * chart, capital structure line chart, and fund info block.
 *
 * Designed to fit ~1 A4 page per card. The parent `FidcBatchPrint`
 * page wraps each card with a `.print-page-break` break-after rule
 * so each FIDC starts on its own page in the generated PDF.
 */

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  useFidcDetail,
  useFidcV4Monthly,
  formatPL,
  formatCnpj,
  type FidcMonthlyItem,
} from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";

const FIDC_ACCENT = "#F97316";

const CORRUPT_RENTAB_THRESHOLD = 95;

function cleanRentab(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return null;
  if (Math.abs(n) > CORRUPT_RENTAB_THRESHOLD) return null;
  return n;
}

function formatMonth(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatInt(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  return Math.round(v).toLocaleString("pt-BR");
}

function formatPercent(v: number | null | undefined, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

function computeRentabilidadeSeries(monthly: FidcMonthlyItem[]) {
  return monthly
    .map((m) => ({
      date: m.dt_comptc,
      rentab_senior: cleanRentab(m.rentab_senior),
      rentab_subord: cleanRentab(m.rentab_subordinada),
      rentab_fundo: cleanRentab(m.rentab_fundo),
    }))
    .filter((d) => d.rentab_senior != null || d.rentab_subord != null || d.rentab_fundo != null);
}

function computeCapitalSeries(monthly: FidcMonthlyItem[]) {
  return monthly
    .map((m) => ({
      date: m.dt_comptc,
      senior: m.vl_pl_senior,
      subord: m.vl_pl_subordinada,
      total: m.vl_pl_total,
    }))
    .filter((d) => d.senior != null || d.subord != null);
}

interface BatchKPIProps {
  label: string;
  value: string;
  sublabel?: string;
}

function BatchKPI({ label, value, sublabel }: BatchKPIProps) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg px-3 py-2 print:bg-white print:border-zinc-300">
      <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider print:text-zinc-600">
        {label}
      </div>
      <div className="text-sm font-semibold text-zinc-100 mt-0.5 print:text-zinc-900">
        {value}
      </div>
      {sublabel ? (
        <div className="text-[8px] font-mono text-zinc-600 mt-0.5 print:text-zinc-500">
          {sublabel}
        </div>
      ) : null}
    </div>
  );
}

interface FidcBatchCardProps {
  slug: string;
  index: number;
  total: number;
}

export function FidcBatchCard({ slug, index, total }: FidcBatchCardProps) {
  const { data: fidcData, isLoading, isError } = useFidcDetail(slug);
  const cnpj = fidcData?.meta?.cnpj_fundo || fidcData?.meta?.cnpj_fundo_classe || null;
  const { data: monthlyData } = useFidcV4Monthly(cnpj, 24);

  const meta = fidcData?.meta;
  const monthly = monthlyData?.data || fidcData?.monthly || [];
  const latest = fidcData?.latest;

  const rentabSeries = useMemo(() => computeRentabilidadeSeries(monthly), [monthly]);
  const capitalSeries = useMemo(() => computeCapitalSeries(monthly), [monthly]);

  const totalCotistas =
    (latest?.nr_cotistas_senior ?? 0) + (latest?.nr_cotistas_subordinada ?? 0);
  const hasCotistas =
    latest?.nr_cotistas_senior != null || latest?.nr_cotistas_subordinada != null;

  if (isLoading) {
    return (
      <section className="print-card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-zinc-900 rounded w-2/3" />
          <div className="h-4 bg-zinc-900 rounded w-1/3" />
          <div className="h-32 bg-zinc-900 rounded" />
        </div>
      </section>
    );
  }

  if (isError || !meta) {
    return (
      <section className="print-card">
        <div className="p-4 border border-red-500/30 rounded bg-red-500/5">
          <div className="text-xs font-mono text-red-400">
            FIDC não encontrado: <span className="text-zinc-300">{slug}</span>
          </div>
        </div>
      </section>
    );
  }

  const fundName = meta.denom_social || `FIDC ${meta.cnpj_fundo_classe ?? meta.cnpj_fundo}`;

  return (
    <section className="print-card space-y-4">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] pb-3 print:border-zinc-300">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono text-zinc-600 print:text-zinc-500 mb-1">
              muuney.hub · Lâmina FIDC · {index + 1} de {total}
            </div>
            <h2 className="text-base font-semibold text-zinc-100 print:text-zinc-900 leading-tight">
              {fundName}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <ClasseBadge classe="FIDC" size="sm" />
              <span className="text-[9px] font-mono text-zinc-500 print:text-zinc-600">
                {formatCnpj(meta.cnpj_fundo_classe || meta.cnpj_fundo)}
              </span>
              <span className="text-[9px] font-mono text-zinc-600 print:text-zinc-500">
                · dados: {formatMonth(latest?.dt_comptc)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* KPI row — 6 cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        <BatchKPI
          label="PL Total"
          value={`R$ ${formatPL(latest?.vl_pl_total ?? meta.vl_patrim_liq)}`}
          sublabel={formatMonth(latest?.dt_comptc)}
        />
        <BatchKPI
          label="Cotistas"
          value={hasCotistas ? formatInt(totalCotistas) : "—"}
          sublabel={
            hasCotistas
              ? `Sr ${formatInt(latest?.nr_cotistas_senior)} · Sub ${formatInt(latest?.nr_cotistas_subordinada)}`
              : undefined
          }
        />
        <BatchKPI
          label="Subordinação"
          value={formatPercent(latest?.indice_subordinacao, 2)}
        />
        <BatchKPI
          label="Inadimplência"
          value={formatPercent(latest?.taxa_inadimplencia, 2)}
          sublabel={latest?.indice_pdd_cobertura != null
            ? `PDD cob. ${formatPercent(latest.indice_pdd_cobertura, 1)}`
            : undefined}
        />
        <BatchKPI
          label="Rentab. Senior"
          value={formatPercent(cleanRentab(latest?.rentab_senior), 2)}
          sublabel="último mês"
        />
        <BatchKPI
          label="Rentab. Fundo"
          value={formatPercent(cleanRentab(latest?.rentab_fundo), 2)}
          sublabel="último mês"
        />
      </div>

      {/* Charts row — 2 panels side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Rentabilidade mensal */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3 print:bg-white print:border-zinc-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider print:text-zinc-800">
              Rentabilidade mensal (%)
            </h3>
            <span className="text-[8px] font-mono text-zinc-600 print:text-zinc-500">
              últimos {rentabSeries.length} meses
            </span>
          </div>
          {rentabSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={rentabSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8, fill: "#71717a" }}
                  stroke="#3f3f46"
                  tickFormatter={(d) => {
                    try {
                      return new Date(d).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" });
                    } catch {
                      return d;
                    }
                  }}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: "#71717a" }}
                  stroke="#3f3f46"
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    fontSize: 10,
                  }}
                  formatter={(value: number) => [`${value?.toFixed(2)}%`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: 8 }} />
                <Line
                  type="monotone"
                  dataKey="rentab_senior"
                  name="Senior"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rentab_subord"
                  name="Subordinada"
                  stroke={FIDC_ACCENT}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="rentab_fundo"
                  name="Fundo"
                  stroke="#3B82F6"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[9px] font-mono text-zinc-600 text-center py-8">
              Sem histórico suficiente
            </div>
          )}
        </div>

        {/* PL Senior vs Subordinada */}
        <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3 print:bg-white print:border-zinc-300">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider print:text-zinc-800">
              Estrutura de capital (R$ mi)
            </h3>
            <span className="text-[8px] font-mono text-zinc-600 print:text-zinc-500">
              PL total + tranches
            </span>
          </div>
          {capitalSeries.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={capitalSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 8, fill: "#71717a" }}
                  stroke="#3f3f46"
                  tickFormatter={(d) => {
                    try {
                      return new Date(d).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" });
                    } catch {
                      return d;
                    }
                  }}
                />
                <YAxis
                  tick={{ fontSize: 8, fill: "#71717a" }}
                  stroke="#3f3f46"
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    fontSize: 10,
                  }}
                  formatter={(value: number) =>
                    value != null ? [`R$ ${(value / 1_000_000).toFixed(2)} mi`, ""] : ["—", ""]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 8 }} />
                <Line type="monotone" dataKey="senior" name="Senior" stroke="#10B981" strokeWidth={1.5} dot={false} />
                <Line
                  type="monotone"
                  dataKey="subord"
                  name="Subordinada"
                  stroke={FIDC_ACCENT}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line type="monotone" dataKey="total" name="Total" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-[9px] font-mono text-zinc-600 text-center py-8">
              Sem histórico suficiente
            </div>
          )}
        </div>
      </div>

      {/* Info block — gestor/admin/lastro */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-3 print:bg-white print:border-zinc-300">
        <div>
          <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider print:text-zinc-600">
            Gestor
          </div>
          <div className="text-[10px] font-medium text-zinc-300 mt-0.5 print:text-zinc-800 truncate">
            {meta.gestor_nome || "—"}
          </div>
        </div>
        <div>
          <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider print:text-zinc-600">
            Administrador
          </div>
          <div className="text-[10px] font-medium text-zinc-300 mt-0.5 print:text-zinc-800 truncate">
            {meta.admin_nome || "—"}
          </div>
        </div>
        <div>
          <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider print:text-zinc-600">
            Lastro principal
          </div>
          <div className="text-[10px] font-medium text-zinc-300 mt-0.5 print:text-zinc-800 truncate">
            {latest?.tp_lastro_principal || "—"}
          </div>
        </div>
        <div>
          <div className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider print:text-zinc-600">
            Nº Cedentes
          </div>
          <div className="text-[10px] font-medium text-zinc-300 mt-0.5 print:text-zinc-800">
            {formatInt(latest?.nr_cedentes)}
          </div>
        </div>
      </div>
    </section>
  );
}
