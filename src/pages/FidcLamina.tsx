import { useCallback, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ArrowLeft, TrendingUp, BarChart3, LineChart as LineChartIcon, Info, FileSpreadsheet } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { motion } from "framer-motion";

import {
  useFidcDetail, useFidcV4Monthly,
  formatPL, formatCnpj,
  type FidcMonthlyItem,
} from "@/hooks/useHubFundos";
import { ClasseBadge } from "@/lib/rcvm175";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { ExportPdfButton } from "@/components/hub/ExportPdfButton";
import { PrintFooter } from "@/components/hub/PrintFooter";
import { exportFidcLamina } from "@/lib/fidcExcelExport";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { SimpleKPICard as KPICard } from "@/components/hub/KPICard";
import { computeMonthlyRiskMetrics } from "@/lib/monthlyRiskMetrics";
import { computeRollingReturnsFromMonthly } from "@/lib/rollingReturns";
import { RollingReturnsGrid } from "@/components/hub/RollingReturnsGrid";
import { computeMonthlyGridFromMonthly, summarizeDrawdown } from "@/lib/drawdown";
import { DrawdownHeatmap } from "@/components/hub/DrawdownHeatmap";
import { FundNarrativePanel, type FundScopeContext } from "@/components/hub/FundNarrativePanel";
import { ManagerTenureTimeline } from "@/components/hub/ManagerTenureTimeline";
import { PeerBeatsPanel, type PeerBeatsItem } from "@/components/hub/PeerBeatsPanel";
import { NarrativeSection, type MiniStat } from "@/components/hub/NarrativeSection";
import { FicFidcPlaceholder, isFicFidc } from "@/components/hub/FicFidcPlaceholder";
import { CvmRegulationCard } from "@/components/hub/CvmRegulationCard";
import { GlossarioFidc } from "@/components/hub/GlossarioFidc";
import { OfertaAtivaBadge } from "@/components/hub/OfertaAtivaBadge";
import { FidcCarteiraDepthPanel } from "@/components/hub/FidcCarteiraDepthPanel";
import { FidcSafrasPanel } from "@/components/hub/FidcSafrasPanel";
import { FidcLiquidezPanel } from "@/components/hub/FidcLiquidezPanel";
import { FundEventsBanner } from "@/components/hub/FundEventsBanner";
import { FundLaminaPolicyPanel } from "@/components/hub/FundLaminaPolicyPanel";
import { FundAssembleiasPanel } from "@/components/hub/FundAssembleiasPanel";
import { GestorRiskBadge } from "@/components/hub/GestorRiskBadge";
import { FundPerfilCotistasPanel } from "@/components/hub/FundPerfilCotistasPanel";

/**
 * Compute monthly series for chart (Senior, Subordinada, Fundo).
 * HOTFIX (11/04/2026):
 *  - Correct field names: rentab_senior / rentab_subordinada (not rentab_fundo_senior/subord)
 *  - Clip CVM outliers: any |rentab| > 95% in a single month is treated as corrupt
 *    (raw CVM publishes e.g. -280 bi% for funds in liquidation with negative cotas).
 */
const CORRUPT_RENTAB_THRESHOLD = 95; // % in a single month; above this we consider CVM data corrupt

function cleanRentab(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return null;
  if (Math.abs(n) > CORRUPT_RENTAB_THRESHOLD) return null;
  return n;
}

/** Compute base-100 indexed series from FIDC monthly rentabilidade */
function computeIndexedSeries(monthly: FidcMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];

  let cumulativeReturn = 1.0;
  const result: { date: string; index: number }[] = [];

  for (const m of monthly) {
    const rentab = cleanRentab(m.rentab_fundo);
    if (rentab != null) {
      cumulativeReturn *= (1 + rentab / 100);
      result.push({
        date: m.dt_comptc,
        index: cumulativeReturn * 100,
      });
    }
  }

  return result;
}

/** Compute accumulated CDI index from monthly data using Selic-derived compound rate
 *  Formula: monthly rate = (1 + Selic_annual/100)^(1/12) - 1
 *  Default 14.15% Selic annual ≈ 1.106% monthly (vs naive 1.1%) */
function computeCDIIndexMonthly(monthly: FidcMonthlyItem[], selicAnnual = 14.15) {
  if (!monthly || monthly.length === 0) return [];

  const monthlyRate = Math.pow(1 + selicAnnual / 100, 1 / 12) - 1;
  let cumulativeReturn = 1.0;
  const result: { date: string; cdi: number }[] = [];

  for (const m of monthly) {
    cumulativeReturn *= (1 + monthlyRate);
    result.push({
      date: m.dt_comptc,
      cdi: cumulativeReturn * 100,
    });
  }

  return result;
}

function computeRentabilidadeSeries(monthly: FidcMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly
    .map((m) => ({
      date: m.dt_comptc,
      rentab_senior: cleanRentab(m.rentab_senior),
      rentab_subord: cleanRentab(m.rentab_subordinada),
      rentab_fundo: cleanRentab(m.rentab_fundo),
    }))
    .filter((d) => d.rentab_senior != null || d.rentab_subord != null || d.rentab_fundo != null);
}

/** Compute capital structure series (PL Senior, Subord, Mezanino) */
function computeCapitalSeries(monthly: FidcMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    senior: m.vl_pl_senior != null ? m.vl_pl_senior / 1e6 : 0,
    subord: m.vl_pl_subordinada != null ? m.vl_pl_subordinada / 1e6 : 0,
    mezanino: m.vl_pl_mezanino != null ? m.vl_pl_mezanino / 1e6 : 0,
  }));
}

/** Compute subordinacao index over time */
function computeSubordinacaoSeries(monthly: FidcMonthlyItem[]) {
  if (!monthly || monthly.length === 0) return [];
  return monthly.map((m) => ({
    date: m.dt_comptc,
    subordinacao_pct: m.indice_subordinacao != null ? m.indice_subordinacao : null,
  })).filter((d) => d.subordinacao_pct != null);
}

/** Main FIDC Lamina Page */
export default function FidcLamina() {
  const { slug } = useParams<{ slug: string }>();

  const { data: fidcData, isLoading: fidcLoading } = useFidcDetail(slug ?? null);
  const cnpj = fidcData?.meta?.cnpj_fundo || fidcData?.meta?.cnpj_fundo_classe || null;
  const { data: monthlyData } = useFidcV4Monthly(cnpj, 24);

  const meta = fidcData?.meta;
  const monthly = monthlyData?.data || fidcData?.monthly || [];
  const latest = fidcData?.latest;

  // Excel export (lazy-loads SheetJS on first click)
  const [isExporting, setIsExporting] = useState(false);
  const handleExcelExport = useCallback(async () => {
    if (!meta || isExporting) return;
    setIsExporting(true);
    try {
      await exportFidcLamina(meta, monthly, latest ?? null, fidcData?.similar ?? []);
    } catch (err) {
      console.error("[FidcLamina] Excel export failed", err);
    } finally {
      setIsExporting(false);
    }
  }, [meta, monthly, latest, fidcData?.similar, isExporting]);

  const rentabilidadeSeries = useMemo(() => computeRentabilidadeSeries(monthly), [monthly]);
  const capitalSeries = useMemo(() => computeCapitalSeries(monthly), [monthly]);
  const subordinacaoSeries = useMemo(() => computeSubordinacaoSeries(monthly), [monthly]);

  // Cleaned monthly fund rentabilidade (shared by risk metrics + rolling returns)
  const cleanedMonthlyReturns = useMemo(
    () =>
      monthly
        .map((m) => cleanRentab(m.rentab_fundo))
        .filter((r): r is number => r != null),
    [monthly],
  );

  // Risk metrics computed from cleaned monthly fund rentabilidade
  const riskMetrics = useMemo(() => {
    if (cleanedMonthlyReturns.length < 3) return null;
    try {
      return computeMonthlyRiskMetrics(cleanedMonthlyReturns);
    } catch {
      return null;
    }
  }, [cleanedMonthlyReturns]);

  // Rolling returns across 1m/3m/6m/12m/24m/36m windows
  const rollingRows = useMemo(() => {
    if (cleanedMonthlyReturns.length < 1) return [];
    try {
      return computeRollingReturnsFromMonthly(cleanedMonthlyReturns);
    } catch {
      return [];
    }
  }, [cleanedMonthlyReturns]);

  // Drawdown calendar (ano × mês) — from cleaned monthly rentab_fundo
  const drawdownCells = useMemo(() => {
    if (!monthly || monthly.length < 3) return [];
    try {
      const dated = monthly
        .map((m) => {
          const r = cleanRentab(m.rentab_fundo);
          return m.dt_comptc ? { dt_comptc: m.dt_comptc, returnPct: r } : null;
        })
        .filter((x): x is { dt_comptc: string; returnPct: number | null } => x !== null);
      return computeMonthlyGridFromMonthly(dated);
    } catch {
      return [];
    }
  }, [monthly]);
  const drawdownSummary = useMemo(() => {
    if (!drawdownCells.length) return undefined;
    try { return summarizeDrawdown(drawdownCells); } catch { return undefined; }
  }, [drawdownCells]);

  // Per-fund narrative context (FIDC regime + signals)
  const fundNarrativeContext = useMemo<FundScopeContext | null>(() => {
    if (!meta) return null;
    const twelveMonth = rollingRows.find((r) => r.months === 12 && r.returnPct != null);
    const longest = [...rollingRows].reverse().find((r) => r.returnPct != null);
    const ref = twelveMonth ?? longest;

    // PL trend from monthly series (FIDC uses vl_pl_total)
    let plTrend: "up" | "down" | "flat" | null = null;
    let cotistasTrend: "up" | "down" | "flat" | null = null;
    const sumCotistas = (m: FidcMonthlyItem) =>
      (m.nr_cotistas_senior ?? 0) + (m.nr_cotistas_subordinada ?? 0);
    if (monthly.length >= 2) {
      const firstPL = monthly[0]?.vl_pl_total ?? null;
      const lastPL = monthly[monthly.length - 1]?.vl_pl_total ?? null;
      if (firstPL && lastPL) {
        const d = (lastPL - firstPL) / firstPL;
        plTrend = d > 0.02 ? "up" : d < -0.02 ? "down" : "flat";
      }
      const firstCot = sumCotistas(monthly[0]);
      const lastCot = sumCotistas(monthly[monthly.length - 1]);
      if (firstCot && lastCot) {
        const d = (lastCot - firstCot) / firstCot;
        cotistasTrend = d > 0.02 ? "up" : d < -0.02 ? "down" : "flat";
      }
    }

    return {
      classe: "FIDC",
      nome: meta.denom_social ?? null,
      returnPct: ref?.returnPct ?? null,
      annualizedPct: ref?.annualizedPct ?? riskMetrics?.return_annualized ?? null,
      cdiPct: ref?.cdiPct ?? null,
      vsCdiPP: ref?.vsCdiPct ?? null,
      volAnnualPct: riskMetrics?.volatility ?? null,
      sharpe: riskMetrics?.sharpe ?? null,
      sortino: riskMetrics?.sortino ?? null,
      maxDrawdownPct: riskMetrics?.max_drawdown ?? null,
      plBRL: latest?.vl_pl_total ?? null,
      plTrend,
      cotistasTrend,
      fidcSubordPct: latest?.indice_subordinacao ?? null,
      fidcInadimPct: latest?.taxa_inadimplencia ?? null,
      selicMeta: 14.15,
      ipcaAccum: 5.0,
    };
  }, [meta, monthly, latest, riskMetrics, rollingRows]);

  // Peer beats: similar FIDCs outperforming current fund on rentab_fundo
  const peerBeatsItems = useMemo<PeerBeatsItem[]>(() => {
    const similar = fidcData?.similar ?? [];
    const baseRentab = cleanRentab(latest?.rentab_fundo);
    if (baseRentab == null) return [];
    return similar
      .map((f) => {
        const peerRentab = cleanRentab(f.rentab_fundo);
        if (peerRentab == null) return null;
        return {
          name: f.denom_social || `FIDC ${f.cnpj_fundo}`,
          slug: f.slug ?? null,
          cnpjFallback: f.cnpj_fundo ?? null,
          value: peerRentab,
          delta: peerRentab - baseRentab,
          secondary: f.tp_lastro_principal ?? undefined,
        } as PeerBeatsItem;
      })
      .filter((x): x is PeerBeatsItem => x !== null);
  }, [fidcData?.similar, latest?.rentab_fundo]);

  // Indexed chart series (fund + CDI benchmark)
  const indexedSeries = useMemo(() => {
    const fundIndex = computeIndexedSeries(monthly);
    const cdiIndex = computeCDIIndexMonthly(monthly);

    // Merge CDI data into fund data by date (O(n) via Map lookup)
    const cdiMap = new Map(cdiIndex.map((c) => [c.date, c.cdi]));
    const merged = fundIndex.map((f) => ({
      date: f.date,
      index: f.index,
      cdi: cdiMap.get(f.date) ?? null,
    }));

    return merged;
  }, [monthly]);

  // Compute vs CDI metric
  const vsCDIMetric = useMemo(() => {
    if (indexedSeries.length < 2) return null;
    const lastEntry = indexedSeries[indexedSeries.length - 1];

    if (!lastEntry.index || !lastEntry.cdi) return null;

    const fundReturn = lastEntry.index - 100;
    const cdiReturn = lastEntry.cdi - 100;
    const excess = fundReturn - cdiReturn;

    return { fundReturn, cdiReturn, excess };
  }, [indexedSeries]);

  const totalSubord = latest?.indice_subordinacao != null ? latest.indice_subordinacao : null;
  const totalInadim = latest?.taxa_inadimplencia != null ? latest.taxa_inadimplencia : null;
  const carteiraPrejuizo = latest?.vl_carteira_prejuizo || 0;

  // Auto-generated health assessment
  const healthAssessment = useMemo(() => {
    const signals: { label: string; severity: "positive" | "warning" | "alert"; text: string }[] = [];

    // Subordinação assessment
    if (totalSubord != null) {
      if (totalSubord < 5) signals.push({ label: "Subordinação Crítica", severity: "alert", text: `Índice de ${totalSubord.toFixed(1)}% abaixo do mínimo aceitável (5%). Proteção insuficiente para cotistas senior.` });
      else if (totalSubord < 15) signals.push({ label: "Subordinação Baixa", severity: "warning", text: `Índice de ${totalSubord.toFixed(1)}% moderado. Monitorar tendência.` });
      else signals.push({ label: "Subordinação Adequada", severity: "positive", text: `Índice de ${totalSubord.toFixed(1)}% — proteção robusta para cotistas senior.` });
    }

    // Inadimplência assessment
    if (totalInadim != null) {
      if (totalInadim > 10) signals.push({ label: "Inadimplência Elevada", severity: "alert", text: `Taxa de ${totalInadim.toFixed(2)}% muito acima do limiar de stress (5%). Risco de perda patrimonial.` });
      else if (totalInadim > 5) signals.push({ label: "Inadimplência Alta", severity: "warning", text: `Taxa de ${totalInadim.toFixed(2)}% acima do limiar de atenção.` });
      else signals.push({ label: "Inadimplência Controlada", severity: "positive", text: `Taxa de ${totalInadim.toFixed(2)}% dentro dos parâmetros saudáveis.` });
    }

    // PDD Coverage
    if (latest?.vl_carteira_inadimplente && latest?.vl_pdd) {
      const coverage = (latest.vl_pdd / latest.vl_carteira_inadimplente) * 100;
      if (coverage < 50) signals.push({ label: "Cobertura PDD Baixa", severity: "alert", text: `PDD cobre apenas ${coverage.toFixed(0)}% da carteira inadimplente. Risco de provisão adicional.` });
      else if (coverage < 100) signals.push({ label: "Cobertura PDD Parcial", severity: "warning", text: `PDD cobre ${coverage.toFixed(0)}% da inadimplência. Próximo ao adequado.` });
      else signals.push({ label: "PDD Adequada", severity: "positive", text: `PDD cobre ${coverage.toFixed(0)}% da carteira inadimplente.` });
    }

    // vs CDI
    if (vsCDIMetric) {
      if (vsCDIMetric.excess > 1) signals.push({ label: "Retorno Acima CDI", severity: "positive", text: `Fundo supera CDI em ${vsCDIMetric.excess.toFixed(2)}pp no período. Geração de alpha.` });
      else if (vsCDIMetric.excess < -1) signals.push({ label: "Retorno Abaixo CDI", severity: "alert", text: `Fundo abaixo do CDI em ${Math.abs(vsCDIMetric.excess).toFixed(2)}pp. Avaliar custo de oportunidade.` });
    }

    return signals;
  }, [totalSubord, totalInadim, latest, vsCDIMetric]);

  // Narrative mini-stats (P§5 storytelling — derived KPIs + regime)
  const resumoNarrative = useMemo(() => {
    // Regime FIDC (per-fund)
    const regime =
      totalInadim != null && totalSubord != null
        ? totalInadim > 5 && totalSubord < 10
          ? { label: "Stress", color: "text-red-400" }
          : totalInadim > 5
          ? { label: "Risco Elevado", color: "text-red-400" }
          : totalSubord < 10
          ? { label: "Subord Baixa", color: "text-amber-400" }
          : { label: "Equilibrado", color: "text-emerald-400" }
        : { label: "—", color: "text-zinc-500" };
    const cushion =
      totalSubord != null && totalInadim != null && totalInadim > 0
        ? totalSubord / totalInadim
        : null;
    const plDeltaPct =
      monthly.length >= 2 &&
      monthly[0]?.vl_pl_total &&
      monthly[monthly.length - 1]?.vl_pl_total
        ? ((monthly[monthly.length - 1].vl_pl_total! -
            monthly[0].vl_pl_total!) /
            monthly[0].vl_pl_total!) *
          100
        : null;
    return { regime, cushion, plDeltaPct };
  }, [totalInadim, totalSubord, monthly]);

  const resumoMiniStats = useMemo<MiniStat[]>(() => {
    const stats: MiniStat[] = [];
    stats.push({
      label: "Regime Fundo",
      value: resumoNarrative.regime.label,
      sublabel:
        totalSubord != null && totalInadim != null
          ? `Sub ${totalSubord.toFixed(1)}% / Inadim ${totalInadim.toFixed(1)}%`
          : undefined,
      color: resumoNarrative.regime.color,
    });
    if (resumoNarrative.cushion != null) {
      stats.push({
        label: "Cushion Sub/Inadim",
        value: `${resumoNarrative.cushion.toFixed(1)}×`,
        sublabel:
          resumoNarrative.cushion > 3
            ? "Proteção robusta"
            : resumoNarrative.cushion > 1.5
            ? "Proteção adequada"
            : "Proteção frágil",
        color:
          resumoNarrative.cushion > 3
            ? "text-emerald-400"
            : resumoNarrative.cushion > 1.5
            ? "text-amber-400"
            : "text-red-400",
      });
    }
    if (vsCDIMetric) {
      stats.push({
        label: "Alpha vs CDI",
        value: `${vsCDIMetric.excess >= 0 ? "+" : ""}${vsCDIMetric.excess.toFixed(2)}pp`,
        sublabel: `Fundo ${vsCDIMetric.fundReturn.toFixed(1)}% / CDI ${vsCDIMetric.cdiReturn.toFixed(1)}%`,
        color:
          vsCDIMetric.excess > 1
            ? "text-emerald-400"
            : vsCDIMetric.excess > -1
            ? "text-zinc-300"
            : "text-red-400",
      });
    }
    if (riskMetrics) {
      if (riskMetrics.sharpe != null) {
        stats.push({
          label: "Sharpe",
          value: riskMetrics.sharpe.toFixed(2),
          sublabel:
            riskMetrics.sharpe > 1
              ? "Retorno/risco forte"
              : riskMetrics.sharpe > 0
              ? "Aceitável"
              : "Abaixo do risk-free",
          color:
            riskMetrics.sharpe > 1
              ? "text-emerald-400"
              : riskMetrics.sharpe > 0
              ? "text-zinc-300"
              : "text-red-400",
        });
      }
      if (riskMetrics.max_drawdown != null) {
        stats.push({
          label: "Max Drawdown",
          value: `${riskMetrics.max_drawdown.toFixed(2)}%`,
          sublabel: "Pior queda do período",
          color:
            Math.abs(riskMetrics.max_drawdown) > 5
              ? "text-red-400"
              : "text-zinc-300",
        });
      }
    }
    if (resumoNarrative.plDeltaPct != null) {
      stats.push({
        label: "PL Δ Período",
        value: `${resumoNarrative.plDeltaPct >= 0 ? "+" : ""}${resumoNarrative.plDeltaPct.toFixed(1)}%`,
        sublabel: `${monthly.length} meses observados`,
        color:
          resumoNarrative.plDeltaPct > 2
            ? "text-emerald-400"
            : resumoNarrative.plDeltaPct < -2
            ? "text-red-400"
            : "text-zinc-300",
      });
    }
    return stats;
  }, [resumoNarrative, totalSubord, totalInadim, vsCDIMetric, riskMetrics, monthly.length]);

  if (fidcLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-[#1a1a1a] rounded w-1/3" />
          <div className="h-80 bg-[#1a1a1a] rounded" />
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">FIDC não encontrado</p>
          <Link to="/fundos/fidc" className="text-[#0B6C3E] hover:underline text-sm flex items-center gap-1 justify-center">
            <ArrowLeft className="w-4 h-4" /> Voltar para Módulo FIDC
          </Link>
        </div>
      </div>
    );
  }

  const fundName = meta.denom_social || `FIDC ${meta.cnpj_fundo_classe || meta.cnpj_fundo}`;

  // V5-D6: FIC-FIDC detection via denom_social pattern (subclasse_rcvm175 is
  // NULL for all FIDCs — can't be used). Drives both the header badge and the
  // <FicFidcPlaceholder/> section below.
  const isFic = isFicFidc(meta.denom_social);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Dynamic SEO for FIDC Lâmina */}
      <HubSEO
        title={fundName || "FIDC"}
        description={`Análise FIDC: ${fundName || "fundo"} — PL R$ ${formatPL(meta?.vl_patrim_liq)}, taxa de administração ${meta?.taxa_adm}%. Rentabilidade senior/subordinada, histórico mensal e composição.`}
        path={`/fundos/fidc/${slug}`}
        keywords={`${fundName}, FIDC, fundo de investimento em direitos creditórios, lâmina FIDC, análise FIDC`}
        image="https://hub.muuney.com.br/og/fidc-lamina.png"
        isProtected={true}
      />

      {/* Header Navigation */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="w-full px-4 md:px-6 py-3">
          <Breadcrumbs
            items={[
              { label: "Fundos", to: "/fundos" },
              { label: "FIDC", to: "/fundos/fidc" },
              { label: fundName },
            ]}
            className="mb-2"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold text-zinc-100 truncate">{fundName}</h1>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <ClasseBadge classe="FIDC" size="md" />
                {isFic ? (
                  <span
                    className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border"
                    style={{
                      borderColor: "#F9731588",
                      color: "#F97316",
                      backgroundColor: "#F9731620",
                    }}
                    title="Fundo de Investimento em Cotas de FIDCs — carteira investida detalhada em desenvolvimento (ver seção abaixo)"
                  >
                    FIC-FIDC
                  </span>
                ) : null}
                <span className="text-[8px] text-zinc-700">{formatCnpj(meta.cnpj_fundo_classe || meta.cnpj_fundo)}</span>
                <OfertaAtivaBadge cnpj={meta.cnpj_fundo_classe || meta.cnpj_fundo} size="sm" />
                <DataAsOfStamp
                  date={latest?.dt_comptc}
                  cadence="monthly"
                  source="CVM Informe FIDC"
                  compact
                />
              </div>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={handleExcelExport}
                disabled={isExporting || !meta}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: "#F9731655",
                  color: "#F97316",
                  backgroundColor: "#F9731612",
                }}
                aria-label="Exportar lâmina em Excel"
                title="Exportar lâmina em Excel (5 abas)"
              >
                <FileSpreadsheet className="w-3 h-3" aria-hidden="true" />
                <span>{isExporting ? "Gerando…" : "Exportar Excel"}</span>
              </button>
              <ExportPdfButton title={fundName} accent="#F97316" />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-8 space-y-8">
        {/* === Eventos Relevantes (DEEP-S1) — usa CNPJ_FUNDO_CLASSE === */}
        <FundEventsBanner
          cnpj={fidcData?.meta?.cnpj_fundo_classe || cnpj}
          days={30}
          limit={5}
        />

        {/* === Risco regulatório gestor/admin (DEEP-S2) === */}
        <GestorRiskBadge nome={fidcData?.meta?.gestor_nome ?? null} tipo="gestor" />
        <GestorRiskBadge nome={fidcData?.meta?.admin_nome ?? null} tipo="admin" />

        {/* === Atas/Editais (DEEP-S4) — assembleias últimas === */}
        <FundAssembleiasPanel
          cnpj={fidcData?.meta?.cnpj_fundo_classe || cnpj}
          accent="#F97316"
          limit={6}
        />

        {/* === Section 1: Resumo === */}
        <SectionErrorBoundary sectionName="Resumo">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#F97316]" />
              <h2 className="text-sm font-semibold text-zinc-300">Resumo</h2>
            </div>

            <NarrativeSection
              accent="#F97316"
              prose={
                <>
                  FIDC em regime{" "}
                  <span className={resumoNarrative.regime.color}>
                    {resumoNarrative.regime.label.toLowerCase()}
                  </span>
                  : subordinação{" "}
                  <span className="text-zinc-200">
                    {totalSubord != null ? `${totalSubord.toFixed(2)}%` : "—"}
                  </span>{" "}
                  protege contra inadimplência de{" "}
                  <span className="text-zinc-200">
                    {totalInadim != null ? `${totalInadim.toFixed(2)}%` : "—"}
                  </span>
                  {resumoNarrative.cushion != null && (
                    <>
                      {" "}— razão de cobertura{" "}
                      <span
                        className={
                          resumoNarrative.cushion > 3
                            ? "text-emerald-400"
                            : resumoNarrative.cushion > 1.5
                            ? "text-amber-400"
                            : "text-red-400"
                        }
                      >
                        {resumoNarrative.cushion.toFixed(1)}×
                      </span>
                    </>
                  )}
                  {vsCDIMetric && (
                    <>
                      . Retorno acumulado vs CDI:{" "}
                      <span
                        className={
                          vsCDIMetric.excess > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }
                      >
                        {vsCDIMetric.excess >= 0 ? "+" : ""}
                        {vsCDIMetric.excess.toFixed(2)}pp
                      </span>
                    </>
                  )}
                  .
                </>
              }
              miniStats={resumoMiniStats}
            >
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="PL Total"
                value={formatPL(latest?.vl_pl_total || meta.vl_patrim_liq)}
                color="text-zinc-300"
              />
              <KPICard
                label="Subordinação"
                value={totalSubord != null ? totalSubord.toFixed(2) : "—"}
                unit="%"
                color={totalSubord != null && totalSubord < 10 ? "text-red-400" : "text-emerald-400"}
              />
              <KPICard
                label="Inadimplência"
                value={totalInadim != null ? totalInadim.toFixed(2) : "—"}
                unit="%"
                color={totalInadim != null && totalInadim > 5 ? "text-red-400" : "text-emerald-400"}
              />
              <KPICard
                label="Gestor"
                value={meta.gestor_nome?.split(" ")[0] || "—"}
                color="text-zinc-400"
              />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[9px] font-mono">
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Carteira Total</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_direitos)}</div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Carteira a Vencer</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_a_vencer)}</div>
              </div>
              <div className="bg-[#111111] border border-[#1a1a1a] rounded p-3">
                <div className="text-zinc-600 uppercase tracking-wider mb-1">Inadimplência</div>
                <div className="text-zinc-300">{formatPL(latest?.vl_carteira_inadimplente)}</div>
              </div>
            </div>

            {/* Health Assessment */}
            {healthAssessment.length > 0 && (
              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 space-y-2">
                <h4 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-1">Avaliação Automática</h4>
                {healthAssessment.map((s) => {
                  const severityStyles = {
                    positive: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
                    warning: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
                    alert: { bg: "bg-red-500/5", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-400" },
                  };
                  const style = severityStyles[s.severity];
                  return (
                    <div key={s.label} className={`${style.bg} border ${style.border} rounded px-3 py-2 flex items-start gap-2`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${style.dot} mt-1 shrink-0`} />
                      <div>
                        <span className={`text-[9px] font-mono font-bold ${style.text}`}>{s.label}</span>
                        <p className="text-[8px] text-zinc-600 mt-0.5">{s.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </NarrativeSection>
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 2: Estrutura de Capital === */}
        {capitalSeries.length > 1 && (
          <SectionErrorBoundary sectionName="Estrutura de Capital">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Estrutura de Capital</h2>
              </div>

              {/* Capital Stacked Bar */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">PL por Classe (em R$ Mi)</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={capitalSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      tickLine={false}
                      axisLine={{ stroke: "#1a1a1a" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4 }}
                      labelStyle={{ color: "#d4d4d8" }}
                      formatter={(v: number | string) => `R$ ${typeof v === "number" ? v.toFixed(0) : Number(v).toFixed(0)} Mi`}
                    />
                    <Bar dataKey="senior" stackId="a" fill="#0B6C3E" name="Senior" />
                    <Bar dataKey="subord" stackId="a" fill="#F59E0B" name="Subordinada" />
                    <Bar dataKey="mezanino" stackId="a" fill="#8B5CF6" name="Mezanino" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Subordinacao Index */}
              {subordinacaoSeries.length > 1 && (
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                  <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Índice de Subordinação (%)</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={subordinacaoSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#71717a" }}
                        tickLine={false}
                        axisLine={{ stroke: "#1a1a1a" }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4 }}
                        labelStyle={{ color: "#d4d4d8" }}
                        formatter={(v: number | string) => `${typeof v === "number" ? v.toFixed(2) : Number(v).toFixed(2)}%`}
                      />
                      <Line
                        type="monotone"
                        dataKey="subordinacao_pct"
                        stroke="#0B6C3E"
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* === Lâmina CVM (DEEP-S1) — política e taxas === */}
        <FundLaminaPolicyPanel
          cnpj={fidcData?.meta?.cnpj_fundo_classe || cnpj}
          accent="#F97316"
        />

        {/* === Perfil cotistas (DEEP-S2) — 17 categorias × % PL + FPR estresse === */}
        <FundPerfilCotistasPanel
          cnpj={fidcData?.meta?.cnpj_fundo_classe || cnpj}
          accent="#F97316"
        />

        {/* === Section 3: Carteira === */}
        <SectionErrorBoundary sectionName="Carteira">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Carteira</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                label="Carteira Total"
                value={formatPL(latest?.vl_carteira_direitos)}
                color="text-zinc-300"
              />
              <KPICard
                label="A Vencer"
                value={formatPL(latest?.vl_carteira_a_vencer)}
                color="text-[#0B6C3E]"
              />
              <KPICard
                label="Inadimplente"
                value={formatPL(latest?.vl_carteira_inadimplente)}
                color={latest?.vl_carteira_inadimplente && latest.vl_carteira_inadimplente > 0 ? "text-red-400" : "text-zinc-300"}
              />
              <KPICard
                label="PDD Constituída"
                value={formatPL(latest?.vl_pdd)}
                color="text-orange-400"
              />
            </div>

            {/* Carteira Composition Info */}
            <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
              <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Análise de Carteira</h3>
              <div className="space-y-2 text-[9px] font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Taxa de Inadimplência</span>
                  <span className={totalInadim && totalInadim > 5 ? "text-red-400" : "text-emerald-400"}>{totalInadim?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cobertura PDD</span>
                  <span className="text-zinc-300">
                    {latest?.vl_carteira_inadimplente && latest?.vl_pdd
                      ? ((latest.vl_pdd / latest.vl_carteira_inadimplente) * 100).toFixed(1)
                      : "—"}%
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-[#1a1a1a]">
                  <span className="text-zinc-600">Carteira Prejuízo</span>
                  <span className={carteiraPrejuizo > 0 ? "text-red-400" : "text-emerald-400"}>{formatPL(carteiraPrejuizo)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Cotistas</span>
                  <span className="text-zinc-300">{((latest?.nr_cotistas_senior || 0) + (latest?.nr_cotistas_subordinada || 0)).toLocaleString("pt-BR") || "—"}</span>
                </div>
              </div>
            </div>

            {/* V5 Depth Panel — prazo, duration, breakdown vencimento, SCR rating, top 5 cedentes */}
            <FidcCarteiraDepthPanel latest={latest ?? null} cnpjFundo={cnpj} />

            {/* DEEP-S4: Liquidez por horizonte de saque (Tab V CVM) */}
            <FidcLiquidezPanel latest={latest ?? null} />

            {/* DEEP-S4: Safras de concessão (vintage — vl_captacao_mes histórico) */}
            <FidcSafrasPanel monthly={monthly as FidcMonthlyItem[]} lookbackMonths={24} />
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 3b: FIC-FIDC Transparência (Path B) === */}
        {/* V5-D6: Renders only when fund name matches FIC-FIDC pattern. Full
            carteira investida composition is deferred to post-beta sprint
            (Path A — requires Tab_IX ingestion + CDA parser fix). */}
        {isFic ? (
          <SectionErrorBoundary sectionName="FIC-FIDC Transparência">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-4"
            >
              <div className="lg:col-span-2">
                <FicFidcPlaceholder fundName={fundName} accent="#F97316" />
              </div>
              <div>
                <CvmRegulationCard preset="cvm-175" compact />
              </div>
            </motion.div>
          </SectionErrorBoundary>
        ) : null}

        {/* === Section 3c: Glossário FIDC (V5-D7, collapsible) === */}
        <SectionErrorBoundary sectionName="Glossário FIDC">
          <GlossarioFidc accent="#F97316" />
        </SectionErrorBoundary>

        {/* === Section 4: Performance === */}
        {rentabilidadeSeries.length > 1 && (
          <SectionErrorBoundary sectionName="Performance">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-[#0B6C3E]" />
                <h2 className="text-sm font-semibold text-zinc-300">Rentabilidade</h2>
              </div>

              {/* Indexed Chart (Base 100 + CDI) */}
              {indexedSeries.length > 1 && (
                <div className="space-y-3">
                  {vsCDIMetric && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <KPICard
                        label="Retorno Acumulado"
                        value={vsCDIMetric.fundReturn.toFixed(2)}
                        unit="%"
                        color="text-[#0B6C3E]"
                      />
                      <KPICard
                        label="CDI Acumulado"
                        value={vsCDIMetric.cdiReturn.toFixed(2)}
                        unit="%"
                        color="text-zinc-400"
                      />
                      <KPICard
                        label="vs CDI"
                        value={vsCDIMetric.excess.toFixed(2)}
                        unit="%"
                        color={vsCDIMetric.excess >= 0 ? "text-emerald-400" : "text-red-400"}
                      />
                    </div>
                  )}

                  {/* Risco & Retorno — derived from monthly rentabilidade */}
                  {riskMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      <KPICard
                        label="Retorno (a.a.)"
                        value={riskMetrics.return_annualized != null ? riskMetrics.return_annualized.toFixed(2) : "—"}
                        unit="%"
                        color={riskMetrics.return_annualized != null && riskMetrics.return_annualized >= 0 ? "text-emerald-400" : "text-red-400"}
                        sublabel="anualizado"
                      />
                      <KPICard
                        label="Volatilidade"
                        value={riskMetrics.volatility != null ? riskMetrics.volatility.toFixed(2) : "—"}
                        unit="%"
                        color="text-orange-400"
                        sublabel="mensal → anual"
                      />
                      <KPICard
                        label="Sharpe"
                        value={riskMetrics.sharpe != null ? riskMetrics.sharpe.toFixed(2) : "—"}
                        color={riskMetrics.sharpe != null && riskMetrics.sharpe >= 1.0 ? "text-emerald-400" : "text-orange-400"}
                        sublabel="vs CDI / vol"
                      />
                      <KPICard
                        label="Sortino"
                        value={riskMetrics.sortino != null ? riskMetrics.sortino.toFixed(2) : "—"}
                        color={riskMetrics.sortino != null && riskMetrics.sortino >= 1.0 ? "text-emerald-400" : "text-orange-400"}
                        sublabel="vs risco baixista"
                      />
                      <KPICard
                        label="Max DD"
                        value={riskMetrics.max_drawdown != null ? riskMetrics.max_drawdown.toFixed(2) : "—"}
                        unit="%"
                        color="text-red-400"
                        sublabel="pior queda"
                      />
                    </div>
                  )}

                  {/* Rolling Returns Grid — 1m/3m/6m/12m/24m/36m */}
                  <RollingReturnsGrid
                    rows={rollingRows}
                    subtitle="Retornos acumulados e anualizados — base informes mensais CVM."
                    accent="#F97316"
                  />

                  {/* Peer beats — "Fundos que estão batendo este" */}
                  {peerBeatsItems.length > 0 && (
                    <PeerBeatsPanel
                      accent="#F97316"
                      basePath="/fundos/fidc"
                      peers={peerBeatsItems}
                      baseValue={cleanRentab(latest?.rentab_fundo)}
                      metricLabel="Rentab"
                      unit="%"
                    />
                  )}

                  {/* Drawdown Heatmap — calendário mensal ano × mês */}
                  {drawdownCells.length > 0 && (
                    <DrawdownHeatmap
                      cells={drawdownCells}
                      summary={drawdownSummary}
                      subtitle="Rentabilidade mensal do fundo e drawdown corrente a partir da cota."
                      accent="#F97316"
                    />
                  )}

                  {/* Fund-scope narrative (regime + sinais específicos FIDC) */}
                  {fundNarrativeContext && (
                    <FundNarrativePanel scope="fund" fundContext={fundNarrativeContext} />
                  )}

                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                    <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Rentabilidade Indexada (Base 100)</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={indexedSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#71717a" }}
                          tickLine={false}
                          axisLine={{ stroke: "#1a1a1a" }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4 }}
                          labelStyle={{ color: "#d4d4d8" }}
                          formatter={(v: number | string) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                        />
                        <Legend
                          wrapperStyle={{ paddingTop: 12 }}
                          iconType="line"
                          height={24}
                        />
                        <Line
                          type="monotone"
                          dataKey="index"
                          name="Fundo"
                          stroke="#0B6C3E"
                          dot={false}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="cdi"
                          name="CDI"
                          stroke="#a1a1aa"
                          strokeDasharray="5 5"
                          dot={false}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Monthly Rentabilities (Senior, Subordinada, Fundo) */}
              <div className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4">
                <h3 className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-3">Rentabilidade Mensal (Senior, Subordinada, Fundo)</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={rentabilidadeSeries} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#71717a" }}
                      tickLine={false}
                      axisLine={{ stroke: "#1a1a1a" }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={{ stroke: "#1a1a1a" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#111111", border: "1px solid #1a1a1a", borderRadius: 4 }}
                      labelStyle={{ color: "#d4d4d8" }}
                      formatter={(v: number | string) => (typeof v === "number" ? v.toFixed(2) : String(v))}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_senior"
                      stroke="#0B6C3E"
                      name="Senior"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_subord"
                      stroke="#F59E0B"
                      name="Subordinada"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="rentab_fundo"
                      stroke="#8B5CF6"
                      name="Fundo"
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* === Section 5: Informações === */}
        <SectionErrorBoundary sectionName="Informações">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-[#0B6C3E]" />
              <h2 className="text-sm font-semibold text-zinc-300">Informações do FIDC</h2>
            </div>

            {meta && (
              <div className="grid grid-cols-2 gap-4 text-[9px] font-mono">
                <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                  <div className="text-zinc-600 uppercase tracking-wider mb-2">Gestor</div>
                  <div className="text-zinc-300 font-semibold">{meta.gestor_nome || "—"}</div>
                  <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_gestor || "")}</div>
                </div>
                <div className="bg-[#111111] border border-[#1a1a1a] rounded p-4">
                  <div className="text-zinc-600 uppercase tracking-wider mb-2">Administrador</div>
                  <div className="text-zinc-300 font-semibold">{meta.admin_nome || "—"}</div>
                  <div className="text-zinc-700 mt-1">{formatCnpj(meta.cnpj_admin || "")}</div>
                </div>
              </div>
            )}

            {meta && (
              <ManagerTenureTimeline
                cnpj={meta.cnpj_fundo_classe || meta.cnpj_fundo}
                dt_const={meta.dt_const}
                gestor_nome={meta.gestor_nome}
                accent="#F97316"
              />
            )}
          </motion.div>
        </SectionErrorBoundary>

        {/* === Section 6: Fundos Similares === */}
        {(!fidcData?.similar || fidcData.similar.length === 0) && !fidcLoading && (
          <div className="text-center py-6 text-zinc-600 text-xs font-mono">
            Nenhum FIDC similar encontrado para o mesmo tipo de lastro.
          </div>
        )}
        {fidcData?.similar && fidcData.similar.length > 0 && (
          <SectionErrorBoundary sectionName="Fundos Similares">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <LineChartIcon className="w-4 h-4 text-[#F97316]" />
                <h2 className="text-sm font-semibold text-zinc-300">FIDCs Similares</h2>
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mb-4">
                Referência: {meta?.denom_social || "—"}
                {latest?.indice_subordinacao != null &&
                  ` · Subord ${latest.indice_subordinacao.toFixed(1)}%`}
                {latest?.taxa_inadimplencia != null &&
                  ` · Inadim ${latest.taxa_inadimplencia.toFixed(2)}%`}
                {latest?.rentab_fundo != null &&
                  cleanRentab(latest.rentab_fundo) != null &&
                  ` · Rentab ${cleanRentab(latest.rentab_fundo)!.toFixed(2)}%`}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fidcData.similar.slice(0, 6).map((fund, idx) => {
                  const peerSubord = fund.indice_subordinacao ?? null;
                  const baseSubord = latest?.indice_subordinacao ?? null;
                  const deltaSubord =
                    peerSubord != null && baseSubord != null
                      ? peerSubord - baseSubord
                      : null;
                  const peerRentab = cleanRentab(fund.rentab_fundo);
                  const baseRentab = cleanRentab(latest?.rentab_fundo);
                  const deltaRentab =
                    peerRentab != null && baseRentab != null
                      ? peerRentab - baseRentab
                      : null;
                  const peerInadim = fund.taxa_inadimplencia ?? null;

                  return (
                    <Link
                      key={idx}
                      to={`/fundos/fidc/${fund.slug || fund.cnpj_fundo}`}
                      className="bg-[#111111] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#F97316]/30 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-zinc-300 group-hover:text-[#F97316] truncate transition-colors">
                            {fund.denom_social || `FIDC ${fund.cnpj_fundo}`}
                          </div>
                          {fund.tp_lastro_principal && (
                            <div className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/30">
                              {fund.tp_lastro_principal}
                            </div>
                          )}
                          {fund.gestor_nome && (
                            <div className="text-[9px] font-mono text-zinc-600 mt-1.5 truncate">
                              {fund.gestor_nome}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-mono text-zinc-400">{formatPL(fund.vl_pl_total)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2 border-t border-[#1a1a1a] text-[9px] font-mono flex-wrap">
                        {peerRentab != null ? (
                          <span className="text-zinc-600">
                            Rentab{" "}
                            <span className={peerRentab >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {peerRentab.toFixed(2)}%
                            </span>
                            {deltaRentab != null && (
                              <span className={`ml-1 ${deltaRentab > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                ({deltaRentab > 0 ? "+" : ""}
                                {deltaRentab.toFixed(2)}pp)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-700">Rentab —</span>
                        )}
                        {peerSubord != null ? (
                          <span className="text-zinc-600">
                            Subord{" "}
                            <span className="text-zinc-400">{peerSubord.toFixed(1)}%</span>
                            {deltaSubord != null && (
                              <span className={`ml-1 ${deltaSubord > 0 ? "text-emerald-500" : "text-amber-500"}`}>
                                ({deltaSubord > 0 ? "+" : ""}
                                {deltaSubord.toFixed(1)}pp)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-700">Subord —</span>
                        )}
                        {peerInadim != null && (
                          <span className="text-zinc-600">
                            Inadim{" "}
                            <span className={peerInadim > 5 ? "text-red-400" : "text-zinc-400"}>
                              {peerInadim.toFixed(2)}%
                            </span>
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </SectionErrorBoundary>
        )}

        {/* Print-only footer (hidden in app, visible in PDF) */}
        <PrintFooter
          fundName={fundName}
          dataAsOf={latest?.dt_comptc ?? null}
          source="CVM Informe FIDC"
        />
      </div>
    </div>
  );
}
