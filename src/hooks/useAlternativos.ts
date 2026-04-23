/**
 * useAlternativos — React Query hooks for the Alternativos module.
 *
 * Backend: supabase/functions/hub-alt-api (verify_jwt=true).
 * All calls require an authenticated session (JWT from supabase.auth.getSession()).
 *
 * Hooks:
 *   useAltOpportunities(filters)         — paginated catalog (PRO-only)
 *   useAltOpportunityDetail(slug)        — single opportunity + materials + my interests
 *   useAltOpportunityStats()             — aggregate KPIs
 *   useAltOpportunityFilters()           — distinct values for dropdowns
 *   useAltSuitability()                  — user's suitability ack state
 *   useAltMyInterests()                  — user's submitted interests
 *
 * Mutations:
 *   useAckSuitability()                  — POST aceite do termo
 *   useLogOpportunityView()              — POST view log (fire-and-forget)
 *   useRequestMaterialSignedUrl()        — POST gated download
 *   useSubmitInterest()                  — POST interest form
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { throwApiError } from "@/lib/apiError";

const ALT_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-alt-api";

const STALE_REALTIME = 10 * 60 * 1000;
const STALE_FREQUENT = 30 * 60 * 1000;

/* ─── Types ─── */

export type AltClasse =
  | "private_credit"
  | "private_equity"
  | "real_estate"
  | "ofertas_restritas"
  | "club_deals"
  | "offshore"
  | "alt_liquidos";

export type AltStatus = "em_breve" | "captando" | "encerrada" | "pausada";
export type AltPublicoAlvo = "qualificado" | "profissional" | "varejo";
export type AltPerfilRisco = "conservador" | "moderado" | "arrojado";
export type AltMoeda = "BRL" | "USD" | "EUR" | "OUTRO";
export type AltMaterialTipo = "teaser" | "deck" | "term_sheet" | "dd_document" | "regulamento" | "outro";
export type AltMaterialTier = "publico" | "pro" | "interesse_registrado";
export type AltFaixaPatrimonio = "ate_1m" | "1m_5m" | "5m_10m" | "10m_plus";
export type AltInterestStatus =
  | "novo"
  | "enviado_gestora"
  | "em_contato"
  | "em_analise"
  | "fechado"
  | "recusado"
  | "desistiu";
export type AltDeclaredProfile = "qualificado" | "profissional" | "varejo_ciente";

export interface AltPartnerLite {
  id: string;
  slug: string;
  nome: string;
  tipo_gestora?: string | null;
}

export interface AltPartnerFull extends AltPartnerLite {
  cnpj?: string | null;
  descricao?: string | null;
  website?: string | null;
}

export interface AltOpportunityListItem {
  id: string;
  slug: string;
  titulo: string;
  subtitulo?: string | null;
  resumo?: string | null;
  classe: AltClasse;
  subclasse?: string | null;
  ticket_minimo?: number | null;
  ticket_maximo?: number | null;
  moeda: AltMoeda;
  horizonte_meses?: number | null;
  perfil_risco?: AltPerfilRisco | null;
  publico_alvo: AltPublicoAlvo;
  rentabilidade_alvo?: string | null;
  volume_captacao?: number | null;
  estrategia?: string | null;
  setor?: string | null;
  geografia?: string | null;
  tags?: string[] | null;
  status: AltStatus;
  data_abertura?: string | null;
  data_encerramento?: string | null;
  destaque: boolean;
  created_at: string;
  updated_at: string;
  partner?: AltPartnerLite | null;
}

export interface AltMaterial {
  id: string;
  tipo: AltMaterialTipo;
  titulo: string;
  descricao?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  tier_acesso: AltMaterialTier;
  watermark_enabled: boolean;
  versao: number;
  ordem: number;
}

export interface AltOpportunityFull extends AltOpportunityListItem {
  descricao_longa?: string | null;
  metadata?: Record<string, unknown> | null;
  partner?: AltPartnerFull | null;
}

export interface AltInterest {
  id: string;
  opportunity_id?: string;
  cliente_primeiro_nome: string;
  cliente_faixa_patrimonio: AltFaixaPatrimonio;
  ticket_pretendido?: number | null;
  status: AltInterestStatus;
  created_at: string;
  updated_at?: string;
  opportunity?: {
    slug: string;
    titulo: string;
    classe: AltClasse;
    partner?: { nome: string };
  } | null;
}

export interface AltOpportunityDetailResponse {
  opportunity: AltOpportunityFull;
  materials: AltMaterial[];
  my_interests: AltInterest[];
  has_interest_registered: boolean;
  suitability_version: string;
}

export interface AltOpportunityStats {
  total: number;
  captando: number;
  total_volume_captacao: number;
  by_classe: { classe: string; count: number; volume: number }[];
  by_status: { status: string; count: number }[];
  by_publico_alvo: { publico_alvo: string; count: number }[];
  by_perfil_risco: { perfil_risco: string; count: number }[];
}

export interface AltFiltersResponse {
  classes: string[];
  statuses: string[];
  publico_alvo: string[];
  perfil_risco: string[];
  setores: string[];
  geografias: string[];
  subclasses: string[];
}

export interface AltSuitabilityState {
  ack: {
    terms_version: string;
    acknowledged_at: string;
    declared_profile?: AltDeclaredProfile | null;
    declared_escritorio?: string | null;
  } | null;
  current_version: string;
  valid: boolean;
}

export interface AltOpportunityListParams {
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: "asc" | "desc";
  classe?: AltClasse | null;
  status?: AltStatus | null;
  publico_alvo?: AltPublicoAlvo | null;
  perfil_risco?: AltPerfilRisco | null;
  setor?: string | null;
  geografia?: string | null;
  search?: string | null;
  min_ticket?: number | null;
  max_ticket?: number | null;
  destaque?: boolean | null;
}

export interface AltOpportunityListResponse {
  data: AltOpportunityListItem[];
  count: number;
  limit: number;
  offset: number;
}

export interface AltInterestSubmitPayload {
  opportunity_id: string;
  aai_nome: string;
  aai_email: string;
  aai_telefone?: string;
  aai_escritorio?: string;
  cliente_primeiro_nome: string;
  cliente_faixa_patrimonio: AltFaixaPatrimonio;
  cliente_perfil_suitability?: string;
  ticket_pretendido?: number;
  observacoes?: string;
}

export interface AltSignedUrlResponse {
  signed_url: string;
  expires_in_seconds: number;
  watermark_enabled: boolean;
}

/* ─── Transport ─── */

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const headers: Record<string, string> = {};
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  if (anonKey) headers["apikey"] = anonKey;
  return headers;
}

async function altGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(ALT_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = await getAuthHeader();
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throwApiError(res, "Alternativos");
  return res.json() as Promise<T>;
}

async function altPost<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(ALT_API);
  url.searchParams.set("endpoint", endpoint);
  const headers = {
    ...(await getAuthHeader()),
    "Content-Type": "application/json",
  };
  const res = await fetch(url.toString(), { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throwApiError(res, "Alternativos");
  return res.json() as Promise<T>;
}

/* ─── Queries ─── */

export function useAltOpportunities(params: AltOpportunityListParams = {}) {
  const {
    limit = 50,
    offset = 0,
    orderBy = "created_at",
    order = "desc",
    classe,
    status,
    publico_alvo,
    perfil_risco,
    setor,
    geografia,
    search,
    min_ticket,
    max_ticket,
    destaque,
  } = params;

  const queryParams: Record<string, string> = {
    limit: String(limit),
    offset: String(offset),
    order_by: orderBy,
    order,
  };
  if (classe) queryParams.classe = classe;
  if (status) queryParams.status = status;
  if (publico_alvo) queryParams.publico_alvo = publico_alvo;
  if (perfil_risco) queryParams.perfil_risco = perfil_risco;
  if (setor) queryParams.setor = setor;
  if (geografia) queryParams.geografia = geografia;
  if (search) queryParams.search = search;
  if (min_ticket != null) queryParams.min_ticket = String(min_ticket);
  if (max_ticket != null) queryParams.max_ticket = String(max_ticket);
  if (destaque) queryParams.destaque = "true";

  return useQuery<AltOpportunityListResponse>({
    queryKey: ["alt", "opportunities_list", queryParams],
    queryFn: () => altGet<AltOpportunityListResponse>("alt_opportunities_list", queryParams),
    staleTime: STALE_FREQUENT,
    retry: 1,
  });
}

export function useAltOpportunityDetail(slug: string | null | undefined) {
  return useQuery<AltOpportunityDetailResponse>({
    queryKey: ["alt", "opportunity_detail", slug],
    queryFn: () => altGet<AltOpportunityDetailResponse>("alt_opportunity_detail", { slug: slug! }),
    enabled: !!slug,
    staleTime: STALE_REALTIME,
    retry: 1,
  });
}

export function useAltOpportunityStats() {
  return useQuery<AltOpportunityStats>({
    queryKey: ["alt", "opportunity_stats"],
    queryFn: () => altGet<AltOpportunityStats>("alt_opportunity_stats"),
    staleTime: STALE_FREQUENT,
    retry: 1,
  });
}

export function useAltOpportunityFilters() {
  return useQuery<AltFiltersResponse>({
    queryKey: ["alt", "opportunity_filters"],
    queryFn: () => altGet<AltFiltersResponse>("alt_opportunity_filters"),
    staleTime: STALE_FREQUENT,
    retry: 1,
  });
}

export function useAltSuitability() {
  return useQuery<AltSuitabilityState>({
    queryKey: ["alt", "suitability"],
    queryFn: () => altGet<AltSuitabilityState>("alt_suitability_get"),
    staleTime: STALE_REALTIME,
    retry: 1,
  });
}

export function useAltMyInterests() {
  return useQuery<{ data: AltInterest[] }>({
    queryKey: ["alt", "my_interests"],
    queryFn: () => altGet<{ data: AltInterest[] }>("alt_my_interests"),
    staleTime: STALE_REALTIME,
    retry: 1,
  });
}

/* ─── Mutations ─── */

export function useAckSuitability() {
  const qc = useQueryClient();
  return useMutation<
    { ok: true; terms_version: string },
    Error,
    { declared_profile: AltDeclaredProfile; declared_escritorio?: string }
  >({
    mutationFn: (body) => altPost("alt_suitability_ack", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alt", "suitability"] });
    },
  });
}

export function useLogOpportunityView() {
  return useMutation<{ ok: true }, Error, { opportunity_id: string }>({
    mutationFn: (body) => altPost("alt_log_view", body),
    // fire-and-forget: no invalidation
    retry: 0,
  });
}

export function useRequestMaterialSignedUrl() {
  return useMutation<AltSignedUrlResponse, Error, { material_id: string }>({
    mutationFn: (body) => altPost<AltSignedUrlResponse>("alt_material_signed_url", body),
  });
}

export function useSubmitInterest() {
  const qc = useQueryClient();
  return useMutation<
    { ok: true; interest: { id: string; created_at: string } },
    Error,
    AltInterestSubmitPayload
  >({
    mutationFn: (body) =>
      altPost<{ ok: true; interest: { id: string; created_at: string } }>(
        "alt_interest_submit",
        body as unknown as Record<string, unknown>,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alt", "my_interests"] });
      qc.invalidateQueries({ queryKey: ["alt", "opportunity_detail"] });
    },
  });
}

/* ─── Helpers / Labels ─── */

export const CLASSE_LABELS: Record<AltClasse, string> = {
  private_credit: "Private Credit",
  private_equity: "Private Equity",
  real_estate: "Real Estate",
  ofertas_restritas: "Ofertas Restritas",
  club_deals: "Club Deals",
  offshore: "Offshore",
  alt_liquidos: "Alt. Líquidos",
};

export const STATUS_LABELS: Record<AltStatus, string> = {
  em_breve: "Em breve",
  captando: "Captando",
  encerrada: "Encerrada",
  pausada: "Pausada",
};

export const STATUS_COLORS: Record<AltStatus, string> = {
  em_breve: "#F59E0B",
  captando: "#10B981",
  encerrada: "#6B7280",
  pausada: "#EC4899",
};

export const PUBLICO_ALVO_LABELS: Record<AltPublicoAlvo, string> = {
  qualificado: "Investidor Qualificado",
  profissional: "Investidor Profissional",
  varejo: "Varejo",
};

export const PERFIL_RISCO_LABELS: Record<AltPerfilRisco, string> = {
  conservador: "Conservador",
  moderado: "Moderado",
  arrojado: "Arrojado",
};

export const FAIXA_PATRIMONIO_LABELS: Record<AltFaixaPatrimonio, string> = {
  ate_1m: "Até R$ 1M",
  "1m_5m": "R$ 1M – 5M",
  "5m_10m": "R$ 5M – 10M",
  "10m_plus": "Acima de R$ 10M",
};

export const MATERIAL_TIPO_LABELS: Record<AltMaterialTipo, string> = {
  teaser: "Teaser",
  deck: "Apresentação",
  term_sheet: "Term Sheet",
  dd_document: "Due Diligence",
  regulamento: "Regulamento",
  outro: "Outro",
};

export const INTEREST_STATUS_LABELS: Record<AltInterestStatus, string> = {
  novo: "Novo",
  enviado_gestora: "Enviado à gestora",
  em_contato: "Em contato",
  em_analise: "Em análise",
  fechado: "Fechado",
  recusado: "Recusado",
  desistiu: "Desistiu",
};

export const CLASSE_COLORS: Record<AltClasse, string> = {
  private_credit: "#F97316",
  private_equity: "#8B5CF6",
  real_estate: "#EC4899",
  ofertas_restritas: "#06B6D4",
  club_deals: "#22C55E",
  offshore: "#0B6C3E",
  alt_liquidos: "#F59E0B",
};

export function formatMoney(value: number | null | undefined, moeda: AltMoeda = "BRL"): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const prefix = moeda === "USD" ? "US$" : moeda === "EUR" ? "€" : "R$";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${prefix} ${(value / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${prefix} ${(value / 1e6).toFixed(2)} M`;
  if (abs >= 1e3) return `${prefix} ${(value / 1e3).toFixed(0)} k`;
  return `${prefix} ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function formatHorizonte(meses: number | null | undefined): string {
  if (meses == null || meses <= 0) return "—";
  if (meses < 12) return `${meses} m`;
  const anos = meses / 12;
  return anos === Math.floor(anos) ? `${anos.toFixed(0)} anos` : `${anos.toFixed(1)} anos`;
}
