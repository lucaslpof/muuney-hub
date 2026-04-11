// usePortfolios — V4 Fase 4 Portfolio Tracker hooks
// CRUD operations for hub_user_portfolios + hub_user_portfolio_holdings
// Requires authenticated user; all queries filtered by RLS (user_id = auth.uid()).

import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/* ─────────────── Types ─────────────── */

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioHolding {
  id: string;
  portfolio_id: string;
  user_id: string;
  cnpj_fundo_classe: string;
  fund_slug: string | null;
  fund_name: string;
  classe_rcvm175: string | null;
  quantity: number | null;
  avg_cost: number | null;
  initial_investment: number | null;
  target_allocation: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewPortfolioInput {
  name: string;
  description?: string | null;
  is_default?: boolean;
  color?: string | null;
}

export interface NewHoldingInput {
  portfolio_id: string;
  cnpj_fundo_classe: string;
  fund_slug?: string | null;
  fund_name: string;
  classe_rcvm175?: string | null;
  quantity?: number | null;
  avg_cost?: number | null;
  initial_investment?: number | null;
  target_allocation?: number | null;
  notes?: string | null;
}

/* ─────────────── Query keys ─────────────── */

export const portfolioKeys = {
  all: ["portfolios"] as const,
  list: (userId: string | undefined) => ["portfolios", userId] as const,
  detail: (id: string) => ["portfolios", "detail", id] as const,
  holdings: (portfolioId: string) => ["portfolios", portfolioId, "holdings"] as const,
  allHoldings: (userId: string | undefined) => ["portfolios", "holdings", userId] as const,
};

/* ─────────────── Queries ─────────────── */

/**
 * List all portfolios for the current user.
 * Returns empty array if no user or no portfolios.
 */
export function usePortfolios() {
  const { user } = useAuth();
  return useQuery({
    queryKey: portfolioKeys.list(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<Portfolio[]> => {
      const { data, error } = await supabase
        .from("hub_user_portfolios")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Portfolio[];
    },
  });
}

/**
 * Fetch a single portfolio by id.
 */
export function usePortfolio(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioId ? portfolioKeys.detail(portfolioId) : ["portfolios", "detail", "none"],
    enabled: Boolean(portfolioId),
    staleTime: 30_000,
    queryFn: async (): Promise<Portfolio | null> => {
      if (!portfolioId) return null;
      const { data, error } = await supabase
        .from("hub_user_portfolios")
        .select("*")
        .eq("id", portfolioId)
        .maybeSingle();
      if (error) throw error;
      return (data as Portfolio | null) ?? null;
    },
  });
}

/**
 * Fetch holdings for a given portfolio.
 */
export function usePortfolioHoldings(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioId ? portfolioKeys.holdings(portfolioId) : ["portfolios", "holdings", "none"],
    enabled: Boolean(portfolioId),
    staleTime: 30_000,
    queryFn: async (): Promise<PortfolioHolding[]> => {
      if (!portfolioId) return [];
      const { data, error } = await supabase
        .from("hub_user_portfolio_holdings")
        .select("*")
        .eq("portfolio_id", portfolioId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortfolioHolding[];
    },
  });
}

/**
 * Fetch ALL holdings across all portfolios for the current user (for dashboards/aggregations).
 */
export function useAllHoldings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: portfolioKeys.allHoldings(user?.id),
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<PortfolioHolding[]> => {
      const { data, error } = await supabase
        .from("hub_user_portfolio_holdings")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PortfolioHolding[];
    },
  });
}

/* ─────────────── Mutations ─────────────── */

/**
 * Create a new portfolio.
 */
export function useCreatePortfolio() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: NewPortfolioInput): Promise<Portfolio> => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const payload = {
        user_id: user.id,
        name: input.name,
        description: input.description ?? null,
        is_default: input.is_default ?? false,
        color: input.color ?? "#0B6C3E",
      };
      const { data, error } = await supabase
        .from("hub_user_portfolios")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

/**
 * Update an existing portfolio.
 */
export function useUpdatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<NewPortfolioInput>;
    }): Promise<Portfolio> => {
      const { data, error } = await supabase
        .from("hub_user_portfolios")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all });
      qc.invalidateQueries({ queryKey: portfolioKeys.detail(vars.id) });
    },
  });
}

/**
 * Delete a portfolio (cascades to holdings via FK ON DELETE CASCADE).
 */
export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("hub_user_portfolios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: portfolioKeys.all });
    },
  });
}

/**
 * Add a holding to a portfolio.
 */
export function useAddHolding() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: NewHoldingInput): Promise<PortfolioHolding> => {
      if (!user?.id) throw new Error("Usuário não autenticado");
      const payload = {
        ...input,
        user_id: user.id,
      };
      const { data, error } = await supabase
        .from("hub_user_portfolio_holdings")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as PortfolioHolding;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(data.portfolio_id) });
      qc.invalidateQueries({ queryKey: portfolioKeys.allHoldings(user?.id) });
    },
  });
}

/**
 * Update an existing holding.
 */
export function useUpdateHolding() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<NewHoldingInput>;
    }): Promise<PortfolioHolding> => {
      const { data, error } = await supabase
        .from("hub_user_portfolio_holdings")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as PortfolioHolding;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(data.portfolio_id) });
      qc.invalidateQueries({ queryKey: portfolioKeys.allHoldings(user?.id) });
    },
  });
}

/**
 * Delete a holding.
 */
export function useDeleteHolding() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      id,
      portfolioId: _portfolioId,
    }: {
      id: string;
      portfolioId: string;
    }): Promise<void> => {
      const { error } = await supabase
        .from("hub_user_portfolio_holdings")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: portfolioKeys.holdings(vars.portfolioId) });
      qc.invalidateQueries({ queryKey: portfolioKeys.allHoldings(user?.id) });
    },
  });
}

/* ─────────────── Aggregations ─────────────── */

export interface PortfolioSummary {
  totalInvested: number;
  totalHoldings: number;
  byClasse: Record<string, { count: number; invested: number; pct: number }>;
  withTarget: number;
  targetSum: number;
}

/**
 * Derive a summary from a holdings array (client-side, no network).
 */
export function usePortfolioSummary(holdings: PortfolioHolding[] | undefined): PortfolioSummary {
  return useMemo(() => {
    const rows = holdings ?? [];
    const totalInvested = rows.reduce(
      (s, h) => s + (Number(h.initial_investment) || 0),
      0
    );
    const byClasse: Record<string, { count: number; invested: number; pct: number }> = {};
    rows.forEach((h) => {
      const k = h.classe_rcvm175 || "Outros";
      if (!byClasse[k]) byClasse[k] = { count: 0, invested: 0, pct: 0 };
      byClasse[k].count++;
      byClasse[k].invested += Number(h.initial_investment) || 0;
    });
    Object.values(byClasse).forEach((v) => {
      v.pct = totalInvested > 0 ? (v.invested / totalInvested) * 100 : 0;
    });
    const withTarget = rows.filter((h) => h.target_allocation != null).length;
    const targetSum = rows.reduce(
      (s, h) => s + (Number(h.target_allocation) || 0),
      0
    );
    return {
      totalInvested,
      totalHoldings: rows.length,
      byClasse,
      withTarget,
      targetSum,
    };
  }, [holdings]);
}

/**
 * Utility to find or create the "default" portfolio for a user.
 * Returns null when no user is logged in. The caller should trigger a create
 * mutation when the returned portfolio is null but user exists and has loaded.
 */
export function useDefaultPortfolio() {
  const { data: portfolios, isLoading } = usePortfolios();
  const defaultPortfolio = useMemo(() => {
    if (!portfolios || portfolios.length === 0) return null;
    return portfolios.find((p) => p.is_default) ?? portfolios[0];
  }, [portfolios]);
  return { defaultPortfolio, isLoading, portfolios: portfolios ?? [] };
}

/* ─────────────── Helpers ─────────────── */

export const CLASSE_COLORS: Record<string, string> = {
  "Renda Fixa": "#3B82F6",
  "Ações": "#22C55E",
  "Multimercado": "#8B5CF6",
  "Cambial": "#F59E0B",
  "FII": "#EC4899",
  "FIDC": "#F97316",
  "FIP": "#06B6D4",
  "ETF": "#14B8A6",
  "Previdência": "#A855F7",
  "Outros": "#6B7280",
};

export function classeColor(classe: string | null | undefined): string {
  if (!classe) return CLASSE_COLORS.Outros;
  return CLASSE_COLORS[classe] ?? CLASSE_COLORS.Outros;
}

export function useFormatBRL() {
  return useCallback((value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
    return `R$ ${value.toFixed(2)}`;
  }, []);
}
