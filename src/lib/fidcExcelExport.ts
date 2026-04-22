/**
 * fidcExcelExport.ts — V5-D2 (22/04/2026)
 *
 * FIDC-specific Excel export used by FidcLamina header button.
 *
 * Produces a 5-sheet .xlsx workbook:
 *   1. Cadastrais           key/value snapshot of fund meta
 *   2. Carteira Histórica   monthly time series (20 cols)
 *   3. Indicadores de Risco KPIs + rolling returns + drawdown summary
 *   4. Composição Carteira  capital structure + portfolio breakdown
 *                           (FIDCs não possuem CDA ICVM 555)
 *   5. Peer Benchmark       similar FIDCs with Δ vs current fund
 *
 * SheetJS is lazy-loaded via src/lib/xlsxExport.ts. All cells carry
 * pt-BR number formats (currency R$, decimals, percent, dates).
 */

import {
  exportWorkbook,
  xlsxFilename,
  toDate,
  rnd,
  type XlsxSheet,
  type XlsxCellValue,
} from "./xlsxExport";
import type { FundMeta, FidcMonthlyItem, FidcDetailResponse } from "@/hooks/useHubFundos";
import { computeMonthlyRiskMetrics } from "./monthlyRiskMetrics";
import { computeRollingReturnsFromMonthly } from "./rollingReturns";
import { computeMonthlyGridFromMonthly, summarizeDrawdown } from "./drawdown";

const CORRUPT_RENTAB_THRESHOLD = 95; // % in a single month

function cleanRentab(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (!isFinite(n)) return null;
  if (Math.abs(n) > CORRUPT_RENTAB_THRESHOLD) return null;
  return n;
}

/** Pretty label for null cells ("—" keeps the sheet tidy). */
const DASH = "—";

type SimilarFidc = FidcDetailResponse["similar"][number];

/* ─────────────────────────────── Public API ─────────────────────────────── */

export async function exportFidcLamina(
  meta: FundMeta,
  monthly: FidcMonthlyItem[],
  latest: FidcMonthlyItem | null,
  similar: SimilarFidc[] = [],
): Promise<void> {
  const sheets: XlsxSheet[] = [
    buildCadastraisSheet(meta, latest),
    buildCarteiraHistoricaSheet(monthly),
    buildIndicadoresRiscoSheet(monthly),
    buildComposicaoSheet(latest),
    buildPeerBenchmarkSheet(latest, similar),
  ];

  const fundId = meta.slug || meta.cnpj_fundo_classe || meta.cnpj_fundo || "fidc";
  const filename = xlsxFilename("fidc", "lamina", fundId);
  await exportWorkbook(filename, sheets);
}

/* ─────────────────────────────── Sheet 1 ───────────────────────────────── */

function buildCadastraisSheet(meta: FundMeta, latest: FidcMonthlyItem | null): XlsxSheet {
  // Cadastrais is a flat key/value sheet. We keep "Valor" as generic text so
  // labels self-describe the unit ("Patrimônio líquido (R$)", "Taxa de
  // administração (% a.a.)", etc.) — this avoids forcing a single numfmt on
  // a column that holds strings, dates and numbers.
  const rows: { campo: string; valor: XlsxCellValue }[] = [
    cad("Nome", meta.denom_social),
    cad("CNPJ Fundo", meta.cnpj_fundo),
    cad("CNPJ Classe", meta.cnpj_fundo_classe),
    cad("Slug", meta.slug),
    cad("Classe RCVM 175", meta.classe_rcvm175 ?? "FIDC"),
    cad("Subclasse RCVM 175", meta.subclasse_rcvm175),
    cad("Classe ANBIMA", meta.classe_anbima),
    cad("Condomínio", meta.condom),
    cad("Público-alvo", meta.publico_alvo),
    cad("Tributação", meta.tributacao),
    cad("Prazo de resgate", meta.prazo_resgate),
    cad("Aplicação mínima (R$)", meta.aplicacao_min),
    cad("Benchmark", meta.benchmark),
    cad("Taxa de administração (% a.a.)", meta.taxa_adm),
    cad("Taxa de performance", meta.taxa_perfm),
    cad("Gestor", meta.gestor_nome),
    cad("CNPJ gestor", meta.cnpj_gestor),
    cad("Administrador", meta.admin_nome),
    cad("CNPJ administrador", meta.cnpj_admin),
    cad("Situação", meta.sit),
    cad("Data de constituição", toDate(meta.dt_const)),
    cad("Data de registro", toDate(meta.dt_reg)),
    cad("Patrimônio líquido (R$)", meta.vl_patrim_liq),
    cad("Data do PL", toDate(meta.dt_patrim_liq)),
    cad("Nº de cotistas (cadastro)", meta.nr_cotistas),
    cad("Tipo de lastro principal", latest?.tp_lastro_principal ?? null),
    cad("Data do último informe", toDate(latest?.dt_comptc)),
  ];

  return {
    name: "Cadastrais",
    title: `${meta.denom_social ?? "FIDC"} — cadastrais`,
    columns: [
      { header: "Campo", key: "campo", width: 36 },
      { header: "Valor", key: "valor", width: 52 },
    ],
    rows,
  };
}

function cad(label: string, value: XlsxCellValue): { campo: string; valor: XlsxCellValue } {
  if (value == null || value === "") return { campo: label, valor: DASH };
  return { campo: label, valor: value };
}

/* ─────────────────────────────── Sheet 2 ───────────────────────────────── */

function buildCarteiraHistoricaSheet(monthly: FidcMonthlyItem[]): XlsxSheet {
  const sorted = [...monthly].sort((a, b) => a.dt_comptc.localeCompare(b.dt_comptc));
  const rows = sorted.map((m) => ({
    data: toDate(m.dt_comptc),
    pl_total: m.vl_pl_total,
    pl_senior: m.vl_pl_senior,
    pl_subord: m.vl_pl_subordinada,
    pl_mezanino: m.vl_pl_mezanino ?? null,
    carteira_direitos: m.vl_carteira_direitos,
    carteira_a_vencer: m.vl_carteira_a_vencer,
    carteira_inadimplente: m.vl_carteira_inadimplente,
    carteira_prejuizo: m.vl_carteira_prejuizo,
    pdd: m.vl_pdd,
    cotistas_senior: m.nr_cotistas_senior ?? null,
    cotistas_subord: m.nr_cotistas_subordinada ?? null,
    rentab_fundo: cleanRentab(m.rentab_fundo),
    rentab_senior: cleanRentab(m.rentab_senior),
    rentab_subord: cleanRentab(m.rentab_subordinada),
    subordinacao: m.indice_subordinacao,
    inadimplencia: m.taxa_inadimplencia,
    pdd_cobertura: m.indice_pdd_cobertura,
    nr_cedentes: m.nr_cedentes,
    concentracao_cedente: m.concentracao_cedente,
  }));

  return {
    name: "Carteira Histórica",
    columns: [
      { header: "Data", key: "data", format: "date", width: 12 },
      { header: "PL Total (R$)", key: "pl_total", format: "currency", width: 18 },
      { header: "PL Senior (R$)", key: "pl_senior", format: "currency", width: 18 },
      { header: "PL Subordinada (R$)", key: "pl_subord", format: "currency", width: 20 },
      { header: "PL Mezanino (R$)", key: "pl_mezanino", format: "currency", width: 18 },
      { header: "Carteira Direitos (R$)", key: "carteira_direitos", format: "currency", width: 22 },
      { header: "Carteira a Vencer (R$)", key: "carteira_a_vencer", format: "currency", width: 22 },
      { header: "Carteira Inadimplente (R$)", key: "carteira_inadimplente", format: "currency", width: 24 },
      { header: "Carteira Prejuízo (R$)", key: "carteira_prejuizo", format: "currency", width: 22 },
      { header: "PDD (R$)", key: "pdd", format: "currency", width: 16 },
      { header: "Cotistas Senior", key: "cotistas_senior", format: "int", width: 16 },
      { header: "Cotistas Subordinada", key: "cotistas_subord", format: "int", width: 20 },
      { header: "Rentab. Fundo (%)", key: "rentab_fundo", format: "percent_lit", width: 18 },
      { header: "Rentab. Senior (%)", key: "rentab_senior", format: "percent_lit", width: 18 },
      { header: "Rentab. Subord. (%)", key: "rentab_subord", format: "percent_lit", width: 20 },
      { header: "Subordinação (%)", key: "subordinacao", format: "percent_lit", width: 18 },
      { header: "Inadimplência (%)", key: "inadimplencia", format: "percent_lit", width: 18 },
      { header: "PDD Cobertura (%)", key: "pdd_cobertura", format: "percent_lit", width: 18 },
      { header: "Nº Cedentes", key: "nr_cedentes", format: "int", width: 14 },
      { header: "Conc. Cedente (%)", key: "concentracao_cedente", format: "percent_lit", width: 18 },
    ],
    rows,
  };
}

/* ─────────────────────────────── Sheet 3 ───────────────────────────────── */

function buildIndicadoresRiscoSheet(monthly: FidcMonthlyItem[]): XlsxSheet {
  const rows: Record<string, XlsxCellValue>[] = [];

  const cleanedReturns = monthly
    .map((m) => cleanRentab(m.rentab_fundo))
    .filter((r): r is number => r != null);

  // Block A — KPI summary
  rows.push(blockHeader("A. Indicadores Consolidados"));
  if (cleanedReturns.length >= 3) {
    const m = computeMonthlyRiskMetrics(cleanedReturns);
    rows.push(riskRow("Retorno acumulado (período)", "—", m.return_period, "percent_lit"));
    rows.push(riskRow("Retorno anualizado", "≥12m equiv.", m.return_annualized, "percent_lit"));
    rows.push(riskRow("Volatilidade anualizada", "—", m.volatility, "percent_lit"));
    rows.push(riskRow("Sharpe (vs Selic 14,15%)", "—", rnd(m.sharpe, 2), "decimal"));
    rows.push(riskRow("Sortino (vs Selic 14,15%)", "—", rnd(m.sortino, 2), "decimal"));
    rows.push(riskRow("Max drawdown", "—", m.max_drawdown, "percent_lit"));
    rows.push(riskRow("Calmar", "—", rnd(m.calmar, 2), "decimal"));
    rows.push(riskRow("Meses positivos", "—", m.positive_months_pct, "percent_lit"));
    rows.push(riskRow("Pontos de dados", "meses", m.data_points, "int"));
  } else {
    rows.push(riskRow("Série insuficiente", "< 3 meses", null));
  }

  rows.push(blankRow());

  // Block B — Rolling returns
  rows.push(blockHeader("B. Retornos Trailing (rolling)"));
  if (cleanedReturns.length >= 1) {
    const rolling = computeRollingReturnsFromMonthly(cleanedReturns);
    for (const r of rolling) {
      rows.push({
        categoria: "Retorno acumulado",
        janela: r.label,
        valor: r.returnPct,
        unidade: "%",
      });
      rows.push({
        categoria: "Retorno anualizado",
        janela: r.label,
        valor: r.annualizedPct,
        unidade: "%",
      });
      rows.push({
        categoria: "CDI no período",
        janela: r.label,
        valor: r.cdiPct,
        unidade: "%",
      });
      rows.push({
        categoria: "vs CDI (Δ)",
        janela: r.label,
        valor: r.vsCdiPct,
        unidade: "pp",
      });
    }
  }

  rows.push(blankRow());

  // Block C — Drawdown summary
  rows.push(blockHeader("C. Drawdown"));
  const dated = monthly
    .map((m) => {
      const r = cleanRentab(m.rentab_fundo);
      return m.dt_comptc ? { dt_comptc: m.dt_comptc, returnPct: r } : null;
    })
    .filter((x): x is { dt_comptc: string; returnPct: number | null } => x !== null);
  if (dated.length >= 3) {
    const grid = computeMonthlyGridFromMonthly(dated);
    const summary = summarizeDrawdown(grid);
    rows.push(riskRow("Max drawdown", "—", summary.maxDrawdownPct, "percent_lit"));
    rows.push(riskRow("Mês do pico", "YYYY-MM", summary.peakMonth ?? null));
    rows.push(riskRow("Mês do vale", "YYYY-MM", summary.troughMonth ?? null));
    rows.push(riskRow("Meses underwater", "meses", summary.monthsUnderwater, "int"));
    rows.push(riskRow("Total de meses observados", "meses", summary.totalMonths, "int"));
  } else {
    rows.push(riskRow("Série insuficiente", "< 3 meses", null));
  }

  return {
    name: "Indicadores de Risco",
    columns: [
      { header: "Categoria", key: "categoria", width: 36 },
      { header: "Janela", key: "janela", width: 14 },
      { header: "Valor", key: "valor", format: "decimal", width: 18 },
      { header: "Unidade", key: "unidade", width: 12 },
    ],
    rows,
  };
}

function blockHeader(label: string): Record<string, XlsxCellValue> {
  return { categoria: label, janela: "", valor: "", unidade: "" };
}

function blankRow(): Record<string, XlsxCellValue> {
  return { categoria: "", janela: "", valor: "", unidade: "" };
}

function riskRow(
  categoria: string,
  janela: string,
  valor: XlsxCellValue,
  _format?: "currency" | "percent" | "percent_lit" | "int" | "date" | "decimal",
  unidade: string = "",
): Record<string, XlsxCellValue> {
  // We keep a single Valor column with generic "decimal" numfmt. Callers
  // put pp/% as unidade so users can read the number correctly without
  // Excel rendering 0.05 as 5% (which would happen if we set percent here).
  return { categoria, janela, valor, unidade };
}

/* ─────────────────────────────── Sheet 4 ───────────────────────────────── */

function buildComposicaoSheet(latest: FidcMonthlyItem | null): XlsxSheet {
  const rows: Record<string, XlsxCellValue>[] = [];

  if (!latest) {
    rows.push({
      categoria: "Sem dados",
      componente: "—",
      valor: null,
      pct: null,
    });
    return {
      name: "Composição Carteira",
      columns: compColumns(),
      rows,
    };
  }

  const plTotal = latest.vl_pl_total ?? null;
  const plSenior = latest.vl_pl_senior ?? null;
  const plSubord = latest.vl_pl_subordinada ?? null;
  const plMezanino = latest.vl_pl_mezanino ?? null;

  rows.push(blockHeaderComp("A. Estrutura de capital"));
  pushCapRow(rows, "Senior", plSenior, plTotal);
  pushCapRow(rows, "Mezanino", plMezanino, plTotal);
  pushCapRow(rows, "Subordinada", plSubord, plTotal);
  pushCapRow(rows, "PL Total", plTotal, plTotal);

  rows.push(blankRowComp());

  // Portfolio breakdown
  const carteira = latest.vl_carteira_direitos ?? null;
  rows.push(blockHeaderComp("B. Composição da carteira"));
  pushCapRow(rows, "Direitos creditórios (total)", carteira, carteira);
  pushCapRow(rows, "A vencer", latest.vl_carteira_a_vencer ?? null, carteira);
  pushCapRow(rows, "Inadimplente", latest.vl_carteira_inadimplente ?? null, carteira);
  pushCapRow(rows, "Prejuízo", latest.vl_carteira_prejuizo ?? null, carteira);
  pushCapRow(rows, "PDD (provisão)", latest.vl_pdd ?? null, carteira);

  rows.push(blankRowComp());

  // Concentration + indicators
  rows.push(blockHeaderComp("C. Concentração e indicadores"));
  rows.push({
    categoria: "Indicador",
    componente: "Nº de cedentes",
    valor: latest.nr_cedentes ?? null,
    pct: null,
  });
  rows.push({
    categoria: "Indicador",
    componente: "Concentração maior cedente (%)",
    valor: latest.concentracao_cedente ?? null,
    pct: null,
  });
  rows.push({
    categoria: "Indicador",
    componente: "Subordinação efetiva (%)",
    valor: latest.indice_subordinacao ?? null,
    pct: null,
  });
  rows.push({
    categoria: "Indicador",
    componente: "Taxa de inadimplência (%)",
    valor: latest.taxa_inadimplencia ?? null,
    pct: null,
  });
  rows.push({
    categoria: "Indicador",
    componente: "PDD cobertura (%)",
    valor: latest.indice_pdd_cobertura ?? null,
    pct: null,
  });
  rows.push({
    categoria: "Indicador",
    componente: "Tipo de lastro principal",
    valor: latest.tp_lastro_principal ?? null,
    pct: null,
  });

  rows.push(blankRowComp());
  rows.push({
    categoria: "Nota",
    componente:
      "FIDCs não reportam CDA ICVM 555 (estrutura Informe Mensal FIDC é distinta).",
    valor: null,
    pct: null,
  });

  return {
    name: "Composição Carteira",
    columns: compColumns(),
    rows,
  };
}

function compColumns() {
  return [
    { header: "Categoria", key: "categoria", width: 24 },
    { header: "Componente", key: "componente", width: 48 },
    { header: "Valor (R$)", key: "valor", format: "currency" as const, width: 22 },
    { header: "% do Total", key: "pct", format: "percent_lit" as const, width: 14 },
  ];
}

function pushCapRow(
  rows: Record<string, XlsxCellValue>[],
  componente: string,
  valor: number | null,
  total: number | null,
): void {
  const pct =
    valor != null && total != null && total > 0 ? rnd((valor / total) * 100, 2) : null;
  rows.push({
    categoria: "Capital",
    componente,
    valor,
    pct,
  });
}

function blockHeaderComp(label: string): Record<string, XlsxCellValue> {
  return { categoria: label, componente: "", valor: null, pct: null };
}

function blankRowComp(): Record<string, XlsxCellValue> {
  return { categoria: "", componente: "", valor: null, pct: null };
}

/* ─────────────────────────────── Sheet 5 ───────────────────────────────── */

function buildPeerBenchmarkSheet(
  latest: FidcMonthlyItem | null,
  similar: SimilarFidc[],
): XlsxSheet {
  const baseRentab = cleanRentab(latest?.rentab_fundo);
  const baseSubord = latest?.indice_subordinacao ?? null;
  const baseInadim = latest?.taxa_inadimplencia ?? null;

  const rows = (similar ?? []).map((peer) => {
    const peerRentab = cleanRentab(peer.rentab_fundo);
    const peerSubord = peer.indice_subordinacao ?? null;
    const peerInadim = peer.taxa_inadimplencia ?? null;
    return {
      nome: peer.denom_social ?? `FIDC ${peer.cnpj_fundo}`,
      cnpj: peer.cnpj_fundo,
      lastro: peer.tp_lastro_principal ?? null,
      gestor: peer.gestor_nome ?? null,
      pl: peer.vl_pl_total ?? null,
      rentab: peerRentab,
      subord: peerSubord,
      inadim: peerInadim,
      delta_rentab:
        peerRentab != null && baseRentab != null ? rnd(peerRentab - baseRentab, 2) : null,
      delta_subord:
        peerSubord != null && baseSubord != null ? rnd(peerSubord - baseSubord, 2) : null,
      delta_inadim:
        peerInadim != null && baseInadim != null ? rnd(peerInadim - baseInadim, 2) : null,
    };
  });

  return {
    name: "Peer Benchmark",
    title: "Fundos similares por tipo de lastro",
    columns: [
      { header: "Nome", key: "nome", width: 40 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "Lastro", key: "lastro", width: 20 },
      { header: "Gestor", key: "gestor", width: 28 },
      { header: "PL (R$)", key: "pl", format: "currency", width: 20 },
      { header: "Rentab. Fundo (%)", key: "rentab", format: "percent_lit", width: 18 },
      { header: "Subordinação (%)", key: "subord", format: "percent_lit", width: 18 },
      { header: "Inadimplência (%)", key: "inadim", format: "percent_lit", width: 18 },
      { header: "Δ Rentab (pp)", key: "delta_rentab", format: "decimal", width: 16 },
      { header: "Δ Subord (pp)", key: "delta_subord", format: "decimal", width: 16 },
      { header: "Δ Inadim (pp)", key: "delta_inadim", format: "decimal", width: 16 },
    ],
    rows,
  };
}
