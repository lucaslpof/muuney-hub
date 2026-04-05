# Auditoria Módulo Macro (H1.1a) — Muuney.hub

**Data:** 04/04/2026 | **Benchmark:** Bloomberg Terminal | **Escopo:** Auditoria completa (código + endpoints + UX/UI + analytics)

---

## 1. PROBLEMAS CRÍTICOS DE DADOS (P0 — Bloqueia valor do produto)

### 1.1 Dados falsos em produção
O `HubMacro.tsx` usa `generateSampleSeries()` como fallback quando a API retorna vazio, **sem qualquer indicação visual de que são dados sintéticos**. O usuário não sabe se está vendo dados reais ou fake.

Pior: múltiplos gráficos derivam séries falsas de outras séries via multiplicação:
- `monetaria.map(d => ({...d, value: d.value * 7.4}))` → "M2" (fake)
- `monetaria.map(d => ({...d, value: d.value * 14.2}))` → "M4" (fake)
- `trabalho.map(d => ({...d, value: d.value * 56000}))` → "Massa Salarial" (fake derivação)
- `trabalho.map(d => ({...d, value: d.value * 420}))` → "Rendimento Médio" (fake)
- `externo.map(d => ({...d, value: d.value * 19.2}))` → "IDP" (fake)
- `fiscal.map(d => ({...d, value: d.value * -4.2}))` → "NFSP" (fake)
- `focus.map(d => ({...d, value: d.value * 2.9}))` → "Selic Focus" (fake)
- `focus.map(d => ({...d, value: d.value * 0.43}))` → "PIB Focus" (fake)
- **CAGED usa `Math.random()`** — literalmente dados aleatórios

**Impacto:** ~50% dos gráficos mostram dados fabricados. Isso invalida toda a proposta de valor do módulo.

**Fix:** Cada gráfico deve usar sua própria série SGS real. As séries já existem no `hub_macro_series_meta` (73 cadastradas). O hook `useHubSeries` aceita `category`, mas o frontend agrupa múltiplas séries diferentes sob a mesma categoria e depois as multiplica para "simular" séries individuais.

### 1.2 Dados com valores absurdos na API
Testes end-to-end revelaram:
- **PIB Variação Trimestral:** `12,851,742.8%` — claramente o valor absoluto em R$ milhões está sendo retornado como variação %
- **Desocupação PNAD (24383):** `3,305%` — aparenta ser número absoluto de desocupados (milhares), não taxa %
- **Saldo CAGED (28763):** `48,837,602` — é o saldo acumulado (estoque), não o saldo mensal
- **PEA (24368):** sem dados — retorna null

**Fix:** Revisar o mapeamento `name`/`unit` em `hub_macro_series_meta` para as séries problemáticas. Para PIB, usar o code `4382` (variação %) separadamente do `4380` (nível).

### 1.3 Focus: dados cortam em Dezembro 2025
A série Focus retorna dados apenas até 01/12/2025, apesar de estarmos em Abril 2026. Provável issue na query da Edge Function (filtro de data incorreto ou formato OData truncado).

---

## 2. PROBLEMAS DE ARQUITETURA (P1 — Performance e manutenibilidade)

### 2.1 Todas as séries carregam simultaneamente
O componente dispara **14 queries `useHubSeries`** no mount, independentemente da tab ativa. Com 9 tabs, o usuário tipicamente só precisa dos dados de 1-2 tabs.

**Fix:** Lazy-load por tab. Mover as queries para dentro dos blocos condicionais `{show([...]) && ...}` ou usar `enabled: activeTab === "xxx"` no hook.

### 2.2 Hook `useHubSeries` retorna apenas a PRIMEIRA série
```typescript
function mapSeriesResponse(apiData): SeriesDataPoint[] {
  const series = response?.series || [];
  if (series.length === 0) return [];
  return series[0].data || [];  // ← só retorna a primeira!
}
```
O endpoint `series?category=trabalho` retorna **9 séries**, mas o hook descarta 8 delas. Isso explica por que o frontend fabrica dados — ele nunca recebe as séries individuais.

**Fix:** Retornar todas as séries como `Record<string, SeriesDataPoint[]>` indexado por `serie_code`. Ajustar o frontend para consumir séries individuais.

### 2.3 Sem error boundaries
Uma query falha = crash da página inteira. Nenhum `ErrorBoundary` React ou `onError` handler nos hooks.

### 2.4 sparklineMap hardcoded
O mapeamento `sparklineMap` (linhas 95-133) usa série genérica para vários indicadores. Indicadores diferentes mostram o mesmo sparkline shape.

---

## 3. UX/UI — NAVEGAÇÃO E LAYOUT (P1)

### 3.1 Tab overflow sem affordance
9 tabs horizontais em scroll sem indicador de que há mais tabs à direita. Em mobile, tabs ficam cortadas.

**Fix Bloomberg-style:** Agrupar em 3 seções (Economia Real / Política Monetária & Fiscal / Mercado & Expectativas), ou usar dropdown para subcategorias.

### 3.2 Sem deep-linking
Estado de tab e período perdem-se no refresh. URL não reflete `?tab=inflacao&period=2y`.

**Fix:** `useSearchParams()` do react-router para persistir tab + period na URL.

### 3.3 33 KPI cards em grid de 6 colunas
Na Visão Geral, 33 cards = 6 rows de cards antes de qualquer gráfico. Excessivo, mesmo para Bloomberg density.

**Fix:** Top-6 KPIs no overview, com "Ver todos" expansível. Ou: KPI ticker horizontal (scrolling tape, Bloomberg-style).

### 3.4 Period selector afeta todos os gráficos igualmente
PIB trimestral em "3m" mostra 1-2 pontos. Focus semanal em "5y" mostra 260 pontos comprimidos.

**Fix:** Period selector como default, mas permitir override por gráfico individual (range picker no chart header).

### 3.5 Calculadoras "escondidas"
InflationCalculator, YieldCurveSimulator, FiscalCalculator só aparecem ao clicar na tab específica. Não são discoverable.

**Fix:** Seção "Ferramentas" na sidebar ou cards de acesso rápido no Overview.

### 3.6 Sticky header ocupa muito espaço vertical
Header sticky (título + periods + 9 tabs) ocupa ~100px de viewport. Em laptop 13", resta pouco para conteúdo.

**Fix:** Compactar: tabs inline com period selector, ou collapse on scroll.

---

## 4. FERRAMENTAS INTERATIVAS (P2 — Polimento)

### 4.1 InflationCalculator
- **Bom:** cálculo acumulado correto, UX clara
- **Melhorar:** Adicionar INPC e IGP-M como opção de índice. Gráfico de evolução do poder de compra ao longo do tempo (não só resultado final). Preset buttons ("Último ano", "Desde 2020").

### 4.2 YieldCurveSimulator
- **Bom:** visual limpo, slider intuitivo
- **Melhorar:** Os tenors são hardcoded com offsets genéricos (`base: currentSelic - 0.15`). Deveria usar vértices reais DI×Pré do módulo Renda Fixa. Adicionar cenários nomeados (Hawkish / Dovish / Neutro). Shape analysis text (Normal / Invertida / Flat).

### 4.3 FiscalCalculator
- **Bom:** equação de Domar correta, visual com referência de 80%
- **Melhorar:** Cenários comparativos (base / otimista / pessimista) no mesmo gráfico. Tabela de sensibilidade (heatmap r×g). Input validation (juro real não pode ser negativo sem disclaimer).

### 4.4 CorrelationPanel
- **Bom:** heatmap com color coding funcional
- **Melhorar:** Usa dados potencialmente fake (ver item 1.1). Adicionar lag-correlation (correlação com defasagem). Click em célula → scatter plot dos dois indicadores. Tooltip com p-value e n observações.

### 4.5 FocusConsensusPanel
- **Bom:** estrutura Real vs Esperado clara
- **Melhorar:** `prevExpected` é hardcoded no HubMacro.tsx (linhas 612-633), não vem da API. Adicionar chart temporal (evolução das expectativas ao longo das semanas). Surpresa Index (|actual - expected| / std).

---

## 5. ANALYTICS / INSIGHTS (P2 — Agregação de valor)

### 5.1 Insights são strings semi-estáticas
Os 4 insights cross-module (linhas 754-783) são templates com valores dinâmicos, mas a lógica é trivial. Não há detecção de tendência, breakpoint, ou narrativa gerada.

**Melhorar:**
- Trend detection automático (últimos 3 meses subindo/descendo/estável) para cada indicador
- Anomaly detection (z-score > 2 em relação à média 12m)
- Narrativa macro gerada: "Com Selic a X% e IPCA a Y%, o juro real está em Z%, acima da média histórica de W%"
- Cross-module signals: "Desemprego em mínima + inflação acima da meta → risco de superaquecimento"

### 5.2 Benchmarks vs Metas usa valores hardcoded
A meta de inflação (3.0%), target de desocupação (7.0%), etc., são hardcoded. Deveriam vir de config ou API.

### 5.3 Faltam features esperadas em Bloomberg-density
- **Macro Scorecard:** Score 0-100 da economia em painel único
- **Regime Detection:** classificar regime macro atual (expansão/pico/contração/vale)
- **Event overlay:** datas de reuniões COPOM, FOMC, Release Calendar
- **Alert history:** histórico de quando indicadores cruzaram thresholds
- **Export do módulo completo:** PDF com snapshot de todos os KPIs + charts

### 5.4 statistics.ts subutilizado
A lib tem SMA, EMA, regression, z-score — mas o frontend usa pouco:
- Só `pearsonCorrelation` no CorrelationPanel
- SMA/EMA não são oferecidos como overlay nos gráficos
- linearRegression existe mas não há forecast visual
- healthIndex só aparece no trabalhador (e com dados fake)

---

## 6. COMPONENTE MacroChart (P2 — Melhorias)

### 6.1 Pontos positivos
Zoom drag-to-select, CSV/PNG export, RichTooltip, dark theme consistente.

### 6.2 Melhorias
- **PNG export icon é ZoomIn** — confuso. Deveria ser um ícone de imagem/câmera.
- Sem toggle de overlay (SMA, EMA, regression trendline)
- Sem comparison mode (sobrepor duas séries de tabs diferentes)
- Y-axis auto-format hardcoded (`v >= 1000 ? k : toFixed(1)`) — falha para valores como 0.05% (Selic efetiva)
- X-axis interval calcula `floor(length/7)` — pode resultar em labels cortados em séries curtas

---

## 7. PRIORIZAÇÃO DE AÇÕES

| # | Ação | Severidade | Esforço | Impacto | Status |
|---|------|-----------|---------|---------|--------|
| 1 | Eliminar dados fake (usar séries reais individuais) | P0 | Alto | Crítico | ✅ DONE — Fase A: Backfill 24 séries reais (7,304 rows, 4 categorias: atividade, inflacao, monetaria, externo). Hook refatorado para `useHubSeriesBundle` + `pickSeries`. Zero dados fabricados. |
| 2 | Fix hook mapSeriesResponse → retornar todas as séries | P0 | Médio | Crítico | ✅ DONE — Fase A: `mapSeriesBundleResponse` retorna `SeriesBundle` (Record<code, {name,unit,category,data}>). HubMacro usa `pickSeries(bundle, code)` para cada indicador. |
| 3 | Corrigir mapeamento unit/name em hub_macro_series_meta | P0 | Baixo | Alto | ✅ DONE — 5 fixes: PIB Var. Trimestral (unit→%), Desocupação PNAD (name fix), Saldo CAGED (unit→vínculos), PEA desativada (sem dados), Massa Salarial Real (unit→R$ mi). |
| 4 | Fix Focus data range (truncada em Dec 2025) | P0 | Baixo | Alto | ✅ DONE — Verificado: Focus retorna dados até 2026-03-27 (500 rows/série). Issue original já estava resolvida. |
| 5 | Lazy-load queries por tab | P1 | Médio | Performance | ✅ DONE — Fase C: IntersectionObserver tracks `visitedSections`. Bundles balanca/divida/fiscal/focus/pib usam `enabled: sectionVisible(id)`. Overview (selic/ipca/cambio/trabalho) carrega eagerly. |
| 6 | Deep-linking (URL state para tab + period) | P1 | Baixo | UX | ✅ DONE — Fase C: `useSearchParams` persiste `?period=2y&section=analytics` na URL. Scroll-to-section on mount quando URL tem section param. |
| 7 | KPI overflow (ticker ou top-6 + expand) | P1 | Médio | UX | ✅ DONE — Fase B: Hero top-8 KPIs (HERO_CODES) + "Ver todos os N indicadores" expandível. Secondary KPIs em grid 6-col. |
| 8 | Error boundaries por seção | P1 | Baixo | Estabilidade | ✅ DONE — Fase C: `SectionErrorBoundary` (class component) wraps cada `MacroSection`. Error UI com retry button, Tech-Noir styling. |
| 9 | Overlay SMA/EMA/Trendline no MacroChart | P2 | Médio | Valor analítico | Pendente |
| 10 | Calculadoras: enriquecer com cenários, multi-índice | P2 | Médio | Valor | Pendente |
| 11 | Yield curve com vértices reais DI×Pré | P2 | Alto | Precisão | Pendente |
| 12 | Insights gerados dinamicamente (trend + anomaly) | P2 | Alto | Diferenciação | ✅ PARCIAL — Fase B: `MacroInsightCard` com trend detection, anomaly z-score, target band analysis. Falta narrativa macro gerada e cross-module signals. |
| 13 | Macro Scorecard / Regime Detection | P2 | Alto | Bloomberg-tier | Pendente |
| 14 | Event overlay (COPOM, FOMC) | P2 | Médio | Pro feature | Pendente |
| 15 | Export PDF do módulo completo | P2 | Alto | Enterprise | Pendente |

---

## RESUMO

O módulo tem uma **fundação visual sólida** (design system, chart component, calculadoras). Porém, **~50% dos dados exibidos são fabricados** (multiplicações arbitrárias e `Math.random`), o que é o problema #1 a resolver. O hook `mapSeriesResponse` descartando séries é a causa raiz — uma vez corrigido, todos os gráficos podem usar dados reais.

A camada analítica tem potencial mas está subutilizada: a lib `statistics.ts` é robusta, mas o frontend mal a consome. Com as correções de dados + lazy loading + overlays + insights dinâmicos, o módulo pode genuinamente competir em densidade informacional com ferramentas profissionais.

---

## CHANGELOG DE IMPLEMENTAÇÃO

### Fase A — Data Fixes (04/04/2026)
- Backfill 24 séries BACEN SGS reais (7,304 rows) em 4 novas categorias: atividade (8), inflacao (4), monetaria (5), externo (7)
- Refatoração do hook: `useHubSeriesBundle` retorna `SeriesBundle` completo, `pickSeries(bundle, code)` extrai série individual
- Edge Function `hub-macro-api` v5: adicionadas 4 categorias + categoryAliases
- Fix 5 entries em `hub_macro_series_meta` (nomes, unidades, PEA desativada)
- Eliminados 100% dos dados fabricados (multiplicações e Math.random)

### Fase B — UI Redesign (04/04/2026)
- Layout narrativo: 6 seções temáticas com sidebar nav + IntersectionObserver
- Novos componentes: `MacroSection`, `MacroSidebar`, `MacroInsightCard`
- Hero KPIs top-8 com expandable secondary grid
- `AlertCard` com detecção de outliers e tendências
- Period selector no sticky header

### Fase C — Performance & Stability (04/04/2026)
- Lazy-load: `visitedSections` Set + `enabled` param em 5 bundle hooks (pib, divida, balanca, fiscal, focus)
- Deep-linking: `useSearchParams` persiste `period` + `section` na URL, scroll-to-section on mount
- `SectionErrorBoundary` class component wrapping todas as 5 MacroSections
- TypeScript clean build (tsc --noEmit exit 0)
