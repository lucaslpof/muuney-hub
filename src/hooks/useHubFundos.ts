import { useQuery } from "@tanstack/react-query";

const CVM_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-cvm-api";

/* ─── Types ─── */
export interface FundMeta {
  cnpj_fundo: string;
  denom_social: string;
  cd_cvm: number | null;
  tp_fundo: string | null;
  classe: string | null;
  classe_anbima: string | null;
  condom: string | null;
  fundo_cotas: string | null;
  fundo_exclusivo: string | null;
  invest_qualif: string | null;
  taxa_adm: number | null;
  taxa_perfm: number | null;
  benchmark: string | null;
  vl_patrim_liq: number | null;
  dt_patrim_liq: string | null;
  nr_cotistas: number | null;
  cnpj_admin: string | null;
  admin_nome: string | null;
  cnpj_gestor: string | null;
  gestor_nome: string | null;
  sit: string | null;
  dt_reg: string | null;
  dt_const: string | null;
  is_active: boolean;
}

export interface FundDaily {
  dt_comptc: string;
  vl_quota: number | null;
  vl_patrim_liq: number | null;
  captc_dia: number | null;
  resg_dia: number | null;
  nr_cotst: number | null;
}

export interface FundDetail {
  meta: FundMeta | null;
  daily: FundDaily[];
  metrics: {
    return_period: number | null;
    period: string;
    data_points: number;
    latest_quota: number | null;
    latest_pl: number | null;
  };
}

export interface FundCatalogResponse {
  funds: FundMeta[];
  total: number;
  limit: number;
  offset: number;
}

export interface FundRankingItem {
  cnpj_fundo: string;
  denom_social: string;
  classe: string | null;
  classe_anbima: string | null;
  vl_patrim_liq: number | null;
  taxa_adm: number | null;
  taxa_perfm: number | null;
  gestor_nome: string | null;
  nr_cotistas: number | null;
}

export interface FundStatsResponse {
  total_funds: number;
  by_classe: Record<string, { count: number; pl_total: number }>;
  last_updated: string;
}

export interface FundOverviewResponse {
  total_pl: number;
  total_funds: number;
  total_cotistas: number;
  avg_pl: number;
  total_captacao: number;
  total_resgate: number;
  net_flow: number;
  dates_covered: number;
  latest_date: string;
}

export interface FundCompareItem {
  cnpj: string;
  name: string;
  daily: { date: string; quota_index: number }[];
  return_pct: number | null;
  pl_latest: number | null;
}

/* ─── Fetch helper ─── */
async function fetchCvm(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(CVM_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CVM API error: ${res.status}`);
  return res.json();
}

/* ─── Hooks ─── */

/** Paginated fund catalog */
export function useFundCatalog(opts: {
  limit?: number;
  offset?: number;
  classe?: string;
  tp_fundo?: string;
  search?: string;
  orderBy?: string;
} = {}) {
  const { limit = 50, offset = 0, classe, tp_fundo, search, orderBy = "vl_patrim_liq" } = opts;
  return useQuery<FundCatalogResponse>({
    queryKey: ["fundos", "catalog", limit, offset, classe, tp_fundo, search, orderBy],
    queryFn: async () => {
      const params: Record<string, string> = {
        limit: String(limit),
        offset: String(offset),
        order_by: orderBy,
      };
      if (classe) params.classe = classe;
      if (tp_fundo) params.tp_fundo = tp_fundo;
      if (search) params.search = search;
      return fetchCvm("catalog", params) as Promise<FundCatalogResponse>;
    },
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/** Single fund detail (meta + daily + metrics) */
export function useFundDetail(cnpj: string | null, period: string = "3m") {
  return useQuery<FundDetail>({
    queryKey: ["fundos", "detail", cnpj, period],
    queryFn: () => fetchCvm("fund", { cnpj: cnpj!, period }) as Promise<FundDetail>,
    enabled: !!cnpj,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/** Rankings by classe */
export function useFundRankings(classe?: string, limit: number = 20) {
  return useQuery<{ classe: string; funds: FundRankingItem[]; count: number }>({
    queryKey: ["fundos", "rankings", classe, limit],
    queryFn: () => {
      const params: Record<string, string> = { limit: String(limit) };
      if (classe) params.classe = classe;
      return fetchCvm("rankings", params) as Promise<{ classe: string; funds: FundRankingItem[]; count: number }>;
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** Aggregate stats (by_classe, total_funds) */
export function useFundStats() {
  return useQuery<FundStatsResponse>({
    queryKey: ["fundos", "stats"],
    queryFn: () => fetchCvm("stats") as Promise<FundStatsResponse>,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** Overview — aggregate daily metrics */
export function useFundOverview() {
  return useQuery<FundOverviewResponse>({
    queryKey: ["fundos", "overview"],
    queryFn: () => fetchCvm("overview") as Promise<FundOverviewResponse>,
    staleTime: 15 * 60 * 1000,
    retry: 2,
  });
}

/** Compare multiple funds (up to 4) */
export function useFundCompare(cnpjs: string[], period: string = "3m") {
  return useQuery<FundCompareItem[]>({
    queryKey: ["fundos", "compare", cnpjs.sort().join(","), period],
    queryFn: () => fetchCvm("compare", { cnpjs: cnpjs.join(","), period }) as Promise<FundCompareItem[]>,
    enabled: cnpjs.length >= 2,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });
}

/* ─── Monthly Data Types ─── */
export interface FundMonthly {
  cnpj_fundo: string;
  dt_comptc: string;
  rentab_fundo: number | null;
  captc_dia: number | null;
  resg_dia: number | null;
  captc_liquida_mes: number | null;
  nr_cotst: number | null;
  vl_patrim_liq: number | null;
  benchmark: string | null;
  rentab_benchmark: number | null;
}

export interface MonthlyRankingItem {
  cnpj_fundo: string;
  denom_social: string;
  classe: string | null;
  classe_anbima: string | null;
  gestor_nome: string | null;
  dt_comptc: string;
  rentab_fundo: number | null;
  vl_patrim_liq: number | null;
  captc_liquida_mes: number | null;
  nr_cotst: number | null;
  benchmark: string | null;
  rentab_benchmark: number | null;
}

export interface MonthlyOverviewItem {
  month: string;
  funds: number;
  avg_rentab: number | null;
  median_rentab: number | null;
  total_pl: number;
  total_captacao_liquida: number;
}

/** Monthly data for a single fund */
export function useFundMonthly(cnpj: string | null, months: number = 24) {
  return useQuery<{ cnpj: string; months: FundMonthly[]; count: number }>({
    queryKey: ["fundos", "monthly", cnpj, months],
    queryFn: () => fetchCvm("monthly", { cnpj: cnpj!, months: String(months) }) as Promise<{ cnpj: string; months: FundMonthly[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** Monthly rankings (top performers for a given month) */
export function useMonthlyRankings(period: string, opts: { classe?: string; limit?: number; orderBy?: string; order?: string } = {}) {
  const { classe, limit = 20, orderBy = "rentab_fundo", order = "desc" } = opts;
  return useQuery<{ period: string; classe: string; funds: MonthlyRankingItem[]; count: number }>({
    queryKey: ["fundos", "monthly_rankings", period, classe, limit, orderBy, order],
    queryFn: () => {
      const params: Record<string, string> = { period, limit: String(limit), order_by: orderBy, order };
      if (classe) params.classe = classe;
      return fetchCvm("monthly_rankings", params) as Promise<{ period: string; classe: string; funds: MonthlyRankingItem[]; count: number }>;
    },
    enabled: !!period,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** Monthly overview (aggregated across all funds) */
export function useMonthlyOverview(months: number = 12) {
  return useQuery<{ months: MonthlyOverviewItem[]; count: number }>({
    queryKey: ["fundos", "monthly_overview", months],
    queryFn: () => fetchCvm("monthly_overview", { months: String(months) }) as Promise<{ months: MonthlyOverviewItem[]; count: number }>,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/* ─── CDA (Composição de Carteira) Types ─── */
export interface FundCdaItem {
  cnpj_fundo: string;
  dt_comptc: string;
  tp_ativo: string;
  cd_ativo: string;
  ds_ativo: string | null;
  vl_merc_pos_final: number | null;
  vl_custo_pos_final: number | null;
  qt_pos_final: number | null;
  pct_pl: number | null;
  emissor: string | null;
  dt_venc: string | null;
  bloco: string;
}

export interface FundCdaSummary {
  bloco: string;
  count: number;
  vl_total: number;
  pct_pl: number;
}

/** CDA — asset-level composition for a single fund */
export function useFundComposition(cnpj: string | null) {
  return useQuery<{ cnpj: string; assets: FundCdaItem[]; count: number }>({
    queryKey: ["fundos", "composition", cnpj],
    queryFn: () => fetchCvm("composition", { cnpj: cnpj! }) as Promise<{ cnpj: string; assets: FundCdaItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** CDA Summary — grouped by bloco */
export function useFundCompositionSummary(cnpj: string | null) {
  return useQuery<{ cnpj: string; summary: FundCdaSummary[]; total_pl: number }>({
    queryKey: ["fundos", "composition_summary", cnpj],
    queryFn: () => fetchCvm("composition_summary", { cnpj: cnpj! }) as Promise<{ cnpj: string; summary: FundCdaSummary[]; total_pl: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/* ─── FIDC (Fundo de Direitos Creditórios) Types ─── */
export interface FidcMonthlyItem {
  cnpj_fundo: string;
  dt_comptc: string;
  vl_cota_senior: number | null;
  vl_cota_subordinada: number | null;
  qt_cota_senior: number | null;
  qt_cota_subordinada: number | null;
  vl_pl_senior: number | null;
  vl_pl_subordinada: number | null;
  vl_pl_total: number | null;
  indice_subordinacao: number | null;
  vl_carteira_direitos: number | null;
  vl_carteira_a_vencer: number | null;
  vl_carteira_inadimplente: number | null;
  vl_pdd: number | null;
  indice_pdd_cobertura: number | null;
  taxa_inadimplencia: number | null;
  rentab_senior: number | null;
  rentab_subordinada: number | null;
  rentab_fundo: number | null;
  nr_cedentes: number | null;
  concentracao_cedente: number | null;
}

export interface FidcRankingItem {
  cnpj_fundo: string;
  denom_social: string;
  dt_comptc: string;
  vl_pl_total: number | null;
  indice_subordinacao: number | null;
  taxa_inadimplencia: number | null;
  indice_pdd_cobertura: number | null;
  rentab_fundo: number | null;
  vl_carteira_direitos: number | null;
}

export interface FidcOverviewItem {
  total_fidcs: number;
  total_pl: number;
  avg_inadimplencia: number | null;
  avg_subordinacao: number | null;
  avg_rentab: number | null;
  avg_pdd_cobertura: number | null;
}

/** FIDC monthly time series for a single fund */
export function useFidcMonthly(cnpj: string | null, months: number = 24) {
  return useQuery<{ cnpj: string; months: FidcMonthlyItem[]; count: number }>({
    queryKey: ["fundos", "fidc_monthly", cnpj, months],
    queryFn: () => fetchCvm("fidc_monthly", { cnpj: cnpj!, months: String(months) }) as Promise<{ cnpj: string; months: FidcMonthlyItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FIDC rankings (sorted by metric) */
export function useFidcRankings(opts: { orderBy?: string; order?: string; limit?: number; minPl?: number } = {}) {
  const { orderBy = "vl_pl_total", order = "desc", limit = 50, minPl = 0 } = opts;
  return useQuery<{ funds: FidcRankingItem[]; count: number }>({
    queryKey: ["fundos", "fidc_rankings", orderBy, order, limit, minPl],
    queryFn: () => {
      const params: Record<string, string> = {
        order_by: orderBy, order, limit: String(limit),
      };
      if (minPl > 0) params.min_pl = String(minPl);
      return fetchCvm("fidc_rankings", params) as Promise<{ funds: FidcRankingItem[]; count: number }>;
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FIDC market overview (aggregates) */
export function useFidcOverview() {
  return useQuery<FidcOverviewItem>({
    queryKey: ["fundos", "fidc_overview"],
    queryFn: () => fetchCvm("fidc_overview") as Promise<FidcOverviewItem>,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/* ─── FII (Fundos Imobiliários) Types ─── */
export interface FiiMonthlyItem {
  cnpj_fundo: string;
  dt_comptc: string;
  nome_fundo: string | null;
  segmento: string | null;
  mandato: string | null;
  tipo_gestao: string | null;
  publico_alvo: string | null;
  patrimonio_liquido: number | null;
  cotas_emitidas: number | null;
  valor_patrimonial_cota: number | null;
  rentabilidade_efetiva_mes: number | null;
  rentabilidade_patrimonial_mes: number | null;
  dividend_yield_mes: number | null;
  nr_cotistas: number | null;
  pct_despesas_adm: number | null;
}

export interface FiiOverviewResponse {
  date: string;
  total_fiis: number;
  total_pl: number;
  total_cotistas: number;
  avg_dividend_yield: number | null;
  avg_rentabilidade: number | null;
  by_segmento: { segmento: string; count: number; pl: number; avg_dy: number | null; pct_pl: number }[];
}

/** FII monthly time series for a single fund */
export function useFiiMonthly(cnpj: string | null, months: number = 24) {
  return useQuery<{ cnpj: string; data: FiiMonthlyItem[]; count: number }>({
    queryKey: ["fundos", "fii_monthly", cnpj, months],
    queryFn: () => fetchCvm("fii_monthly", { cnpj: cnpj!, months: String(months) }) as Promise<{ cnpj: string; data: FiiMonthlyItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FII rankings (sorted by metric) */
export function useFiiRankings(opts: { orderBy?: string; order?: string; limit?: number; segmento?: string } = {}) {
  const { orderBy = "patrimonio_liquido", order = "desc", limit = 50, segmento } = opts;
  return useQuery<{ date: string; funds: FiiMonthlyItem[]; count: number }>({
    queryKey: ["fundos", "fii_rankings", orderBy, order, limit, segmento],
    queryFn: () => {
      const params: Record<string, string> = { order_by: orderBy, order, limit: String(limit) };
      if (segmento) params.segmento = segmento;
      return fetchCvm("fii_rankings", params) as Promise<{ date: string; funds: FiiMonthlyItem[]; count: number }>;
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FII market overview (aggregates) */
export function useFiiOverview() {
  return useQuery<FiiOverviewResponse>({
    queryKey: ["fundos", "fii_overview"],
    queryFn: () => fetchCvm("fii_overview") as Promise<FiiOverviewResponse>,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/* ─── FIP (Fundos de Investimento em Participações) Types ─── */
export interface FipQuarterlyItem {
  cnpj_fundo: string;
  dt_comptc: string;
  nome_fundo: string | null;
  tp_fundo_classe: string | null;
  publico_alvo: string | null;
  patrimonio_liquido: number | null;
  qt_cota: number | null;
  valor_patrimonial_cota: number | null;
  nr_cotistas: number | null;
  vl_cap_comprom: number | null;
  vl_cap_subscr: number | null;
  vl_cap_integr: number | null;
  vl_invest_fip_cota: number | null;
}

export interface FipOverviewResponse {
  date: string;
  total_fips: number;
  total_pl: number;
  total_cotistas: number;
  total_capital_comprometido: number;
  total_capital_subscrito: number;
  total_capital_integralizado: number;
  pct_integralizacao: number | null;
  by_tipo: { tp_fundo_classe: string; count: number; pl: number; pct_pl: number }[];
}

/** FIP quarterly time series for a single fund */
export function useFipQuarterly(cnpj: string | null) {
  return useQuery<{ cnpj: string; data: FipQuarterlyItem[]; count: number }>({
    queryKey: ["fundos", "fip_quarterly", cnpj],
    queryFn: () => fetchCvm("fip_quarterly", { cnpj: cnpj! }) as Promise<{ cnpj: string; data: FipQuarterlyItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FIP rankings (sorted by metric) */
export function useFipRankings(opts: { orderBy?: string; order?: string; limit?: number; tp_fundo_classe?: string } = {}) {
  const { orderBy = "patrimonio_liquido", order = "desc", limit = 50, tp_fundo_classe } = opts;
  return useQuery<{ date: string; funds: FipQuarterlyItem[]; count: number }>({
    queryKey: ["fundos", "fip_rankings", orderBy, order, limit, tp_fundo_classe],
    queryFn: () => {
      const params: Record<string, string> = { order_by: orderBy, order, limit: String(limit) };
      if (tp_fundo_classe) params.tp_fundo_classe = tp_fundo_classe;
      return fetchCvm("fip_rankings", params) as Promise<{ date: string; funds: FipQuarterlyItem[]; count: number }>;
    },
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/** FIP market overview (aggregates) */
export function useFipOverview() {
  return useQuery<FipOverviewResponse>({
    queryKey: ["fundos", "fip_overview"],
    queryFn: () => fetchCvm("fip_overview") as Promise<FipOverviewResponse>,
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/* ─── Formatting Helpers ─── */
export function formatPL(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1e12) return `R$ ${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `R$ ${(value / 1e3).toFixed(0)}K`;
  return `R$ ${value.toFixed(0)}`;
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function shortCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})\.(\d{3})\.(\d{3}).*/, "$1.$2.$3");
}
