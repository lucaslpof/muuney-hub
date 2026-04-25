/**
 * useFundsV6 — Hooks da reforma /fundos screening-first (V6, 26/04/2026).
 *
 * Acessa:
 *   - hub-cvm-api?endpoint=screener (catalog + métricas pré-computadas)
 *   - hub_user_watchlist_fundos (Pro-only via RLS)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const CVM_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-cvm-api";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface ScreenerRow {
  cnpj_fundo_classe: string;
  cnpj_fundo: string | null;
  denom_social: string;
  slug: string | null;
  classe_rcvm175: string | null;
  subclasse_rcvm175: string | null;
  tp_fundo: string | null;
  tp_condom: string | null;
  publico_alvo: string | null;
  tributacao: string | null;
  prazo_resgate: string | null;
  vl_patrim_liq: number | null;
  taxa_adm: number | null;
  taxa_perfm: number | null;
  nr_cotistas: number | null;
  gestor_nome: string | null;
  admin_nome: string | null;
  retorno_3m_pct: number | null;
  retorno_6m_pct: number | null;
  retorno_12m_pct: number | null;
  vol_anual_pct: number | null;
  sharpe: number | null;
  max_dd_pct: number | null;
  metrics_last_dt: string | null;
  metrics_obs_count: number | null;
}

export type ScreenerSortKey =
  | "pl"
  | "cotistas"
  | "taxa_adm"
  | "ret_3m"
  | "ret_6m"
  | "sharpe"
  | "vol"
  | "max_dd";

export interface ScreenerFilters {
  /** Lista de classe_rcvm175 — backend faz IN. */
  classes?: string[];
  pl_min?: number;
  pl_max?: number;
  taxa_adm_max?: number;
  publico?: string;
  tributacao?: string;
  search?: string;
  sort_by?: ScreenerSortKey;
  sort_dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface ScreenerResponse {
  funds: ScreenerRow[];
  count: number;
  limit: number;
  offset: number;
  sort_by: string;
  sort_dir: string;
}

export interface FundWatchEntry {
  user_id: string;
  cnpj_fundo_classe: string;
  notes: string | null;
  added_at: string;
}

/* ─── Screener ─────────────────────────────────────────────────────────── */

async function fetchScreener(filters: ScreenerFilters): Promise<ScreenerResponse> {
  const url = new URL(CVM_API);
  url.searchParams.set("endpoint", "screener");
  if (filters.classes && filters.classes.length > 0) {
    url.searchParams.set("classes", filters.classes.join(","));
  }
  if (filters.pl_min) url.searchParams.set("pl_min", String(filters.pl_min));
  if (filters.pl_max) url.searchParams.set("pl_max", String(filters.pl_max));
  if (filters.taxa_adm_max) url.searchParams.set("taxa_adm_max", String(filters.taxa_adm_max));
  if (filters.publico) url.searchParams.set("publico", filters.publico);
  if (filters.tributacao) url.searchParams.set("tributacao", filters.tributacao);
  if (filters.search && filters.search.trim().length >= 2) {
    url.searchParams.set("search", filters.search.trim());
  }
  if (filters.sort_by) url.searchParams.set("sort_by", filters.sort_by);
  if (filters.sort_dir) url.searchParams.set("sort_dir", filters.sort_dir);
  if (filters.limit) url.searchParams.set("limit", String(filters.limit));
  if (filters.offset) url.searchParams.set("offset", String(filters.offset));

  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Screener API error ${res.status}: ${errText.slice(0, 200)}`);
  }
  return res.json();
}

export function useScreener(filters: ScreenerFilters) {
  // Cache key estável (sem mutate sort/array)
  const cacheKey = [
    "screener",
    [...(filters.classes ?? [])].sort().join(","),
    filters.pl_min ?? null,
    filters.pl_max ?? null,
    filters.taxa_adm_max ?? null,
    filters.publico ?? null,
    filters.tributacao ?? null,
    filters.search ?? "",
    filters.sort_by ?? "pl",
    filters.sort_dir ?? "desc",
    filters.limit ?? 100,
    filters.offset ?? 0,
  ];

  return useQuery<ScreenerResponse>({
    queryKey: cacheKey,
    queryFn: () => fetchScreener(filters),
    staleTime: 5 * 60 * 1000,
  });
}

/* ─── Watchlist (Pro-only via RLS) ─────────────────────────────────────── */

export function useFundWatchlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fund_watchlist", user?.id ?? null],
    queryFn: async (): Promise<FundWatchEntry[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("hub_user_watchlist_fundos")
        .select("*")
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data as FundWatchEntry[]) ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsFundWatched(cnpjFundoClasse: string | null | undefined) {
  const { data: list } = useFundWatchlist();
  if (!cnpjFundoClasse || !list) return false;
  return list.some((w) => w.cnpj_fundo_classe === cnpjFundoClasse);
}

export function useToggleFundWatch() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      cnpj_fundo_classe,
      currentlyWatched,
      notes,
    }: {
      cnpj_fundo_classe: string;
      currentlyWatched: boolean;
      notes?: string;
    }) => {
      if (!user) throw new Error("Não autenticado");
      if (currentlyWatched) {
        const { error } = await supabase
          .from("hub_user_watchlist_fundos")
          .delete()
          .eq("user_id", user.id)
          .eq("cnpj_fundo_classe", cnpj_fundo_classe);
        if (error) throw error;
        return { action: "removed" as const, cnpj_fundo_classe };
      } else {
        const { error } = await supabase
          .from("hub_user_watchlist_fundos")
          .insert({
            user_id: user.id,
            cnpj_fundo_classe,
            notes: notes ?? null,
          });
        if (error) throw error;
        return { action: "added" as const, cnpj_fundo_classe };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fund_watchlist"] });
    },
  });
}

/* ─── Asset class chips (5 mais relevantes p/ AAI BR) ──────────────────── */

export const ASSET_CLASS_CHIPS = [
  { id: "RF", label: "Renda Fixa", classes: ["Renda Fixa"], color: "#3B82F6" },
  { id: "Multi", label: "Multimercado", classes: ["Multimercado"], color: "#8B5CF6" },
  { id: "Acoes", label: "Ações", classes: ["Ações"], color: "#22C55E" },
  { id: "FII", label: "FII", classes: ["FII"], color: "#EC4899" },
  { id: "FIDC", label: "FIDC", classes: ["FIDC"], color: "#F97316" },
] as const;

/** Classes RCVM 175 oficiais consideradas "outras" (não nos chips). */
export const OTHER_CLASSES = [
  "Cambial",
  "FIP",
  "Previdência",
  "FMP-FGTS",
  "ETF",
  "Outros",
] as const;
