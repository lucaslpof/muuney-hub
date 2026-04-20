# T6 — Dashboard Hero Component Spec (HubDashboardHero)

**Objetivo:** substituir landing atual do `/dashboard` (Hub) por um Hero consolidado que responde "o que mudou desde minha última visita?" + "para onde vou agora?". Orientado para AAI no início do dia.
**Localização:** componente novo `src/components/hub/HubDashboardHero.tsx` consumido por `src/pages/HubDashboard.tsx`.
**Princípio de UX:** 5 segundos para o usuário entender estado do mercado + 2 cliques para entrar no insight relevante.

---

## 1. TL;DR (Rule of 3)

- **Acima da dobra:** 4 KPIs macro (Selic + IPCA + DI 1y + DXY) + 1 mini-chart hero (Selic 1y) + 3 insights críticos do dia.
- **Abaixo da dobra:** atalhos para 8 módulos + últimas 5 lâminas que o usuário acessou (localStorage).
- **Tier-aware:** Free vê preview blurred, Pro vê insights detalhados com link, Admin vê tudo + métricas internas.

---

## 2. Wireframe ASCII

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Bom dia, Lucas. Hoje é dom 19/Abr/2026.                            [↻] │
│ Última atualização Macro: hoje 06:30 | CDA: 08/Abr | FIDC: 08/Abr      │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                        │
│ │ SELIC   │ │ IPCA 12m│ │ DI 1y   │ │ USDBRL  │   ┌─────────────────┐  │
│ │ 14.75%  │ │  4.21%  │ │ 13.45%  │ │  5.18   │   │  Mini chart     │  │
│ │ ↓ -25bps│ │ ↑ +0.12 │ │ ↓ -8bps │ │ ↓ -0.02 │   │  Selic 12m      │  │
│ │ COPOM   │ │ vs prev │ │ swap pré│ │ PTAX    │   │  (sparkline)    │  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘   └─────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│ 🎯 Sinais do dia (3 insights críticos)                          ver +  │
│                                                                         │
│ [⚠️ FIDC]  PL Drop > 5%: FIDC Capitânia Crédito Estruturado            │
│ [📈 FII]   Top performer Mar/26: KNCR11 +2.3% rentab                   │
│ [💸 Macro] Focus: revisão Selic 2026 ↑ +25bps pra 13.50%               │
├─────────────────────────────────────────────────────────────────────────┤
│ Continuar de onde parou                                                 │
│ [Lâmina KNCR11]  [Comparador 3 fundos]  [/hub/macro?section=focus]    │
├─────────────────────────────────────────────────────────────────────────┤
│ Módulos                                                                 │
│ [Macro] [Crédito] [Renda Fixa] [Fundos] [FIDC] [FII] [Ofertas] [...]  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Mobile (< 768px):**
- 4 KPIs viram 2x2 grid
- Mini-chart vai pra baixo dos KPIs
- Sinais do dia full-width
- Atalhos: scroll horizontal

---

## 3. TypeScript: Props + Interfaces

```ts
// src/components/hub/HubDashboardHero.tsx

import { useMemo } from "react";
import { useHubLatest, useHubSeriesBundle, useMonetaryEvents } from "@/hooks/useHubData";
import { useInsightsFeed } from "@/hooks/useHubFundos";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

export interface HubDashboardHeroProps {
  /** Título saudação (default: "Bom dia"/"Boa tarde"/"Boa noite" auto) */
  greeting?: string;
  /** Limita insights mostrados (default: 3) */
  maxInsights?: number;
  /** Mostra módulos grid (default: true) */
  showModuleGrid?: boolean;
}

interface DashboardKPI {
  label: string;
  value: string;
  delta?: { value: number; unit: string; direction: "up" | "down" | "flat" };
  ref: { date: string; source: string };
  link: string;
  tooltip?: string;
}

interface DashboardInsight {
  id: string;
  type: "fidc" | "fii" | "macro" | "ofertas" | "credito";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  href: string;
  detected_at: string;
}

interface RecentItem {
  label: string;
  href: string;
  type: "lamina" | "comparador" | "section" | "screener";
  visited_at: string;
}
```

---

## 4. Estrutura do componente

### 4.1 Greeting Bar (header)

```tsx
function GreetingBar({ greeting, lastUpdate }: { greeting: string; lastUpdate: string }) {
  const date = new Date().toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <header className="flex flex-col gap-1 border-b border-zinc-800 pb-4 md:flex-row md:items-baseline md:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100 md:text-2xl">
          {greeting}, {firstName}.
        </h1>
        <p className="text-xs text-zinc-500">Hoje é {date}.</p>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span>Última atualização: {lastUpdate}</span>
        <button onClick={refetchAll} className="text-emerald-500 hover:text-emerald-400">
          ↻ atualizar
        </button>
      </div>
    </header>
  );
}
```

### 4.2 KPI Grid (4 cards + 1 mini-chart)

```tsx
function KPIGrid({ kpis, miniChartData }: { kpis: DashboardKPI[]; miniChartData: Point[] }) {
  return (
    <section className="grid gap-3 md:grid-cols-5">
      <div className="grid grid-cols-2 gap-3 md:col-span-3 md:grid-cols-4">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} kpi={kpi} />
        ))}
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-950 p-3 md:col-span-2">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            Selic — últimos 12 meses
          </h3>
          <span className="text-[9px] text-zinc-500">{miniChartData.length} pontos</span>
        </div>
        <Sparkline data={miniChartData} color="#10B981" height={80} />
      </div>
    </section>
  );
}

function KPICard({ kpi }: { kpi: DashboardKPI }) {
  return (
    <button
      onClick={() => navigate(kpi.link)}
      className="rounded border border-zinc-800 bg-zinc-950 p-3 text-left transition hover:border-emerald-700"
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {kpi.label}
      </div>
      <div className="mt-1 text-lg font-semibold text-zinc-100">{kpi.value}</div>
      {kpi.delta && (
        <div
          className={`mt-1 text-[10px] ${
            kpi.delta.direction === "up"
              ? "text-emerald-500"
              : kpi.delta.direction === "down"
              ? "text-red-400"
              : "text-zinc-500"
          }`}
        >
          {kpi.delta.direction === "up" ? "↑" : kpi.delta.direction === "down" ? "↓" : "→"}{" "}
          {kpi.delta.value > 0 ? "+" : ""}
          {kpi.delta.value.toFixed(2)}{kpi.delta.unit}
        </div>
      )}
      <div className="mt-1 text-[9px] text-zinc-600">{kpi.ref.source}</div>
    </button>
  );
}
```

### 4.3 Insights Section (3 críticos)

```tsx
function InsightsSection({ insights, tier }: { insights: DashboardInsight[]; tier: string }) {
  const isFree = tier === "free";

  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
          🎯 Sinais do dia
        </h2>
        <Link to="/fundos?section=insights" className="text-[10px] text-emerald-500 hover:text-emerald-400">
          ver todos →
        </Link>
      </div>
      <div className="flex flex-col gap-2">
        {insights.slice(0, 3).map((insight, idx) => (
          <InsightRow
            key={insight.id}
            insight={insight}
            blurred={isFree && idx > 0}    // Free vê 1, blur 2
          />
        ))}
        {isFree && (
          <Link
            to="/upgrade"
            className="mt-2 rounded border border-emerald-700 bg-emerald-950/30 px-3 py-2 text-center text-[10px] text-emerald-400 hover:bg-emerald-950/50"
          >
            Desbloqueie todos os sinais com Pro →
          </Link>
        )}
      </div>
    </section>
  );
}

function InsightRow({ insight, blurred }: { insight: DashboardInsight; blurred: boolean }) {
  const severityColor = {
    info: "border-zinc-700 bg-zinc-900/50",
    warning: "border-amber-700/50 bg-amber-950/20",
    critical: "border-red-700/50 bg-red-950/20",
  }[insight.severity];

  const typeBadge = {
    fidc: { label: "FIDC", color: "bg-orange-700/30 text-orange-300" },
    fii: { label: "FII", color: "bg-pink-700/30 text-pink-300" },
    macro: { label: "Macro", color: "bg-blue-700/30 text-blue-300" },
    ofertas: { label: "Ofertas", color: "bg-amber-700/30 text-amber-300" },
    credito: { label: "Crédito", color: "bg-violet-700/30 text-violet-300" },
  }[insight.type];

  return (
    <Link
      to={blurred ? "/upgrade" : insight.href}
      className={`flex items-start gap-3 rounded border ${severityColor} px-3 py-2 transition hover:border-emerald-700 ${
        blurred ? "blur-sm pointer-events-auto" : ""
      }`}
    >
      <span
        className={`shrink-0 rounded px-2 py-0.5 text-[9px] font-medium uppercase ${typeBadge.color}`}
      >
        {typeBadge.label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-medium text-zinc-200">{insight.title}</div>
        <div className="truncate text-[10px] text-zinc-500">{insight.detail}</div>
      </div>
      <span className="shrink-0 text-[9px] text-zinc-600">
        {formatRelative(insight.detected_at)}
      </span>
    </Link>
  );
}
```

### 4.4 Continue Where You Left Off

```tsx
function RecentItemsSection({ items }: { items: RecentItem[] }) {
  if (items.length === 0) {
    return (
      <section className="rounded border border-dashed border-zinc-800 bg-zinc-950/50 p-4 text-center">
        <p className="text-xs text-zinc-500">
          Comece explorando o <Link to="/hub/macro" className="text-emerald-500 hover:underline">módulo Macro</Link> ou
          buscando um fundo.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded border border-zinc-800 bg-zinc-950 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        Continuar de onde parou
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] text-zinc-300 hover:border-emerald-700 hover:text-emerald-400"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

### 4.5 Module Grid

```tsx
const MODULES = [
  { key: "macro", label: "Macro", href: "/hub/macro", icon: "📊", tier: "free" },
  { key: "credito", label: "Crédito", href: "/hub/credito", icon: "💳", tier: "free" },
  { key: "renda-fixa", label: "Renda Fixa", href: "/hub/renda-fixa", icon: "📈", tier: "free" },
  { key: "fundos", label: "Fundos", href: "/fundos", icon: "🗂️", tier: "free" },
  { key: "fidc", label: "FIDC", href: "/fundos/fidc", icon: "🏦", tier: "pro" },
  { key: "fii", label: "FII", href: "/fundos/fii", icon: "🏢", tier: "pro" },
  { key: "ofertas", label: "Ofertas Públicas", href: "/ofertas", icon: "📜", tier: "pro" },
  { key: "portfolio", label: "Portfolio", href: "/portfolio", icon: "💼", tier: "pro" },
];

function ModuleGrid({ tier }: { tier: string }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        Módulos
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
        {MODULES.map((m) => {
          const locked = m.tier === "pro" && tier === "free";
          return (
            <Link
              key={m.key}
              to={locked ? "/upgrade" : m.href}
              className={`flex flex-col items-center gap-1 rounded border p-3 transition ${
                locked
                  ? "border-zinc-800 bg-zinc-950/50 opacity-60 hover:border-emerald-700"
                  : "border-zinc-800 bg-zinc-950 hover:border-emerald-700"
              }`}
            >
              <span className="text-2xl">{m.icon}</span>
              <span className="text-[10px] text-zinc-300">{m.label}</span>
              {locked && <span className="text-[9px] text-emerald-500">PRO</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

---

## 5. Data fetching: hooks + queries

### 5.1 KPIs (dados Macro)

Reutilizar `useHubLatest` ou criar shortcut:

```ts
// src/hooks/useDashboardKPIs.ts
export function useDashboardKPIs() {
  const selic = useHubSeries("BCB-432-Selic-Meta", "12M", "macro");        // série meta SELIC
  const ipca = useHubSeries("BCB-13522-IPCA-12M", "12M", "macro");
  const di1y = useHubSeries("ANBIMA-DI-1Y", "1M", "macro");                 // ou fallback BCB
  const usdbrl = useHubSeries("BCB-1-PTAX", "1M", "macro");

  return useMemo(() => {
    return [
      buildKPI("SELIC", selic.data, "%", "/hub/renda-fixa?section=taxas"),
      buildKPI("IPCA 12m", ipca.data, "%", "/hub/macro?section=inflacao"),
      buildKPI("DI 1y", di1y.data, "%", "/hub/renda-fixa?section=curva"),
      buildKPI("USDBRL", usdbrl.data, "", "/hub/macro?section=externo"),
    ];
  }, [selic.data, ipca.data, di1y.data, usdbrl.data]);
}

function buildKPI(label: string, data: Point[] | undefined, unit: string, link: string): DashboardKPI {
  if (!data || data.length === 0) {
    return { label, value: "—", ref: { date: "—", source: "Sem dados" }, link };
  }
  const latest = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = prev ? latest.value - prev.value : 0;
  return {
    label,
    value: `${latest.value.toFixed(2)}${unit}`,
    delta: delta !== 0 ? {
      value: delta,
      unit: unit === "%" ? "bps" : "",
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
    } : undefined,
    ref: { date: latest.date, source: "BACEN SGS" },
    link,
  };
}
```

### 5.2 Insights (dados Fundos)

Reutilizar `useInsightsFeed`:

```ts
const { data: insights } = useInsightsFeed({ severity: ["critical", "warning"], limit: 10 });

const dashboardInsights: DashboardInsight[] = useMemo(() => {
  return (insights ?? []).slice(0, 3).map(i => ({
    id: i.id,
    type: i.classe_rcvm175?.toLowerCase().includes("fidc") ? "fidc" :
          i.classe_rcvm175?.toLowerCase().includes("fii") ? "fii" : "macro",
    severity: i.severidade as "info" | "warning" | "critical",
    title: i.titulo,
    detail: i.detalhe,
    href: i.slug ? `/fundos/${i.slug}` : `/fundos?insight=${i.id}`,
    detected_at: i.detectado_em,
  }));
}, [insights]);
```

### 5.3 Recent Items (localStorage)

```ts
// src/hooks/useRecentItems.ts
const STORAGE_KEY = "muuney_hub_recent_items";
const MAX_ITEMS = 10;

export function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  return items;
}

export function trackVisit(item: Omit<RecentItem, "visited_at">) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const existing: RecentItem[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(e => e.href !== item.href);
    const updated = [{ ...item, visited_at: new Date().toISOString() }, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}
```

Chamado em `useEffect` dentro de `FundLamina`, `FidcLamina`, `FiiLamina`, `OfertasRadar`, `ComparadorSection` para capturar visitas.

---

## 6. Composição final do componente

```tsx
export function HubDashboardHero({
  greeting,
  maxInsights = 3,
  showModuleGrid = true,
}: HubDashboardHeroProps) {
  const { user, tier } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.email?.split("@")[0]?.split(".")[0] ?? "investidor";
  const autoGreeting = greeting ?? getGreetingByHour();

  const kpis = useDashboardKPIs();
  const { data: rawInsights, isLoading: loadingInsights } = useInsightsFeed({
    severity: ["critical", "warning"],
    limit: 10,
  });
  const insights = useMemo(() => mapInsights(rawInsights), [rawInsights]);
  const recentItems = useRecentItems();
  const selic12m = useHubSeries("BCB-432-Selic-Meta", "12M", "macro");

  const lastUpdate = useMemo(() => formatLastUpdate(kpis), [kpis]);

  return (
    <div className="flex flex-col gap-6">
      <GreetingBar greeting={`${autoGreeting}, ${firstName}`} lastUpdate={lastUpdate} />
      <KPIGrid kpis={kpis} miniChartData={selic12m.data ?? []} />
      {loadingInsights ? (
        <SkeletonInsights />
      ) : insights.length > 0 ? (
        <InsightsSection insights={insights.slice(0, maxInsights)} tier={tier} />
      ) : (
        <EmptyInsights />
      )}
      <RecentItemsSection items={recentItems} />
      {showModuleGrid && <ModuleGrid tier={tier} />}
      {tier === "admin" && <AdminPanel />}    {/* opcional: bloco interno */}
    </div>
  );
}

function getGreetingByHour() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
```

---

## 7. Sparkline mini-chart (componente leve)

Criar `src/components/hub/Sparkline.tsx` (sem Recharts, SVG puro — bundle <2 KB):

```tsx
interface SparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = "#10B981", height = 60, width = 200 }: SparklineProps) {
  if (data.length < 2) {
    return <div className="text-[10px] text-zinc-500">Sem dados</div>;
  }
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = height - ((d.value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      <circle
        cx={width}
        cy={height - ((values[values.length - 1] - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  );
}
```

---

## 8. Integração no `HubDashboard.tsx`

```tsx
// src/pages/HubDashboard.tsx (rewrite)
import { lazy, Suspense } from "react";
import { HubDashboardHero } from "@/components/hub/HubDashboardHero";
import { SkeletonPage } from "@/components/hub/SkeletonLoader";

export default function HubDashboard() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <div className="w-full px-4 py-6 md:px-8 md:py-8">
        <HubDashboardHero />
      </div>
    </Suspense>
  );
}
```

Rota já existente: `/dashboard` dentro de `<ProtectedRoute><HubLayout>`.

---

## 9. Estados (loading / empty / error)

| Estado | UX |
|---|---|
| Loading KPIs | SkeletonKPI x4 + SkeletonChart no slot do mini-chart |
| Loading insights | SkeletonInsights (3 rows shimmer) |
| Sem insights | "Nenhum sinal crítico hoje. Mercado calmo." + link `/fundos?section=insights` |
| Sem recent items (primeira visita) | CTA: "Comece explorando o módulo Macro ou buscando um fundo." |
| Erro KPI individual | Card mostra "—" + tooltip "Sem dados disponíveis. Tente atualizar." |
| Erro Insights global | EmptyState variant="section-error" + retry |
| Tier=Free | InsightRow blurred (apenas o 1º visível) + InlinePaywall CTA |

---

## 10. Tier-aware behavior

| Bloco | Free | Pro | Admin |
|---|---|---|---|
| Greeting | "Bom dia, investidor" | "Bom dia, lucas" | "Bom dia, Lucas (admin)" |
| KPIs | Visíveis | Visíveis | Visíveis |
| Mini-chart | Visível | Visível | Visível |
| Insights | 1 visível + 2 blurred + CTA Upgrade | 3 visíveis + link "ver todos" | 3 + link interno admin |
| Recent items | localStorage | localStorage | localStorage |
| Module grid | FIDC/FII/Ofertas/Portfolio com badge PRO + redirect /upgrade | Tudo desbloqueado | Tudo + acesso direto |
| Admin Panel | Não renderiza | Não renderiza | Bloco extra: total users, tiers split, últimas ingestões |

---

## 11. Performance

- **Lazy load:** Hero é eager (entry point), mas Sparkline é puro SVG (sem Recharts).
- **React Query staleTime:** KPIs 5 min (mercado em movimento), Insights 10 min, mini-chart 30 min.
- **Bundle target:** <12 KB gzipped (HubDashboardHero + Sparkline + helpers).
- **CLS prevention:** SkeletonKPI tem mesma altura que KPICard real (~88px).

---

## 12. Acessibilidade

- Cada KPICard com `role="button"` + `aria-label="${label}: ${value}, variação ${delta}"`.
- InsightRow é `<Link>` com texto descritivo (não só ícone).
- Mini-chart Sparkline tem `<title>` SVG com `Selic últimos 12 meses, valor atual ${latest}%`.
- Module grid: cada link tem `aria-label="Acessar módulo ${label}"` + `aria-disabled` quando locked.
- Contraste WCAG AA: zinc-100/zinc-200 sobre #0a0a0a passa AAA.

---

## 13. Mobile responsiveness

| Breakpoint | Layout |
|---|---|
| <640px | KPIs 2x2, mini-chart abaixo, insights full-width, módulos scroll horizontal |
| 640-768px | KPIs 4x1, mini-chart abaixo, módulos 4x2 |
| 768-1024px | KPIs 4x1 + mini-chart ao lado (5 cols total), módulos 8x1 |
| >1024px | Mesmo do md, com mais padding |

---

## 14. Telemetria recomendada

- Track click em cada KPI (analytics event: `dashboard_kpi_click` { kpi_label })
- Track click em insight (`dashboard_insight_click` { type, severity })
- Track click em recent item (`dashboard_recent_click` { type })
- Track click em module locked (`dashboard_upgrade_intent` { from_module })

Pode usar GA4 já configurado (G-FW3X3NEWRP) via `gtag("event", ...)` ou esperar Sentry breadcrumbs.

---

## 15. Definition of done

- [ ] `HubDashboardHero.tsx` criado e renderiza sem erros
- [ ] `useDashboardKPIs.ts` retorna 4 KPIs corretos com latest BACEN data
- [ ] `Sparkline.tsx` criado e renderiza Selic 12m
- [ ] `useRecentItems.ts` + `trackVisit` integrado em 5 superfícies (FundLamina, FidcLamina, FiiLamina, ComparadorSection, OfertasRadar)
- [ ] InsightsSection consome `useInsightsFeed` e mostra top 3 críticos
- [ ] Tier gating funciona: Free vê 1 + 2 blurred, Pro vê 3
- [ ] Module grid com badges PRO + redirect /upgrade
- [ ] Mobile breakpoints validados em 375px / 768px / 1024px
- [ ] Skeleton states OK
- [ ] Empty states OK (primeira visita)
- [ ] HubDashboard.tsx atualizado para usar novo Hero
- [ ] Build limpo (tsc 0 erros, vite build <5s)
- [ ] Smoke test manual: 5 cliques que validam KPI link, insight link, recent item, module unlock, upgrade CTA

---

## 16. Perguntas pendentes pro Lucas

1. **Códigos exatos das séries BACEN:** preciso confirmar `BCB-432-Selic-Meta` (ou é outro código?), DI 1y (BACEN tem ou só ANBIMA?). Posso pegar do `hub_macro_series_meta` table direto ao implementar.
2. **Quer um 5º KPI?** (Ex: variação Ibovespa intraday, total fundos no catálogo, total insights detectados na semana). Recomendação: Ibovespa intraday se conseguir API B3 free, senão deixar só os 4.
3. **Saudação personalizada:** posso usar primeiro nome do email (`lucas.lpof` → "lucas") ou prefere consultar `profiles.full_name`? Recomendação: usar full_name se existir, fallback email parsing.
4. **Admin Panel inline:** quer que admin veja métricas internas (total users by tier, ingestões status, edge functions errors hoje)? Pode ser um collapse expandable. Recomendação: implementar em sprint pós-launch (foco no que beta vê primeiro).
