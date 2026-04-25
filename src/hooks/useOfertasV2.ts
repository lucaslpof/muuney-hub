/**
 * useOfertasV2 — V2 hooks (Sprint Beta 25-30/04/2026)
 *
 * Acessa as 3 tabelas novas via supabase client direto (RLS aplica
 * automaticamente owned-by-user policies):
 *   - hub_user_watchlist_ofertas  (watchlist do AAI)
 *   - hub_user_alert_rules        (regras de alerta)
 *   - hub_oferta_detalhes         (detalhes enriquecidos — vazio no beta)
 *
 * V3 (post-beta) terá Edge Function `extract-oferta-prospecto` populando
 * hub_oferta_detalhes via LLM. Por ora a maioria dos fields será null;
 * UI degrada graciosamente com empty states.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/* ─── Tipos ────────────────────────────────────────────────────────────── */

export interface OfertaDetalhes {
  protocolo: string;

  // Pricing
  cupom_indicativo: string | null;
  cupom_min: string | null;
  cupom_max: string | null;
  spread_indicativo: number | null;
  remuneracao_tipo: string | null;
  remuneracao_indice: string | null;

  // Estrutura
  prazo_meses: number | null;
  data_vencimento: string | null;
  amortizacao: string | null;
  carencia_meses: number | null;
  lastro_detalhe: string | null;
  garantias: string | null;
  subordinacao_pct: number | null;

  // Rating
  rating_agencia: string | null;
  rating_classe: string | null;
  rating_data: string | null;

  // Calendário operacional
  data_book_inicio: string | null;
  data_book_fim: string | null;
  data_reserva: string | null;
  data_liquidacao: string | null;

  // Pricing fechado
  cupom_fechado: string | null;
  spread_fechado: number | null;
  pricing_fechado_at: string | null;
  pricing_fechado_by: string | null;

  // Documentos
  prospecto_url: string | null;
  anuncio_inicio_url: string | null;

  // Extraction metadata
  extracted_at: string | null;
  extraction_model: string | null;
  extraction_status: "pending" | "extracted" | "failed" | "manual" | null;
  raw_extraction: Record<string, unknown> | null;
  source_pdf_hash: string | null;
  updated_at: string;
}

export interface WatchlistEntry {
  user_id: string;
  protocolo: string;
  notes: string | null;
  added_at: string;
}

export interface AlertRule {
  id: string;
  user_id: string;
  name: string;
  tipo_ativo: string[] | null;
  segmento: string[] | null;
  modalidade: string[] | null;
  min_volume: number | null;
  max_volume: number | null;
  rating_min: string | null;
  prazo_min_meses: number | null;
  prazo_max_meses: number | null;
  ativa: boolean;
  last_triggered: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── hub_oferta_detalhes ──────────────────────────────────────────────── */

export function useOfertaDetalhes(protocolo: string | null) {
  return useQuery({
    queryKey: ["oferta_detalhes", protocolo],
    queryFn: async (): Promise<OfertaDetalhes | null> => {
      if (!protocolo) return null;
      const { data, error } = await supabase
        .from("hub_oferta_detalhes")
        .select("*")
        .eq("protocolo", protocolo)
        .maybeSingle();
      if (error) throw error;
      return (data as OfertaDetalhes) ?? null;
    },
    enabled: !!protocolo,
    staleTime: 10 * 60 * 1000,
  });
}

/* ─── Watchlist ────────────────────────────────────────────────────────── */

export function useWatchlistOfertas() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["watchlist_ofertas", user?.id ?? null],
    queryFn: async (): Promise<WatchlistEntry[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("hub_user_watchlist_ofertas")
        .select("*")
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data as WatchlistEntry[]) ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsWatched(protocolo: string | null) {
  const { data: list } = useWatchlistOfertas();
  if (!protocolo || !list) return false;
  return list.some((w) => w.protocolo === protocolo);
}

export function useToggleWatch() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      protocolo,
      currentlyWatched,
      notes,
    }: {
      protocolo: string;
      currentlyWatched: boolean;
      notes?: string;
    }) => {
      if (!user) throw new Error("Não autenticado");

      if (currentlyWatched) {
        const { error } = await supabase
          .from("hub_user_watchlist_ofertas")
          .delete()
          .eq("user_id", user.id)
          .eq("protocolo", protocolo);
        if (error) throw error;
        return { action: "removed" as const, protocolo };
      } else {
        const { error } = await supabase
          .from("hub_user_watchlist_ofertas")
          .insert({ user_id: user.id, protocolo, notes: notes ?? null });
        if (error) throw error;
        return { action: "added" as const, protocolo };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist_ofertas"] });
    },
  });
}

/* ─── Alert rules ──────────────────────────────────────────────────────── */

export function useAlertRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["alert_rules", user?.id ?? null],
    queryFn: async (): Promise<AlertRule[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("hub_user_alert_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as AlertRule[]) ?? [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertAlertRule() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rule: Partial<AlertRule> & { name: string }) => {
      if (!user) throw new Error("Não autenticado");
      const payload = { ...rule, user_id: user.id };
      const { data, error } = await supabase
        .from("hub_user_alert_rules")
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as AlertRule;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
    },
  });
}

export function useDeleteAlertRule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("hub_user_alert_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
    },
  });
}

/* ─── Active oferta para CNPJ (cross-ref FIDC/FII) ─────────────────────── */

/** Format CNPJ as 00.000.000/0000-00 — used to match the masked format
 *  stored in hub_ofertas_publicas.emissor_cnpj. */
function maskCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

export function useActiveOfertaForCnpj(cnpj: string | null | undefined) {
  return useQuery({
    queryKey: ["active_oferta_for_cnpj", cnpj],
    queryFn: async (): Promise<{ protocolo: string; tipo_ativo: string; valor_total: number | null } | null> => {
      if (!cnpj) return null;
      const masked = maskCnpj(cnpj);
      const cleanCnpj = cnpj.replace(/\D/g, "");
      // Try both formats (DB stores masked '00.000.000/0001-91', some sources unmask)
      const { data, error } = await supabase
        .from("hub_ofertas_publicas")
        .select("protocolo, tipo_ativo, valor_total, data_inicio")
        .in("emissor_cnpj", [masked, cleanCnpj])
        .eq("status", "em_distribuicao")
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as { protocolo: string; tipo_ativo: string; valor_total: number | null }) ?? null;
    },
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
  });
}
