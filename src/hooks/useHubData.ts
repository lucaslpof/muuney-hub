import { useQuery } from "@tanstack/react-query";

const HUB_API = "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-macro-api";

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
  data?: SeriesDataPoint[];
}

interface ApiSeriesResponse {
  series?: ApiSeriesItem[];
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
  if (!res.ok) throw new Error(`Hub API error: ${res.status}`);
  return res.json() as Promise<unknown>;
}

/* Map API "latest" response → LatestCard[] expected by frontend */
function mapLatestResponse(apiData: unknown): LatestCard[] {
  const response = apiData as ApiLatestResponse;
  const indicators = response?.indicators || [];
  return indicators.map((ind) => ({
    serie_code: String(ind.code),
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

export function useHubLatest(module: "macro" | "credito" = "macro") {
  return useQuery<LatestCard[]>({
    queryKey: ["hub", "latest", module],
    queryFn: async () => mapLatestResponse(await fetchHub("latest", { module })),
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useHubOverview(module: "macro" | "credito" = "macro") {
  return useQuery<OverviewItem[]>({
    queryKey: ["hub", "overview", module],
    queryFn: async () => mapOverviewResponse(await fetchHub("overview", { module })),
    staleTime: 30 * 60 * 1000,
    retry: 2,
  });
}

export function useHubSeries(category: string, period: string = "1y", module: "macro" | "credito" = "macro") {
  return useQuery<SeriesDataPoint[]>({
    queryKey: ["hub", "series", module, category, period],
    queryFn: async () => mapSeriesResponse(await fetchHub("series", { category, period, module })),
    staleTime: 30 * 60 * 1000,
    enabled: !!category,
    retry: 2,
  });
}

export function useHubIngestionStatus() {
  return useQuery<IngestionStatusResponse>({
    queryKey: ["hub", "ingestion_status"],
    queryFn: () => fetchHub("ingestion_status") as Promise<IngestionStatusResponse>,
    staleTime: 5 * 60 * 1000,
  });
}

// Sample data fallback for when API has no data yet
export const MACRO_SAMPLE: LatestCard[] = [
  { serie_code: "selic_meta", category: "selic", display_name: "Selic Meta", description: "Taxa básica de juros", unit: "% a.a.", source: "BACEN SGS 432", last_value: 14.25, last_date: "2026-03-19", change_pct: 0.00, trend: "stable" },
  { serie_code: "ipca_mensal", category: "ipca", display_name: "IPCA Mensal", description: "Inflação oficial", unit: "%", source: "BACEN SGS 433", last_value: 0.56, last_date: "2026-02-01", change_pct: 0.12, trend: "up" },
  { serie_code: "ipca_12m", category: "ipca", display_name: "IPCA 12m", description: "Inflação acumulada 12 meses", unit: "%", source: "BACEN SGS 13522", last_value: 5.06, last_date: "2026-02-01", change_pct: -0.20, trend: "down" },
  { serie_code: "ptax_compra", category: "cambio", display_name: "PTAX Compra", description: "Câmbio USD/BRL", unit: "R$", source: "BACEN SGS 1", last_value: 5.73, last_date: "2026-03-28", change_pct: -0.34, trend: "down" },
  { serie_code: "pib_var", category: "pib", display_name: "PIB Var. %", description: "Crescimento trimestral", unit: "%", source: "BACEN SGS 4380", last_value: 3.20, last_date: "2025-12-01", change_pct: 0.50, trend: "up" },
  { serie_code: "divida_pib", category: "divida", display_name: "Dívida/PIB", description: "Dívida líquida do setor público", unit: "%", source: "BACEN SGS 4503", last_value: 62.60, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
];

export const CREDITO_SAMPLE: LatestCard[] = [
  { serie_code: "spread_pf", category: "spread", display_name: "Spread PF", description: "Spread bancário pessoa física", unit: "p.p.", source: "BACEN SGS 20783", last_value: 30.20, last_date: "2026-01-01", change_pct: -0.50, trend: "down" },
  { serie_code: "spread_pj", category: "spread", display_name: "Spread PJ", description: "Spread bancário pessoa jurídica", unit: "p.p.", source: "BACEN SGS 20784", last_value: 10.80, last_date: "2026-01-01", change_pct: 0.20, trend: "up" },
  { serie_code: "inadimplencia_total", category: "inadimplencia", display_name: "Inadimplência Total", description: "Taxa de inadimplência", unit: "%", source: "BACEN SGS 21082", last_value: 3.30, last_date: "2026-01-01", change_pct: 0.10, trend: "up" },
  { serie_code: "inadimplencia_pf", category: "inadimplencia", display_name: "Inadimplência PF", description: "Inadimplência pessoa física", unit: "%", source: "BACEN SGS 21083", last_value: 4.10, last_date: "2026-01-01", change_pct: 0.05, trend: "up" },
  { serie_code: "taxa_pf", category: "taxas", display_name: "Taxa Média PF", description: "Taxa média empréstimos PF", unit: "% a.a.", source: "BACEN SGS 20714", last_value: 52.60, last_date: "2026-01-01", change_pct: 0.40, trend: "up" },
  { serie_code: "credito_pib", category: "credito_pib", display_name: "Crédito/PIB", description: "Relação crédito sobre PIB", unit: "%", source: "BACEN SGS 20539", last_value: 54.20, last_date: "2026-01-01", change_pct: 0.30, trend: "up" },
  { serie_code: "concessao_pf", category: "concessoes", display_name: "Concessões PF", description: "Concessões de crédito pessoa física", unit: "R$ bi", source: "BACEN SGS 20631", last_value: 254.30, last_date: "2026-01-01", change_pct: 1.20, trend: "up" },
  { serie_code: "concessao_pj", category: "concessoes", display_name: "Concessões PJ", description: "Concessões de crédito pessoa jurídica", unit: "R$ bi", source: "BACEN SGS 20632", last_value: 198.70, last_date: "2026-01-01", change_pct: -0.80, trend: "down" },
  { serie_code: "estoque_total", category: "estoque", display_name: "Estoque Total", description: "Estoque de crédito do SFN", unit: "R$ tri", source: "BACEN SGS 20539", last_value: 6.12, last_date: "2026-01-01", change_pct: 0.90, trend: "up" },
  { serie_code: "inadimplencia_pj", category: "inadimplencia", display_name: "Inadimplência PJ", description: "Inadimplência pessoa jurídica", unit: "%", source: "BACEN SGS 21084", last_value: 2.40, last_date: "2026-01-01", change_pct: -0.15, trend: "down" },
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
