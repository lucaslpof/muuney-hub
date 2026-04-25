import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const HUB_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-macro-api";

/* ─── Monetary Policy Events (COPOM / FOMC) ─── */
export interface MonetaryEvent {
  id: number;
  event_date: string;
  authority: "COPOM" | "FOMC";
  decision: "hike" | "cut" | "hold" | "start";
  rate_before: number | null;
  rate_after: number;
  bps_change: number | null;
  vote: string | null;
  rationale: string | null;
}

/**
 * Fetch monetary policy events (COPOM and/or FOMC) for chart overlays.
 * Results are cached for 12h (events rarely change once published).
 */
export function useMonetaryEvents(authority?: "COPOM" | "FOMC" | "both") {
  const key = authority || "both";
  return useQuery<MonetaryEvent[]>({
    queryKey: ["hub", "monetary_events", key],
    queryFn: async () => {
      let query = supabase
        .from("hub_monetary_events")
        .select("*")
        .order("event_date", { ascending: true });
      if (authority && authority !== "both") {
        query = query.eq("authority", authority);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as MonetaryEvent[]) || [];
    },
    staleTime: 12 * 60 * 60 * 1000,
    retry: 2,
  });
}

export interface SeriesDataPoint {
  date: string;
  value: number;
}

export interface LatestCard {
  serie_code: string;
  category: string;
  display_name: string;
  description: string;
  unit: string;
  source: string;
  last_value: number;
  last_date: string;
  change_pct: number;
  trend: "up" | "down" | "stable";
}

export interface OverviewItem {
  serie_code: string;
  category: string;
  display_name: string;
  unit: string;
  last_value: number;
  last_date: string;
}

/* ─── API response shapes ─── */
interface ApiIndicatorLatest {
  code: string | number;
  category: string;
  name: string;
  unit: string;
  current_value?: number;
  current_date?: string;
  change_percent?: number;
  trend?: "up" | "down" | "stable";
}

interface ApiIndicatorOverview {
  code: string | number;
  category: string;
  name: string;
  unit: string;
  latest_value?: number;
  latest_date?: string;
}

interface ApiLatestResponse {
  indicators?: ApiIndicatorLatest[];
}

interface ApiOverviewResponse {
  indicators?: ApiIndicatorOverview[];
}

interface ApiSeriesItem {
  serie_code?: number | string;
  serie_name?: string;
  category?: string;
  unit?: string;
  data?: SeriesDataPoint[];
}

interface ApiSeriesResponse {
  module?: string;
  period?: string;
  start_date?: string;
  series?: ApiSeriesItem[];
}

/* ─── Multi-series map: all series keyed by serie_code ─── */
export interface SeriesBundle {
  [serieCode: string]: {
    name: string;
    unit: string;
    category: string;
    data: SeriesDataPoint[];
  };
}

interface IngestionModule {
  module: string;
  total_series: number;
  last_success: string | null;
  records_today: number;
  errors_today: number;
}

export interface IngestionStatusResponse {
  modules?: IngestionModule[];
}

async function fetchHub(endpoint: string, params: Record<string, string> = {}): Promise<unknown> {
  const url = new URL(HUB_API);
  url.searchParams.set("endpoint", endpoint);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    const { throwApiError } = await import("@/lib/apiError");
    throwApiError(res, "Macro");
  }
  return res.json() as Promise<unknown>;
}

/* Map numeric BACEN SGS codes to friendly serie_code used by Dashboard & MACRO_SAMPLE */
const CODE_TO_FRIENDLY: Record<number, string> = {
  432: "selic_meta",
  11: "selic_efetiva",
  433: "ipca_mensal",
  13522: "ipca_12m",
  1: "ptax_compra",
  10813: "ptax_venda",
  4189: "selic_diaria",
  4392: "cdi_acumulado",
  4380: "pib_var",
  4503: "divida_pib",
  13762: "divida_bruta_pib",
};

/* Map API "latest" response → LatestCard[] expected by frontend */
function mapLatestResponse(apiData: unknown): LatestCard[] {
  const response = apiData as ApiLatestResponse;
  const indicators = response?.indicators || [];
  return indicators.map((ind) => ({
    serie_code: CODE_TO_FRIENDLY[Number(ind.code)] ?? String(ind.code),
    category: ind.category,
    display_name: ind.name,
    description: ind.name,
    unit: ind.unit,
    source: `BACEN SGS ${ind.code}`,
    last_value: ind.current_value ?? 0,
    last_date: ind.current_date ?? "",
    change_pct: ind.change_percent ?? 0,
    trend: ind.trend ?? "stable",
  }));
}

/* Map API "overview" response → OverviewItem[] */
function mapOverviewResponse(apiData: unknown): OverviewItem[] {
  const response = apiData as ApiOverviewResponse;
  const indicators = response?.indicators || [];
  return indicators.map((ind) => ({
    serie_code: String(ind.code),
    category: ind.category,
    display_name: ind.name,
    unit: ind.unit,
    last_value: ind.latest_value ?? 0,
    last_date: ind.latest_date ?? "",
  }));
}

/* Map API "series" response → SeriesDataPoint[] (flattened, first serie) */
function mapSeriesResponse(apiData: unknown): SeriesDataPoint[] {
  const response = apiData as ApiSeriesResponse;
  const series = response?.series || [];
  if (series.length === 0) return [];
  return series[0].data || [];
}

/* Map API "series" response → SeriesBundle (ALL series keyed by code) */
function mapSeriesBundleResponse(apiData: unknown): SeriesBundle {
  const response = apiData as ApiSeriesResponse;
  const series = response?.series || [];
  const bundle: SeriesBundle = {};
  for (const s of series) {
    const code = String(s.serie_code ?? "unknown");
    bundle[code] = {
      name: s.serie_name ?? code,
      unit: s.unit ?? "",
      category: s.category ?? "",
      data: s.data ?? [],
    };
  }
  return bundle;
}

// Bumpar este sufixo invalida todos os caches React Query relacionados a meta
// (latest/overview/series) e força refetch — usar quando hub_macro_series_meta
// muda de label/unit/category. Última bumpada: 25/04/2026 (Crédito VG fix).
const META_VERSION = "v2";

export function useHubLatest(module: "macro" | "credito" = "macro") {
  return useQuery<LatestCard[]>({
    queryKey: ["hub", "latest", module, META_VERSION],
    queryFn: async () => mapLatestResponse(await fetchHub("latest", { module })),
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useHubOverview(module: "macro" | "credito" = "macro") {
  return useQuery<OverviewItem[]>({
    queryKey: ["hub", "overview", module, META_VERSION],
    queryFn: async () => mapOverviewResponse(await fetchHub("overview", { module })),
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useHubSeries(category: string, period: string = "1y", module: "macro" | "credito" = "macro") {
  return useQuery<SeriesDataPoint[]>({
    queryKey: ["hub", "series", module, category, period, META_VERSION],
    queryFn: async () => mapSeriesResponse(await fetchHub("series", { category, period, module })),
    staleTime: 30 * 60 * 1000,
    enabled: !!category,
    retry: 2,
  });
}

/**
 * Fetch ALL series in a category as a bundle keyed by serie_code.
 * Use this instead of useHubSeries when you need individual series from a category.
 * Example: useHubSeriesBundle("trabalho", "1y", "macro") → { "24369": {...}, "28544": {...}, ... }
 */
export function useHubSeriesBundle(
  category: string,
  period: string = "1y",
  module: "macro" | "credito" = "macro",
  enabled: boolean = true,
) {
  return useQuery<SeriesBundle>({
    queryKey: ["hub", "series-bundle", module, category, period, META_VERSION],
    queryFn: async () => mapSeriesBundleResponse(await fetchHub("series", { category, period, module })),
    staleTime: 30 * 60 * 1000,
    enabled: enabled && !!category,
    retry: 2,
  });
}

/** Helper: extract a single serie's data from a bundle, with empty fallback */
export function pickSeries(bundle: SeriesBundle | undefined, code: string | number): SeriesDataPoint[] {
  if (!bundle) return [];
  return bundle[String(code)]?.data ?? [];
}

export function useHubIngestionStatus() {
  return useQuery<IngestionStatusResponse>({
    queryKey: ["hub", "ingestion_status"],
    queryFn: () => fetchHub("ingestion_status") as Promise<IngestionStatusResponse>,
    staleTime: 5 * 60 * 1000,
  });
}

/* ─── Credit Products (dynamic from Supabase) ─── */
export interface CreditProduct {
  id: number;
  tipo: "PF" | "PJ";
  nome: string;
  taxa_aa: number;
  taxa_am: number;
  spread_aa: number;
  spread_am: number;
  inadimplencia: number;
  sgs_taxa: number;
  sgs_spread: number;
  sgs_inadim: number;
  updated_at: string;
}

interface ProductsResponse {
  products?: CreditProduct[];
  count?: number;
  updated_at?: string;
}

export function useProductData(tipo?: "PF" | "PJ") {
  return useQuery<CreditProduct[]>({
    queryKey: ["hub", "products", tipo || "all"],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (tipo) params.tipo = tipo;
      const raw = (await fetchHub("products", params)) as ProductsResponse;
      return raw?.products || [];
    },
    staleTime: 60 * 60 * 1000, // 1h — product data changes monthly
    retry: 2,
  });
}

// Sample data fallback for when API has no data yet
export const MACRO_SAMPLE: LatestCard[] = [
  // Selic / Monetária
  { serie_code: "selic_meta", category: "selic", display_name: "Selic Meta", description: "Taxa básica de juros", unit: "% a.a.", source: "BACEN SGS 432", last_value: 14.75, last_date: "2026-04-29", change_pct: 0.50, trend: "up" },
  { serie_code: "4189", category: "monetaria", display_name: "Selic Diária", description: "Taxa Selic diária anualizada", unit: "% a.a.", source: "BACEN SGS 4189", last_value: 14.15, last_date: "2026-03-28", change_pct: 0.00, trend: "stable" },
  { serie_code: "27813", category: "monetaria", display_name: "M1", description: "Agregado monetário M1", unit: "R$ bi", source: "BACEN SGS 27813", last_value: 652.40, last_date: "2026-02-01", change_pct: 1.20, trend: "up" },
  { serie_code: "27814", category: "monetaria", display_name: "M2", description: "Agregado monetário M2", unit: "R$ bi", source: "BACEN SGS 27814", last_value: 4832.10, last_date: "2026-02-01", change_pct: 0.80, trend: "up" },
  // IPCA / Inflação
  { serie_code: "ipca_mensal", category: "ipca", display_name: "IPCA Mensal", description: "Inflação oficial", unit: "%", source: "BACEN SGS 433", last_value: 0.88, last_date: "2026-03-01", change_pct: 0.32, trend: "up" },
  { serie_code: "ipca_12m", category: "ipca", display_name: "IPCA 12m", description: "Inflação acumulada 12 meses", unit: "%", source: "BACEN SGS 13522", last_value: 4.14, last_date: "2026-03-01", change_pct: 0.33, trend: "up" },
  { serie_code: "188", category: "inflacao", display_name: "INPC", description: "INPC mensal", unit: "%", source: "BACEN SGS 188", last_value: 0.48, last_date: "2026-02-01", change_pct: 0.05, trend: "up" },
  { serie_code: "16121", category: "inflacao", display_name: "IPCA Ano", description: "IPCA acumulado no ano", unit: "%", source: "BACEN SGS 16121", last_value: 1.12, last_date: "2026-02-01", change_pct: 0.56, trend: "up" },
  // Atividade
  { serie_code: "pib_var", category: "pib", display_name: "PIB Var. %", description: "Crescimento trimestral", unit: "%", source: "BACEN SGS 4380", last_value: 3.20, last_date: "2025-12-01", change_pct: 0.50, trend: "up" },
  { serie_code: "24363", category: "atividade", display_name: "IBC-Br", description: "Índice de Atividade Econômica", unit: "Índice", source: "BACEN SGS 24363", last_value: 152.30, last_date: "2026-01-01", change_pct: 0.40, trend: "up" },
  { serie_code: "11064", category: "atividade", display_name: "Prod. Industrial", description: "Produção industrial geral", unit: "%", source: "BACEN SGS 11064", last_value: 1.80, last_date: "2026-01-01", change_pct: -0.30, trend: "down" },
  { serie_code: "22089", category: "atividade", display_name: "PIB Serviços", description: "PIB setor serviços", unit: "R$ bi", source: "BACEN SGS 22089", last_value: 1842.50, last_date: "2025-12-01", change_pct: 0.60, trend: "up" },
  // Câmbio / Externo
  { serie_code: "ptax_compra", category: "cambio", display_name: "PTAX Compra", description: "Câmbio USD/BRL", unit: "R$", source: "BACEN SGS 1", last_value: 4.98, last_date: "2026-04-14", change_pct: -0.40, trend: "down" },
  { serie_code: "3546", category: "externo", display_name: "Reservas Int.", description: "Reservas internacionais", unit: "US$ bi", source: "BACEN SGS 3546", last_value: 355.20, last_date: "2026-02-01", change_pct: 0.15, trend: "up" },
  { serie_code: "29641", category: "externo", display_name: "IDP", description: "Investimento direto no país", unit: "US$ mi", source: "BACEN SGS 29641", last_value: 6820.00, last_date: "2026-01-01", change_pct: -2.10, trend: "down" },
  // Dívida / Fiscal
  { serie_code: "divida_pib", category: "divida", display_name: "Dívida/PIB", description: "Dívida líquida do setor público", unit: "%", source: "BACEN SGS 4503", last_value: 62.60, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
  { serie_code: "5364", category: "fiscal", display_name: "Resultado Primário", description: "Resultado primário governo central 12m", unit: "% PIB", source: "BACEN SGS 5364", last_value: 1.57, last_date: "2026-02-01", change_pct: 0.10, trend: "up" },
  { serie_code: "4505", category: "fiscal", display_name: "NFSP Nominal", description: "Necessidade de financiamento resultado nominal", unit: "% PIB", source: "BACEN SGS 4505", last_value: -1.47, last_date: "2026-02-01", change_pct: -0.08, trend: "down" },
  // Trabalho
  { serie_code: "24369", category: "trabalho", display_name: "Desocupação", description: "Taxa de desocupação PNAD Contínua", unit: "%", source: "BACEN SGS 24369", last_value: 5.80, last_date: "2026-02-01", change_pct: -0.30, trend: "down" },
  { serie_code: "28544", category: "trabalho", display_name: "Massa Salarial Real", description: "Massa de rendimento real habitual PNAD", unit: "R$ mi", source: "BACEN SGS 28544", last_value: 412288.00, last_date: "2026-01-01", change_pct: 0.17, trend: "up" },
  { serie_code: "28763", category: "trabalho", display_name: "Saldo CAGED", description: "Saldo empregos formais CAGED", unit: "mil", source: "BACEN SGS 28763", last_value: 132.50, last_date: "2026-02-01", change_pct: -15.30, trend: "down" },
  { serie_code: "24376", category: "trabalho", display_name: "Rend. Médio Real", description: "Rendimento médio real habitual", unit: "R$", source: "BACEN SGS 24376", last_value: 3280.00, last_date: "2026-01-01", change_pct: 0.90, trend: "up" },
  // Focus
  { serie_code: "990001", category: "focus", display_name: "IPCA Esperado 2026", description: "Expectativa mediana IPCA 2026", unit: "%", source: "BACEN Focus", last_value: 4.31, last_date: "2026-03-28", change_pct: 0.05, trend: "up" },
  { serie_code: "990002", category: "focus", display_name: "Selic Esperada 2026", description: "Expectativa mediana Selic 2026", unit: "% a.a.", source: "BACEN Focus", last_value: 12.50, last_date: "2026-03-28", change_pct: 0.00, trend: "stable" },
  { serie_code: "990003", category: "focus", display_name: "PIB Esperado 2026", description: "Expectativa mediana PIB 2026", unit: "%", source: "BACEN Focus", last_value: 1.85, last_date: "2026-03-28", change_pct: -0.02, trend: "down" },
  { serie_code: "990004", category: "focus", display_name: "Câmbio Esperado 2026", description: "Expectativa mediana câmbio 2026", unit: "R$/US$", source: "BACEN Focus", last_value: 5.40, last_date: "2026-03-28", change_pct: 0.01, trend: "up" },
  { serie_code: "990011", category: "focus", display_name: "IPCA Esperado 2027", description: "Expectativa mediana IPCA 2027", unit: "%", source: "BACEN Focus", last_value: 3.84, last_date: "2026-03-28", change_pct: -0.01, trend: "down" },
  { serie_code: "990012", category: "focus", display_name: "Selic Esperada 2027", description: "Expectativa mediana Selic 2027", unit: "% a.a.", source: "BACEN Focus", last_value: 10.50, last_date: "2026-03-28", change_pct: 0.00, trend: "stable" },
];

export const CREDITO_SAMPLE: LatestCard[] = [
  // Saldos (H1.1b-1)
  { serie_code: "20539", category: "saldo_credito", display_name: "Crédito/PIB", description: "Relação crédito total sobre PIB", unit: "%", source: "BACEN SGS 20539", last_value: 54.20, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
  { serie_code: "20540", category: "saldo_credito", display_name: "Saldo Total SFN", description: "Saldo de crédito total do SFN", unit: "R$ tri", source: "BACEN SGS 20540", last_value: 6.12, last_date: "2026-01-01", change_pct: 0.90, trend: "up" },
  { serie_code: "20541", category: "saldo_credito", display_name: "Saldo PF Total", description: "Saldo crédito PF total", unit: "R$ bi", source: "BACEN SGS 20541", last_value: 3580.00, last_date: "2026-01-01", change_pct: 0.65, trend: "up" },
  { serie_code: "28848", category: "saldo_credito", display_name: "Saldo PF Livres", description: "Saldo crédito PF recursos livres", unit: "R$ bi", source: "BACEN SGS 28848", last_value: 1942.00, last_date: "2026-01-01", change_pct: 0.80, trend: "up" },
  { serie_code: "28860", category: "saldo_credito", display_name: "Saldo PJ Livres", description: "Saldo crédito PJ recursos livres", unit: "R$ bi", source: "BACEN SGS 28860", last_value: 1240.00, last_date: "2026-01-01", change_pct: 0.45, trend: "up" },
  { serie_code: "20581", category: "saldo_credito", display_name: "Veículos PF", description: "Saldo crédito veículos PF", unit: "R$ bi", source: "BACEN SGS 20581", last_value: 312.40, last_date: "2026-01-01", change_pct: 1.10, trend: "up" },
  { serie_code: "20590", category: "saldo_credito", display_name: "Cartão PF", description: "Saldo cartão de crédito PF", unit: "R$ bi", source: "BACEN SGS 20590", last_value: 548.60, last_date: "2026-01-01", change_pct: 2.30, trend: "up" },
  { serie_code: "25891", category: "saldo_credito", display_name: "PME Peq. Porte", description: "Crédito PME pequeno porte", unit: "R$ bi", source: "BACEN SGS 25891", last_value: 285.10, last_date: "2026-01-01", change_pct: 0.50, trend: "up" },
  // Concessões (H1.1b-2)
  { serie_code: "20631", category: "concessao", display_name: "Concessões PF", description: "Concessões de crédito PF", unit: "R$ bi", source: "BACEN SGS 20631", last_value: 254.30, last_date: "2026-01-01", change_pct: 1.20, trend: "up" },
  { serie_code: "20632", category: "concessao", display_name: "Concessões PJ", description: "Concessões de crédito PJ", unit: "R$ bi", source: "BACEN SGS 20632", last_value: 198.70, last_date: "2026-01-01", change_pct: -0.80, trend: "down" },
  { serie_code: "20671", category: "concessao", display_name: "Consignado PF", description: "Crédito pessoal consignado PF", unit: "R$ bi", source: "BACEN SGS 20671", last_value: 38.50, last_date: "2026-01-01", change_pct: 0.60, trend: "up" },
  // Taxas (H1.1b-3)
  { serie_code: "20714", category: "taxa", display_name: "Taxa Média PF", description: "Taxa média empréstimos PF", unit: "% a.a.", source: "BACEN SGS 20714", last_value: 52.60, last_date: "2026-01-01", change_pct: 0.40, trend: "up" },
  { serie_code: "20715", category: "taxa", display_name: "Taxa Média PJ", description: "Taxa média empréstimos PJ", unit: "% a.a.", source: "BACEN SGS 20715", last_value: 23.80, last_date: "2026-01-01", change_pct: 0.15, trend: "up" },
  { serie_code: "20740", category: "taxa", display_name: "Taxa PF Livres", description: "Taxa média PF recursos livres", unit: "% a.a.", source: "BACEN SGS 20740", last_value: 58.40, last_date: "2026-01-01", change_pct: 0.55, trend: "up" },
  { serie_code: "20749", category: "taxa", display_name: "Taxa Veículos PF", description: "Taxa financiamento veículos PF", unit: "% a.a.", source: "BACEN SGS 20749", last_value: 26.30, last_date: "2026-01-01", change_pct: -0.20, trend: "down" },
  { serie_code: "20763", category: "taxa", display_name: "Taxa Direcionados PJ", description: "Taxa crédito direcionado PJ", unit: "% a.a.", source: "BACEN SGS 20763", last_value: 14.20, last_date: "2026-01-01", change_pct: 0.10, trend: "up" },
  { serie_code: "26428", category: "taxa", display_name: "Taxa Microempresas", description: "Taxa média microempresas", unit: "% a.a.", source: "BACEN SGS 26428", last_value: 44.10, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
  // Inadimplência (H1.1b-4)
  { serie_code: "21082", category: "inadimplencia", display_name: "Inadimplência Total", description: "Taxa inadimplência >90 dias", unit: "%", source: "BACEN SGS 21082", last_value: 3.30, last_date: "2026-01-01", change_pct: 0.10, trend: "up" },
  { serie_code: "21083", category: "inadimplencia", display_name: "Inadimplência PF", description: "Inadimplência PF >90 dias", unit: "%", source: "BACEN SGS 21083", last_value: 4.10, last_date: "2026-01-01", change_pct: 0.05, trend: "up" },
  { serie_code: "21084", category: "inadimplencia", display_name: "Inadimplência PJ", description: "Inadimplência PJ >90 dias", unit: "%", source: "BACEN SGS 21084", last_value: 2.40, last_date: "2026-01-01", change_pct: -0.15, trend: "down" },
  { serie_code: "12948", category: "inadimplencia", display_name: "Inadim. SFN Agregada", description: "Inadimplência agregada SFN", unit: "%", source: "BACEN SGS 12948", last_value: 3.05, last_date: "2026-01-01", change_pct: 0.08, trend: "up" },
  { serie_code: "13685", category: "inadimplencia", display_name: "Inadim. Priv. Nacional", description: "Inadimplência IFs privadas nacionais", unit: "%", source: "BACEN SGS 13685", last_value: 3.80, last_date: "2026-01-01", change_pct: 0.12, trend: "up" },
  { serie_code: "13667", category: "inadimplencia", display_name: "Inadim. Público", description: "Inadimplência IFs controle público", unit: "%", source: "BACEN SGS 13667", last_value: 2.60, last_date: "2026-01-01", change_pct: -0.05, trend: "down" },
  { serie_code: "21154", category: "inadimplencia", display_name: "Inadim. Direcionados PF", description: "Inadimplência direcionados PF", unit: "%", source: "BACEN SGS 21154", last_value: 1.85, last_date: "2026-01-01", change_pct: 0.03, trend: "up" },
  // Spreads (H1.1b-5)
  { serie_code: "20783", category: "spread", display_name: "Spread PF", description: "Spread bancário PF", unit: "p.p.", source: "BACEN SGS 20783", last_value: 30.20, last_date: "2026-01-01", change_pct: -0.50, trend: "down" },
  { serie_code: "20784", category: "spread", display_name: "Spread PJ", description: "Spread bancário PJ", unit: "p.p.", source: "BACEN SGS 20784", last_value: 10.80, last_date: "2026-01-01", change_pct: 0.20, trend: "up" },
  { serie_code: "20785", category: "spread", display_name: "Spread Livres PF", description: "Spread recursos livres PF", unit: "p.p.", source: "BACEN SGS 20785", last_value: 35.60, last_date: "2026-01-01", change_pct: -0.30, trend: "down" },
  { serie_code: "20786", category: "spread", display_name: "Spread Livres PJ", description: "Spread recursos livres PJ", unit: "p.p.", source: "BACEN SGS 20786", last_value: 12.40, last_date: "2026-01-01", change_pct: 0.15, trend: "up" },
  { serie_code: "20787", category: "spread", display_name: "Spread Direcionados", description: "Spread direcionados total", unit: "p.p.", source: "BACEN SGS 20787", last_value: 5.20, last_date: "2026-01-01", change_pct: -0.10, trend: "down" },
  { serie_code: "20826", category: "spread", display_name: "Spread Pós-fixadas", description: "Spread operações pós-fixadas", unit: "p.p.", source: "BACEN SGS 20826", last_value: 22.10, last_date: "2026-01-01", change_pct: 0.25, trend: "up" },
  { serie_code: "20837", category: "spread", display_name: "Spread Pré-fixadas", description: "Spread operações pré-fixadas", unit: "p.p.", source: "BACEN SGS 20837", last_value: 28.40, last_date: "2026-01-01", change_pct: -0.40, trend: "down" },
  // Outros (H1.1b-6)
  { serie_code: "25147", category: "cartoes", display_name: "Cartões Emitidos", description: "Cartões de crédito emitidos", unit: "mi", source: "BACEN SGS 25147", last_value: 215.80, last_date: "2026-01-01", change_pct: 1.50, trend: "up" },
  // ── Overview Mensal — Saldos extras ──
  { serie_code: "20542", category: "saldo_credito", display_name: "Saldo PJ Total", description: "Saldo crédito PJ total", unit: "R$ bi", source: "BACEN SGS 20542", last_value: 2340.00, last_date: "2026-01-01", change_pct: 0.55, trend: "up" },
  { serie_code: "20543", category: "saldo_credito", display_name: "Saldo Livres Total", description: "Saldo crédito recursos livres", unit: "R$ bi", source: "BACEN SGS 20543", last_value: 3520.00, last_date: "2026-01-01", change_pct: 0.72, trend: "up" },
  { serie_code: "20544", category: "saldo_credito", display_name: "Saldo Direcionados Total", description: "Saldo crédito recursos direcionados", unit: "R$ bi", source: "BACEN SGS 20544", last_value: 2600.00, last_date: "2026-01-01", change_pct: 0.48, trend: "up" },
  // ── Overview Mensal — PF por modalidade ──
  { serie_code: "20570", category: "saldo_pf_modal", display_name: "Pessoal Não Consignado", description: "Crédito pessoal não consignado PF", unit: "R$ bi", source: "BACEN SGS 20570", last_value: 428.50, last_date: "2026-01-01", change_pct: 1.80, trend: "up" },
  { serie_code: "20572", category: "saldo_pf_modal", display_name: "Consignado INSS", description: "Crédito consignado INSS PF", unit: "R$ bi", source: "BACEN SGS 20572", last_value: 582.10, last_date: "2026-01-01", change_pct: 0.45, trend: "up" },
  { serie_code: "20593", category: "saldo_pf_modal", display_name: "Rural PF", description: "Crédito rural PF direcionado", unit: "R$ bi", source: "BACEN SGS 20593", last_value: 384.20, last_date: "2026-01-01", change_pct: 0.90, trend: "up" },
  { serie_code: "20599", category: "saldo_pf_modal", display_name: "Habitacional PF", description: "Financiamento habitacional PF", unit: "R$ bi", source: "BACEN SGS 20599", last_value: 892.60, last_date: "2026-01-01", change_pct: 0.65, trend: "up" },
  { serie_code: "20606", category: "saldo_pf_modal", display_name: "BNDES Repasses PF", description: "Repasses BNDES PF", unit: "R$ bi", source: "BACEN SGS 20606", last_value: 42.30, last_date: "2026-01-01", change_pct: -0.20, trend: "down" },
  // ── Overview Mensal — PJ por modalidade ──
  { serie_code: "20551", category: "saldo_pj_modal", display_name: "Capital de Giro", description: "Capital de giro PJ livres", unit: "R$ bi", source: "BACEN SGS 20551", last_value: 498.70, last_date: "2026-01-01", change_pct: 0.60, trend: "up" },
  { serie_code: "20553", category: "saldo_pj_modal", display_name: "Desc. Duplicatas", description: "Desconto de duplicatas PJ", unit: "R$ bi", source: "BACEN SGS 20553", last_value: 142.30, last_date: "2026-01-01", change_pct: 0.35, trend: "up" },
  { serie_code: "20556", category: "saldo_pj_modal", display_name: "Conta Garantida", description: "Conta garantida / cheque especial PJ", unit: "R$ bi", source: "BACEN SGS 20556", last_value: 54.80, last_date: "2026-01-01", change_pct: -1.20, trend: "down" },
  { serie_code: "20560", category: "saldo_pj_modal", display_name: "Comércio Exterior", description: "ACC/ACE comércio exterior PJ", unit: "R$ bi", source: "BACEN SGS 20560", last_value: 112.40, last_date: "2026-01-01", change_pct: 2.10, trend: "up" },
  { serie_code: "20564", category: "saldo_pj_modal", display_name: "Financ. Exportações", description: "Financiamento a exportações PJ", unit: "R$ bi", source: "BACEN SGS 20564", last_value: 68.90, last_date: "2026-01-01", change_pct: 1.50, trend: "up" },
  { serie_code: "20611", category: "saldo_pj_modal", display_name: "Rural PJ", description: "Crédito rural PJ direcionado", unit: "R$ bi", source: "BACEN SGS 20611", last_value: 412.50, last_date: "2026-01-01", change_pct: 0.80, trend: "up" },
  { serie_code: "20614", category: "saldo_pj_modal", display_name: "Habitacional PJ", description: "Financiamento habitacional PJ", unit: "R$ bi", source: "BACEN SGS 20614", last_value: 98.20, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
  { serie_code: "20622", category: "saldo_pj_modal", display_name: "BNDES Repasses PJ", description: "Repasses BNDES PJ", unit: "R$ bi", source: "BACEN SGS 20622", last_value: 310.40, last_date: "2026-01-01", change_pct: -0.40, trend: "down" },
  // ── Overview Mensal — Concessões extras ──
  { serie_code: "20633", category: "concessao", display_name: "Concessões PF Livres", description: "Concessões PF recursos livres", unit: "R$ bi", source: "BACEN SGS 20633", last_value: 198.40, last_date: "2026-01-01", change_pct: 1.40, trend: "up" },
  { serie_code: "20634", category: "concessao", display_name: "Concessões PJ Livres", description: "Concessões PJ recursos livres", unit: "R$ bi", source: "BACEN SGS 20634", last_value: 165.20, last_date: "2026-01-01", change_pct: -0.60, trend: "down" },
  // ── Overview Mensal — Inadimplência detalhada ──
  { serie_code: "21085", category: "inadim_detalhe", display_name: "Inadim. Livres", description: "Inadimplência >90d recursos livres", unit: "%", source: "BACEN SGS 21085", last_value: 4.50, last_date: "2026-01-01", change_pct: 0.08, trend: "up" },
  { serie_code: "21086", category: "inadim_detalhe", display_name: "Inadim. Direcionados", description: "Inadimplência >90d direcionados", unit: "%", source: "BACEN SGS 21086", last_value: 1.60, last_date: "2026-01-01", change_pct: -0.05, trend: "down" },
  { serie_code: "21087", category: "inadim_detalhe", display_name: "Inadim. PF Livres", description: "Inadimplência >90d PF livres", unit: "%", source: "BACEN SGS 21087", last_value: 5.80, last_date: "2026-01-01", change_pct: 0.12, trend: "up" },
  { serie_code: "21088", category: "inadim_detalhe", display_name: "Inadim. PJ Livres", description: "Inadimplência >90d PJ livres", unit: "%", source: "BACEN SGS 21088", last_value: 2.80, last_date: "2026-01-01", change_pct: -0.10, trend: "down" },
  { serie_code: "21089", category: "inadim_detalhe", display_name: "Inadim. PF Direcionados", description: "Inadimplência >90d PF direcionados", unit: "%", source: "BACEN SGS 21089", last_value: 1.90, last_date: "2026-01-01", change_pct: 0.03, trend: "up" },
  { serie_code: "21090", category: "inadim_detalhe", display_name: "Inadim. PJ Direcionados", description: "Inadimplência >90d PJ direcionados", unit: "%", source: "BACEN SGS 21090", last_value: 1.20, last_date: "2026-01-01", change_pct: -0.08, trend: "down" },
  // ── Overview Mensal — Inadimplência 15-90 dias ──
  { serie_code: "21128", category: "inadim_15_90", display_name: "15-90d Total", description: "Inadimplência 15-90 dias total", unit: "%", source: "BACEN SGS 21128", last_value: 4.20, last_date: "2026-01-01", change_pct: 0.05, trend: "up" },
  { serie_code: "21129", category: "inadim_15_90", display_name: "15-90d PF", description: "Inadimplência 15-90 dias PF", unit: "%", source: "BACEN SGS 21129", last_value: 5.10, last_date: "2026-01-01", change_pct: 0.08, trend: "up" },
  { serie_code: "21130", category: "inadim_15_90", display_name: "15-90d PJ", description: "Inadimplência 15-90 dias PJ", unit: "%", source: "BACEN SGS 21130", last_value: 2.90, last_date: "2026-01-01", change_pct: -0.12, trend: "down" },
  { serie_code: "21131", category: "inadim_15_90", display_name: "15-90d Livres", description: "Inadimplência 15-90 dias livres", unit: "%", source: "BACEN SGS 21131", last_value: 5.60, last_date: "2026-01-01", change_pct: 0.10, trend: "up" },
  { serie_code: "21132", category: "inadim_15_90", display_name: "15-90d Direcionados", description: "Inadimplência 15-90 dias direcionados", unit: "%", source: "BACEN SGS 21132", last_value: 2.10, last_date: "2026-01-01", change_pct: -0.06, trend: "down" },
  // ── Overview Mensal — Taxas extras ──
  { serie_code: "20751", category: "taxa", display_name: "Taxa PJ Livres", description: "Taxa média PJ recursos livres", unit: "% a.a.", source: "BACEN SGS 20751", last_value: 25.60, last_date: "2026-01-01", change_pct: 0.20, trend: "up" },
  { serie_code: "20760", category: "taxa", display_name: "Taxa PF Direcionados", description: "Taxa média PF direcionados", unit: "% a.a.", source: "BACEN SGS 20760", last_value: 10.80, last_date: "2026-01-01", change_pct: 0.10, trend: "up" },
  // ── Overview Mensal — Alavancagem PF ──
  { serie_code: "29037", category: "alavancagem", display_name: "Endiv. Famílias (excl. hab.)", description: "Endividamento famílias excl. habitacional / renda disponível", unit: "%", source: "BACEN SGS 29037", last_value: 32.40, last_date: "2026-01-01", change_pct: 0.15, trend: "up" },
  { serie_code: "29038", category: "alavancagem", display_name: "Endiv. Famílias (com hab.)", description: "Endividamento famílias com habitacional / renda disponível", unit: "%", source: "BACEN SGS 29038", last_value: 48.20, last_date: "2026-01-01", change_pct: 0.20, trend: "up" },
  { serie_code: "29039", category: "alavancagem", display_name: "Comprometimento Renda", description: "Comprometimento da renda das famílias com serviço da dívida", unit: "%", source: "BACEN SGS 29039", last_value: 26.80, last_date: "2026-01-01", change_pct: -0.10, trend: "down" },
];

/* ═══ Renda Fixa (H1.3) ═══ */
export const RENDA_FIXA_SAMPLE: LatestCard[] = [
  // Taxas de referência
  { serie_code: "432", category: "taxa_ref", display_name: "Selic Meta", description: "Taxa básica de juros — meta Copom", unit: "% a.a.", source: "BACEN SGS 432", last_value: 14.25, last_date: "2026-03-19", change_pct: 0.00, trend: "stable" },
  { serie_code: "4189", category: "taxa_ref", display_name: "Selic Over (diária)", description: "Taxa Selic diária anualizada", unit: "% a.a.", source: "BACEN SGS 4189", last_value: 14.15, last_date: "2026-03-28", change_pct: 0.00, trend: "stable" },
  { serie_code: "4392", category: "taxa_ref", display_name: "CDI", description: "Taxa DI over (CETIP)", unit: "% a.a.", source: "BACEN SGS 4392", last_value: 14.15, last_date: "2026-03-28", change_pct: 0.00, trend: "stable" },
  { serie_code: "226", category: "taxa_ref", display_name: "TR", description: "Taxa Referencial mensal", unit: "%", source: "BACEN SGS 226", last_value: 0.18, last_date: "2026-03-01", change_pct: 0.02, trend: "up" },
  { serie_code: "27547", category: "taxa_ref", display_name: "TLP", description: "Taxa de Longo Prazo", unit: "% a.a.", source: "BACEN SGS 27547", last_value: 7.10, last_date: "2026-04-01", change_pct: 0.05, trend: "up" },
  { serie_code: "256", category: "taxa_ref", display_name: "TJLP", description: "Taxa de Juros de Longo Prazo", unit: "% a.a.", source: "BACEN SGS 256", last_value: 7.50, last_date: "2026-01-01", change_pct: 0.00, trend: "stable" },
  // Curva DI — Swaps Pré x DI (vértices)
  { serie_code: "7813", category: "curva_di", display_name: "DI Pré 30d", description: "Swap DI x Pré 30 dias", unit: "% a.a.", source: "BACEN SGS 7813", last_value: 14.18, last_date: "2026-03-28", change_pct: -0.02, trend: "down" },
  { serie_code: "7814", category: "curva_di", display_name: "DI Pré 60d", description: "Swap DI x Pré 60 dias", unit: "% a.a.", source: "BACEN SGS 7814", last_value: 14.32, last_date: "2026-03-28", change_pct: 0.05, trend: "up" },
  { serie_code: "7815", category: "curva_di", display_name: "DI Pré 90d", description: "Swap DI x Pré 90 dias", unit: "% a.a.", source: "BACEN SGS 7815", last_value: 14.48, last_date: "2026-03-28", change_pct: 0.08, trend: "up" },
  { serie_code: "7816", category: "curva_di", display_name: "DI Pré 180d", description: "Swap DI x Pré 180 dias", unit: "% a.a.", source: "BACEN SGS 7816", last_value: 14.65, last_date: "2026-03-28", change_pct: 0.10, trend: "up" },
  { serie_code: "7817", category: "curva_di", display_name: "DI Pré 360d", description: "Swap DI x Pré 360 dias", unit: "% a.a.", source: "BACEN SGS 7817", last_value: 14.82, last_date: "2026-03-28", change_pct: 0.12, trend: "up" },
  { serie_code: "7818", category: "curva_di", display_name: "DI Pré 720d", description: "Swap DI x Pré 720 dias", unit: "% a.a.", source: "BACEN SGS 7818", last_value: 14.55, last_date: "2026-03-28", change_pct: -0.05, trend: "down" },
  { serie_code: "7819", category: "curva_di", display_name: "DI Pré 1080d", description: "Swap DI x Pré 1080 dias", unit: "% a.a.", source: "BACEN SGS 7819", last_value: 14.20, last_date: "2026-03-28", change_pct: -0.10, trend: "down" },
  { serie_code: "7820", category: "curva_di", display_name: "DI Pré 1440d", description: "Swap DI x Pré 1440 dias", unit: "% a.a.", source: "BACEN SGS 7820", last_value: 13.90, last_date: "2026-03-28", change_pct: -0.15, trend: "down" },
  { serie_code: "7821", category: "curva_di", display_name: "DI Pré 1800d", description: "Swap DI x Pré 1800 dias", unit: "% a.a.", source: "BACEN SGS 7821", last_value: 13.65, last_date: "2026-03-28", change_pct: -0.20, trend: "down" },
  // NTN-B (IPCA+) implícita
  { serie_code: "12460", category: "ntnb", display_name: "NTNB 2029 (IPCA+)", description: "Taxa indicativa NTN-B 2029", unit: "% a.a.", source: "ANBIMA", last_value: 7.25, last_date: "2026-03-28", change_pct: 0.08, trend: "up" },
  { serie_code: "12461", category: "ntnb", display_name: "NTNB 2035 (IPCA+)", description: "Taxa indicativa NTN-B 2035", unit: "% a.a.", source: "ANBIMA", last_value: 7.10, last_date: "2026-03-28", change_pct: 0.05, trend: "up" },
  { serie_code: "12462", category: "ntnb", display_name: "NTNB 2045 (IPCA+)", description: "Taxa indicativa NTN-B 2045", unit: "% a.a.", source: "ANBIMA", last_value: 6.85, last_date: "2026-03-28", change_pct: 0.03, trend: "up" },
  { serie_code: "12463", category: "ntnb", display_name: "NTNB 2055 (IPCA+)", description: "Taxa indicativa NTN-B 2055", unit: "% a.a.", source: "ANBIMA", last_value: 6.70, last_date: "2026-03-28", change_pct: 0.02, trend: "up" },
  // Inflação implícita (breakeven)
  { serie_code: "990101", category: "breakeven", display_name: "Inflação Implícita 1a", description: "Breakeven inflation 1 ano (Pré − NTN-B)", unit: "%", source: "Calculado", last_value: 5.82, last_date: "2026-03-28", change_pct: 0.10, trend: "up" },
  { serie_code: "990102", category: "breakeven", display_name: "Inflação Implícita 3a", description: "Breakeven inflation 3 anos", unit: "%", source: "Calculado", last_value: 5.35, last_date: "2026-03-28", change_pct: 0.05, trend: "up" },
  { serie_code: "990103", category: "breakeven", display_name: "Inflação Implícita 5a", description: "Breakeven inflation 5 anos", unit: "%", source: "Calculado", last_value: 5.10, last_date: "2026-03-28", change_pct: -0.02, trend: "down" },
  // Poupança
  { serie_code: "195", category: "poupanca", display_name: "Poupança (nova regra)", description: "Rendimento poupança (70% Selic)", unit: "% a.a.", source: "BACEN SGS 195", last_value: 7.45, last_date: "2026-03-01", change_pct: 0.00, trend: "stable" },
  // Tesouro Direto — estoque e operações
  { serie_code: "990201", category: "tesouro", display_name: "Estoque TD", description: "Estoque Tesouro Direto total", unit: "R$ bi", source: "Tesouro Nacional", last_value: 142.50, last_date: "2026-02-01", change_pct: 1.20, trend: "up" },
  { serie_code: "990202", category: "tesouro", display_name: "Vendas Líquidas TD", description: "Vendas líquidas Tesouro Direto mensal", unit: "R$ bi", source: "Tesouro Nacional", last_value: 3.85, last_date: "2026-02-01", change_pct: -5.20, trend: "down" },
  { serie_code: "990203", category: "tesouro", display_name: "Investidores Ativos TD", description: "Número de investidores ativos TD", unit: "mi", source: "Tesouro Nacional", last_value: 2.85, last_date: "2026-02-01", change_pct: 0.80, trend: "up" },
  // Crédito Privado — spreads
  { serie_code: "990301", category: "credpriv", display_name: "Spread DI AA", description: "Spread médio debêntures AA sobre CDI", unit: "p.p.", source: "ANBIMA", last_value: 1.35, last_date: "2026-03-28", change_pct: -0.05, trend: "down" },
  { serie_code: "990302", category: "credpriv", display_name: "Spread DI A", description: "Spread médio debêntures A sobre CDI", unit: "p.p.", source: "ANBIMA", last_value: 2.10, last_date: "2026-03-28", change_pct: 0.08, trend: "up" },
  { serie_code: "990303", category: "credpriv", display_name: "Emissões Debêntures", description: "Volume emissões debêntures mensal", unit: "R$ bi", source: "ANBIMA", last_value: 28.40, last_date: "2026-02-01", change_pct: 3.50, trend: "up" },
  { serie_code: "990304", category: "credpriv", display_name: "CRA + CRI Estoque", description: "Estoque CRA + CRI (securitizados)", unit: "R$ bi", source: "ANBIMA", last_value: 410.20, last_date: "2026-02-01", change_pct: 1.80, trend: "up" },
];

// Sample series data for charts (fallback)
export function generateSampleSeries(baseValue: number, points: number = 24, volatility: number = 0.02): SeriesDataPoint[] {
  const data: SeriesDataPoint[] = [];
  let value = baseValue;
  const now = new Date();
  for (let i = points; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    value += value * (Math.random() - 0.48) * volatility;
    data.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(value * 100) / 100,
    });
  }
  return data;
}
