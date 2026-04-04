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
