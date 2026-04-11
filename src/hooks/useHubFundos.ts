import { useQuery } from "@tanstack/react-query";

const CVM_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-cvm-api";

/* ─── Types ─── */
export interface FundMeta {
  cnpj_fundo: string;
  cnpj_fundo_classe: string | null;
  slug: string | null;
  denom_social: string;
  cd_cvm: number | null;
  tp_fundo: string | null;
  classe: string | null;
  classe_rcvm175: string | null;
  subclasse_rcvm175: string | null;
  classe_anbima: string | null;
  condom: string | null;
  fundo_cotas: string | null;
  fundo_exclusivo: string | null;
  invest_qualif: string | null;
  publico_alvo: string | null;
  tributacao: string | null;
  prazo_resgate: string | null;
  aplicacao_min: number | null;
  taxa_adm: number | null;
  taxa_perfm: number | null;
  benchmark: string | null;
  rentab_fundo: string | null;
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
  cnpj_fundo_classe: string | null;
  slug: string | null;
  denom_social: string;
  classe: string | null;
  classe_rcvm175: string | null;
  classe_anbima: string | null;
  publico_alvo: string | null;
  tributacao: string | null;
  vl_patrim_liq: number | null;
  taxa_adm: number | null;
  taxa_perfm: number | null;
  gestor_nome: string | null;
  nr_cotistas: number | null;
}

export interface FundStatsResponse {
  total_funds: number;
  by_classe: Record<string, { count: number; pl_total: number }>;
  by_classe_rcvm175?: Record<string, { count: number; pl_total: number }>;
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

/** Single fund detail (meta + daily + metrics). Accepts CNPJ or slug. */
export function useFundDetail(identifier: string | null, period: string = "3m") {
  // Detect if identifier is a slug (no dots/dashes in CNPJ pattern) vs CNPJ
  const isSlug = identifier ? !/\d{2}\.\d{3}\.\d{3}/.test(identifier) && !/^\d{14}$/.test(identifier) : false;
  return useQuery<FundDetail>({
    queryKey: ["fundos", "detail", identifier, period],
    queryFn: () => {
      const params: Record<string, string> = { period };
      if (isSlug) params.slug = identifier!;
      else params.cnpj = identifier!;
      return fetchCvm("fund", params) as Promise<FundDetail>;
    },
    enabled: !!identifier,
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
  vl_carteira_prejuizo: number | null;
  vl_pl_mezanino?: number | null;
  vl_cota_mezanino?: number | null;
  qt_cota_mezanino?: number | null;
  nr_cotistas_senior?: number | null;
  nr_cotistas_subordinada?: number | null;
  tp_lastro_principal?: string | null;
  benchmark?: string | null;
  rentab_benchmark?: number | null;
  spread_cdi?: number | null;
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
  rentab_senior: number | null;
  rentab_subordinada?: number | null;
  vl_carteira_direitos: number | null;
  tp_lastro_principal?: string | null;
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

/** Format CNPJ with dots/slashes (XX.XXX.XXX/XXXX-XX). Handles both formatted and raw. */
export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return cnpj; // already formatted or invalid — return as-is
}

/** @deprecated Use formatCnpj instead. Kept for backward compatibility. */
export function shortCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})\.(\d{3})\.(\d{3}).*/, "$1.$2.$3");
}

/** Get the display name for a fund. Name-first: always prefer denom_social. */
export function fundDisplayName(meta: FundMeta | null | undefined): string {
  if (!meta) return "—";
  return meta.denom_social || formatCnpj(meta.cnpj_fundo_classe || meta.cnpj_fundo);
}

/** Get the primary CNPJ identifier (prefers cnpj_fundo_classe for RCVM 175). */
export function primaryCnpj(meta: FundMeta | null | undefined): string {
  if (!meta) return "";
  return meta.cnpj_fundo_classe || meta.cnpj_fundo;
}

/* ─── Gestora Rankings (H1.4 Fase A) ─── */
export interface GestoraRankingItem {
  gestor_nome: string;
  cnpj_gestor: string;
  fund_count: number;
  total_pl: number;
  avg_taxa_adm: number | null;
  total_cotistas: number;
}

export function useGestoraRankings(opts?: { limit?: number; orderBy?: string; enabled?: boolean }) {
  const limit = opts?.limit ?? 50;
  const orderBy = opts?.orderBy ?? "total_pl";
  return useQuery<{ gestoras: GestoraRankingItem[]; total: number }>({
    queryKey: ["cvm", "gestora_rankings", limit, orderBy],
    queryFn: () => fetchCvm("gestora_rankings", { limit: String(limit), order_by: orderBy }) as Promise<{ gestoras: GestoraRankingItem[]; total: number }>,
    staleTime: 30 * 60_000,
    enabled: opts?.enabled !== false,
  });
}

/* ─── Admin Rankings (H1.4 Fase A) ─── */
export interface AdminRankingItem {
  admin_nome: string;
  cnpj_admin: string;
  fund_count: number;
  total_pl: number;
  total_cotistas: number;
}

export function useAdminRankings(opts?: { limit?: number; orderBy?: string; enabled?: boolean }) {
  const limit = opts?.limit ?? 50;
  const orderBy = opts?.orderBy ?? "total_pl";
  return useQuery<{ admins: AdminRankingItem[]; total: number }>({
    queryKey: ["cvm", "admin_rankings", limit, orderBy],
    queryFn: () => fetchCvm("admin_rankings", { limit: String(limit), order_by: orderBy }) as Promise<{ admins: AdminRankingItem[]; total: number }>,
    staleTime: 30 * 60_000,
    enabled: opts?.enabled !== false,
  });
}

/* ─── Fund Search (H1.4 Fase A) ─── */
export interface FundSearchResult {
  cnpj_fundo: string;
  cnpj_fundo_classe: string | null;
  slug: string | null;
  denom_social: string;
  classe: string | null;
  classe_rcvm175: string | null;
  classe_anbima: string | null;
  tp_fundo: string | null;
  vl_patrim_liq: number | null;
  gestor_nome: string | null;
  admin_nome: string | null;
  is_active: boolean;
}

export function useFundSearch(query: string, opts?: { limit?: number; enabled?: boolean }) {
  const limit = opts?.limit ?? 20;
  const trimmed = query.trim();
  return useQuery<{ query: string; results: FundSearchResult[]; count: number }>({
    queryKey: ["cvm", "fund_search", trimmed, limit],
    queryFn: () => fetchCvm("fund_search", { q: trimmed, limit: String(limit) }) as Promise<{ query: string; results: FundSearchResult[]; count: number }>,
    staleTime: 5 * 60_000,
    enabled: (opts?.enabled !== false) && trimmed.length >= 2,
  });
}

/* ═══ Insights (Fase 4) ═══ */

export type InsightType = "pl_drop" | "drawdown" | "taxa_change" | "flow_anomaly" | "new_fund" | "cancelled_fund" | "cotistas_drop" | "gestor_change";
export type InsightSeverity = "info" | "warning" | "critical";

export interface FundInsight {
  id: number;
  cnpj_fundo: string;
  cnpj_fundo_classe: string | null;
  denom_social: string | null;
  slug: string | null;
  classe_rcvm175: string | null;
  tipo: InsightType;
  severidade: InsightSeverity;
  titulo: string;
  detalhe: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  referencia_data: string | null;
  detectado_em: string;
  is_read: boolean;
}

export interface InsightsFeedResponse {
  insights: FundInsight[];
  total: number;
  summary: {
    by_type: Record<string, number>;
    by_severity: Record<string, number>;
  };
  limit: number;
  offset: number;
}

export function useInsightsFeed(opts?: {
  tipo?: InsightType;
  severidade?: InsightSeverity;
  classe?: string;
  days?: number;
  limit?: number;
  enabled?: boolean;
}) {
  const params: Record<string, string> = {};
  if (opts?.tipo) params.tipo = opts.tipo;
  if (opts?.severidade) params.severidade = opts.severidade;
  if (opts?.classe) params.classe = opts.classe;
  if (opts?.days) params.days = String(opts.days);
  if (opts?.limit) params.limit = String(opts.limit);

  return useQuery<InsightsFeedResponse>({
    queryKey: ["cvm", "insights", params],
    queryFn: () => fetchCvm("insights", params) as Promise<InsightsFeedResponse>,
    staleTime: 10 * 60_000,
    enabled: opts?.enabled !== false,
  });
}

export function useInsightsForFund(identifier: string | null) {
  const isSlug = identifier ? !/\d{2}\.\d{3}\.\d{3}/.test(identifier) && !/^\d{14}$/.test(identifier) : false;
  const params: Record<string, string> = {};
  if (identifier) {
    if (isSlug) params.slug = identifier;
    else params.cnpj = identifier;
  }

  return useQuery<{ insights: FundInsight[]; cnpj: string }>({
    queryKey: ["cvm", "insights_for_fund", identifier],
    queryFn: () => fetchCvm("insights_for_fund", params) as Promise<{ insights: FundInsight[]; cnpj: string }>,
    staleTime: 10 * 60_000,
    enabled: !!identifier,
  });
}

/* ─── Insight display helpers ─── */

export const INSIGHT_TYPE_LABELS: Record<InsightType, string> = {
  pl_drop: "Queda de PL",
  drawdown: "Drawdown",
  taxa_change: "Mudança de Taxa",
  flow_anomaly: "Fluxo Atípico",
  new_fund: "Novo Fundo",
  cancelled_fund: "Fundo Cancelado",
  cotistas_drop: "Perda de Cotistas",
  gestor_change: "Mudança de Gestor",
};

export const INSIGHT_TYPE_ICONS: Record<InsightType, string> = {
  pl_drop: "📉",
  drawdown: "⚠️",
  taxa_change: "💰",
  flow_anomaly: "🌊",
  new_fund: "🆕",
  cancelled_fund: "🚫",
  cotistas_drop: "👥",
  gestor_change: "🔄",
};

export const INSIGHT_SEVERITY_COLORS: Record<InsightSeverity, { bg: string; text: string; border: string }> = {
  info: { bg: "#3B82F610", text: "#3B82F6", border: "#3B82F630" },
  warning: { bg: "#F59E0B10", text: "#F59E0B", border: "#F59E0B30" },
  critical: { bg: "#EF444410", text: "#EF4444", border: "#EF444430" },
};

/* ═══ FIDC V4 — Deep Module (hub-fidc-api) ═══ */

const FIDC_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-fidc-api";

async function fetchFidc(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(FIDC_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FIDC API error: ${res.status}`);
  return res.json();
}

// Enhanced FIDC types for V4
export interface FidcDetailResponse {
  meta: FundMeta | null;
  monthly: FidcMonthlyItem[];
  latest: FidcMonthlyItem | null;
  similar: (FidcMonthlyItem & { denom_social?: string; slug?: string; gestor_nome?: string })[];
}

export interface FidcV4RankingItem extends FidcMonthlyItem {
  denom_social?: string;
  slug?: string;
  gestor_nome?: string;
  admin_nome?: string;
  classe_rcvm175?: string;
  cnpj_fundo_classe?: string;
}

export interface FidcV4OverviewResponse {
  date: string;
  total_fidcs: number;
  total_pl: number;
  total_carteira: number;
  avg_subordinacao: number | null;
  avg_inadimplencia: number | null;
  avg_rentab_senior: number | null;
  by_lastro: { lastro: string; count: number; pl: number; pct_pl: number; avg_inadim: number | null }[];
  segments: string[];
}

export interface FidcSegment {
  lastro: string;
  count: number;
  pl: number;
}

export interface FidcSearchResult {
  cnpj_fundo_classe: string;
  denom_social: string;
  slug: string | null;
  gestor_nome: string | null;
  vl_patrim_liq: number | null;
}

/** FIDC V4 — Detailed fund page (meta + monthly + similar) */
export function useFidcDetail(identifier: string | null) {
  const isSlug = identifier ? !/\d{2}\.\d{3}\.\d{3}/.test(identifier) && !/^\d{14}$/.test(identifier) : false;
  return useQuery<FidcDetailResponse>({
    queryKey: ["fidc", "detail", identifier],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (isSlug) params.slug = identifier!;
      else params.cnpj = identifier!;
      return fetchFidc("fidc_detail", params) as Promise<FidcDetailResponse>;
    },
    enabled: !!identifier,
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

/** FIDC V4 — Enhanced rankings with filters */
export function useFidcV4Rankings(opts: {
  orderBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
  lastro?: string;
  minPl?: number;
  maxInadim?: number;
  minSubord?: number;
  gestor?: string;
  search?: string;
  enabled?: boolean;
} = {}) {
  const { orderBy = "vl_pl_total", order = "desc", limit = 50, offset = 0, lastro, minPl, maxInadim, minSubord, gestor, search } = opts;
  return useQuery<{ date: string; order_by: string; funds: FidcV4RankingItem[]; count: number }>({
    queryKey: ["fidc", "v4_rankings", orderBy, order, limit, offset, lastro, minPl, maxInadim, minSubord, gestor, search],
    queryFn: () => {
      const params: Record<string, string> = { order_by: orderBy, order, limit: String(limit), offset: String(offset) };
      if (lastro) params.lastro = lastro;
      if (minPl && minPl > 0) params.min_pl = String(minPl);
      if (maxInadim != null) params.max_inadim = String(maxInadim);
      if (minSubord != null) params.min_subord = String(minSubord);
      if (gestor) params.gestor = gestor;
      if (search) params.search = search;
      return fetchFidc("fidc_rankings", params) as Promise<{ date: string; order_by: string; funds: FidcV4RankingItem[]; count: number }>;
    },
    staleTime: 15 * 60_000,
    enabled: opts.enabled !== false,
    retry: 2,
  });
}

/** FIDC V4 — Enhanced overview with segments */
export function useFidcV4Overview() {
  return useQuery<FidcV4OverviewResponse>({
    queryKey: ["fidc", "v4_overview"],
    queryFn: () => fetchFidc("fidc_overview") as Promise<FidcV4OverviewResponse>,
    staleTime: 30 * 60_000,
    retry: 2,
  });
}

/** FIDC V4 — Search FIDCs by name */
export function useFidcSearch(query: string, opts?: { limit?: number; enabled?: boolean }) {
  const limit = opts?.limit ?? 20;
  const trimmed = query.trim();
  return useQuery<{ query: string; results: FidcSearchResult[]; count: number }>({
    queryKey: ["fidc", "search", trimmed, limit],
    queryFn: () => fetchFidc("fidc_search", { q: trimmed, limit: String(limit) }) as Promise<{ query: string; results: FidcSearchResult[]; count: number }>,
    staleTime: 5 * 60_000,
    enabled: (opts?.enabled !== false) && trimmed.length >= 2,
  });
}

/** FIDC V4 — List all lastro segments */
export function useFidcSegments() {
  return useQuery<{ date: string; segments: FidcSegment[] }>({
    queryKey: ["fidc", "segments"],
    queryFn: () => fetchFidc("fidc_segments") as Promise<{ date: string; segments: FidcSegment[] }>,
    staleTime: 60 * 60_000,
    retry: 2,
  });
}

/** FIDC V4 — Monthly data via new API */
export function useFidcV4Monthly(cnpj: string | null, months: number = 24) {
  return useQuery<{ cnpj: string; data: FidcMonthlyItem[]; count: number }>({
    queryKey: ["fidc", "v4_monthly", cnpj, months],
    queryFn: () => fetchFidc("fidc_monthly", { cnpj: cnpj!, months: String(months) }) as Promise<{ cnpj: string; data: FidcMonthlyItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 15 * 60_000,
    retry: 2,
  });
}

/* ═══ FII V4 — Deep Module (hub-fii-api) ═══ */

const FII_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-fii-api";

async function fetchFii(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(FII_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const headers: Record<string, string> = {};
  if (anonKey) {
    headers["Authorization"] = `Bearer ${anonKey}`;
    headers["apikey"] = anonKey;
  }
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`FII API error: ${res.status}`);
  return res.json();
}

// Enhanced FII types for V4
export interface FiiV4MonthlyItem extends FiiMonthlyItem {
  denom_social?: string | null;
  slug?: string | null;
  cnpj_fundo_classe?: string | null;
  classe_rcvm175?: string | null;
  gestor_nome?: string | null;
}

export interface FiiDetailResponse {
  meta: FundMeta | null;
  monthly: FiiMonthlyItem[];
  latest: FiiMonthlyItem | null;
  similar: FiiV4MonthlyItem[];
}

export interface FiiV4RankingItem extends FiiV4MonthlyItem {}

export interface FiiV4OverviewResponse {
  date: string;
  total_fiis: number;
  total_pl: number;
  total_cotistas: number;
  avg_dividend_yield: number | null;
  avg_rentabilidade: number | null;
  by_segmento: { segmento: string; count: number; pl: number; pct_pl: number; avg_dy: number | null }[];
  by_mandato: { mandato: string; count: number }[];
  by_tipo_gestao: { tipo: string; count: number }[];
}

export interface FiiSegment {
  segmento: string;
  count: number;
  pl: number;
}

export interface FiiSearchResult {
  cnpj_fundo_classe: string;
  cnpj_fundo_legado: string | null;
  denom_social: string;
  slug: string | null;
  gestor_nome: string | null;
  vl_patrim_liq: number | null;
}

/** FII V4 — Detailed fund page (meta + monthly + similar by segmento) */
export function useFiiDetail(identifier: string | null) {
  const isSlug = identifier ? !/\d{2}\.\d{3}\.\d{3}/.test(identifier) && !/^\d{14}$/.test(identifier) : false;
  return useQuery<FiiDetailResponse>({
    queryKey: ["fii", "detail", identifier],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (isSlug) params.slug = identifier!;
      else params.cnpj = identifier!;
      return fetchFii("fii_detail", params) as Promise<FiiDetailResponse>;
    },
    enabled: !!identifier,
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

/** FII V4 — Enhanced rankings with filters */
export function useFiiV4Rankings(opts: {
  orderBy?: string;
  order?: string;
  limit?: number;
  offset?: number;
  segmento?: string;
  tipoGestao?: string;
  mandato?: string;
  minPl?: number;
  minDy?: number;
  search?: string;
  enabled?: boolean;
} = {}) {
  const { orderBy = "patrimonio_liquido", order = "desc", limit = 50, offset = 0, segmento, tipoGestao, mandato, minPl, minDy, search } = opts;
  return useQuery<{ date: string; order_by: string; funds: FiiV4RankingItem[]; count: number }>({
    queryKey: ["fii", "v4_rankings", orderBy, order, limit, offset, segmento, tipoGestao, mandato, minPl, minDy, search],
    queryFn: () => {
      const params: Record<string, string> = { order_by: orderBy, order, limit: String(limit), offset: String(offset) };
      if (segmento) params.segmento = segmento;
      if (tipoGestao) params.tipo_gestao = tipoGestao;
      if (mandato) params.mandato = mandato;
      if (minPl && minPl > 0) params.min_pl = String(minPl);
      if (minDy != null) params.min_dy = String(minDy);
      if (search) params.search = search;
      return fetchFii("fii_rankings", params) as Promise<{ date: string; order_by: string; funds: FiiV4RankingItem[]; count: number }>;
    },
    staleTime: 15 * 60_000,
    enabled: opts.enabled !== false,
    retry: 2,
  });
}

/** FII V4 — Market overview with segmento/mandato/tipo breakdowns */
export function useFiiV4Overview() {
  return useQuery<FiiV4OverviewResponse>({
    queryKey: ["fii", "v4_overview"],
    queryFn: () => fetchFii("fii_overview") as Promise<FiiV4OverviewResponse>,
    staleTime: 30 * 60_000,
    retry: 2,
  });
}

/** FII V4 — Search FIIs by name */
export function useFiiSearchV4(query: string, opts?: { limit?: number; enabled?: boolean }) {
  const limit = opts?.limit ?? 20;
  const trimmed = query.trim();
  return useQuery<{ query: string; results: FiiSearchResult[]; count: number }>({
    queryKey: ["fii", "search", trimmed, limit],
    queryFn: () => fetchFii("fii_search", { q: trimmed, limit: String(limit) }) as Promise<{ query: string; results: FiiSearchResult[]; count: number }>,
    staleTime: 5 * 60_000,
    enabled: (opts?.enabled !== false) && trimmed.length >= 2,
  });
}

/** FII V4 — List all segments with PL distribution */
export function useFiiSegmentsV4() {
  return useQuery<{ date: string; segments: FiiSegment[] }>({
    queryKey: ["fii", "segments"],
    queryFn: () => fetchFii("fii_segments") as Promise<{ date: string; segments: FiiSegment[] }>,
    staleTime: 60 * 60_000,
    retry: 2,
  });
}

/** FII V4 — Monthly data via new API */
export function useFiiV4Monthly(cnpj: string | null, months: number = 24) {
  return useQuery<{ cnpj: string; data: FiiMonthlyItem[]; count: number }>({
    queryKey: ["fii", "v4_monthly", cnpj, months],
    queryFn: () => fetchFii("fii_monthly", { cnpj: cnpj!, months: String(months) }) as Promise<{ cnpj: string; data: FiiMonthlyItem[]; count: number }>,
    enabled: !!cnpj,
    staleTime: 15 * 60_000,
    retry: 2,
  });
}

/* ═══ Ofertas Públicas — V4 Fase 3 (hub-ofertas-api) ═══ */

const OFERTAS_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-ofertas-api";

async function fetchOfertas(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(OFERTAS_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Ofertas API error: ${res.status}`);
  return res.json();
}

export interface OfertaPublica {
  id: number;
  protocolo: string;
  numero_oferta: string | null;
  emissor_cnpj: string;
  emissor_nome: string;
  tipo_oferta: string;
  tipo_ativo: string;
  status: "em_analise" | "concedido" | "em_distribuicao" | "encerrado" | "cancelado" | "arquivado" | "suspenso";
  modalidade: string | null;
  valor_total: number | null;
  volume_final: number | null;
  data_protocolo: string | null;
  data_registro: string | null;
  data_inicio: string | null;
  data_encerramento: string | null;
  coordenador_lider: string | null;
  rating: string | null;
  serie: string | null;
  segmento: string | null;
  observacoes: string | null;
  source_url: string | null;
}

export interface OfertasListFilters {
  tipo_ativo?: string;
  tipo_oferta?: string;
  status?: string;
  modalidade?: string;
  segmento?: string;
  search?: string;
  min_valor?: number;
  from_date?: string;
  to_date?: string;
  order_by?: string;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface OfertasListResponse {
  ofertas: OfertaPublica[];
  count: number;
  limit: number;
  offset: number;
}

export interface OfertasTimelineBucket {
  month: string;
  count: number;
  valor_total: number;
  volume_final: number;
  ofertas: OfertaPublica[];
}

export interface OfertasTimelineResponse {
  months: number;
  total: number;
  timeline: OfertasTimelineBucket[];
}

export interface OfertasStatsResponse {
  total_ofertas: number;
  total_valor: number;
  total_volume: number;
  em_distribuicao: number;
  em_analise: number;
  encerradas: number;
  by_tipo_ativo: Array<{ tipo: string; count: number; valor: number }>;
  by_status: Array<{ status: string; count: number }>;
  by_tipo_oferta: Array<{ tipo: string; count: number }>;
  by_modalidade: Array<{ modalidade: string; count: number }>;
  by_segmento: Array<{ segmento: string; count: number; valor: number }>;
}

export interface OfertasFiltersResponse {
  tipos_ativo: string[];
  tipos_oferta: string[];
  statuses: string[];
  modalidades: string[];
  segmentos: string[];
}

export interface OfertaDetailResponse {
  oferta: OfertaPublica;
  related: Array<Pick<OfertaPublica, "id" | "protocolo" | "emissor_nome" | "tipo_ativo" | "status" | "valor_total" | "data_protocolo">>;
}

/** List ofertas with filters (pagination supported) */
export function useOfertasList(filters: OfertasListFilters = {}) {
  return useQuery<OfertasListResponse>({
    queryKey: ["ofertas", "list", filters],
    queryFn: () => {
      const params: Record<string, string> = {};
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") params[k] = String(v);
      });
      return fetchOfertas("ofertas_list", params) as Promise<OfertasListResponse>;
    },
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

/** Detail view for a single oferta */
export function useOfertaDetail(protocolo: string | null) {
  return useQuery<OfertaDetailResponse>({
    queryKey: ["ofertas", "detail", protocolo],
    queryFn: () => fetchOfertas("ofertas_detail", { protocolo: protocolo! }) as Promise<OfertaDetailResponse>,
    enabled: !!protocolo,
    staleTime: 30 * 60_000,
    retry: 2,
  });
}

/** Timeline grouped by month */
export function useOfertasTimeline(months = 12, tipoAtivo?: string, status?: string) {
  return useQuery<OfertasTimelineResponse>({
    queryKey: ["ofertas", "timeline", months, tipoAtivo, status],
    queryFn: () => {
      const params: Record<string, string> = { months: String(months) };
      if (tipoAtivo) params.tipo_ativo = tipoAtivo;
      if (status) params.status = status;
      return fetchOfertas("ofertas_timeline", params) as Promise<OfertasTimelineResponse>;
    },
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

/** Aggregate stats */
export function useOfertasStats(fromDate?: string, toDate?: string) {
  return useQuery<OfertasStatsResponse>({
    queryKey: ["ofertas", "stats", fromDate, toDate],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      return fetchOfertas("ofertas_stats", params) as Promise<OfertasStatsResponse>;
    },
    staleTime: 10 * 60_000,
    retry: 2,
  });
}

/** Filter options (distinct values) */
export function useOfertasFilters() {
  return useQuery<OfertasFiltersResponse>({
    queryKey: ["ofertas", "filters"],
    queryFn: () => fetchOfertas("ofertas_filters") as Promise<OfertasFiltersResponse>,
    staleTime: 60 * 60_000,
    retry: 2,
  });
}
