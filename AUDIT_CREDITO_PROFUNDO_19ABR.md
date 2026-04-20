# Auditoria Profunda — Módulo Overview de Crédito
**muuney.hub · 19/04/2026 · pre-beta launch 30/04**

> **Status entrega (19/04/2026, noite):** P0 (8 tickets) **✅ shipped** em commit `30253fb`. P1 (7 de 8 tickets frontend-only) **✅ shipped** em commit `1628bf5`. P2 polish batch (4 shipped novos + 1 pré-shipped + 1 já endereçado + 2 diferidos) em commit `<pending>`. Build clean (tsc 0, vite 5.13s). HubCredito chunk 89 → 129 kB (+40 kB para 19 features). P1-6 (alertas dinâmicos — requer migration + admin UI), P2-5 (unit consistency sweep) e P2-8 (a11y axe-core audit) diferidos pós-beta.

## TL;DR

Auditoria end-to-end (frontend + backend + dados) do módulo `/hub/credito` encontrou **1 bug crítico de dado sintético** (CreditOperationsPanel com pesos constantes simulando modalidades) e **16 gaps P1/P2** de UX, narrativa e performance. Esta sessão entregou **todos os P0** (bug crítico + fundação de consistência com módulo Fundos), **7 de 8 P1** frontend-only e **5 dos 8 P2** (4 implementados + 1 pré-shipped) em código. P1-6 (alertas dinâmicos) + P2-5 (unit consistency sweep) + P2-8 (a11y audit) diferidos para sprint pós-beta.

Impacto do bug P0-2: quando um AAI filtrava "Veículos PF" vs "Consignado" no query builder, o panel exibia números que NÃO vinham do BACEN — eram o saldo total multiplicado por um peso fixo codificado no frontend. Risco reputacional crítico para lançamento dia 30/04.

---

## Metodologia

1. **Benchmark** contra ComDinheiro, Economatica, Morningstar, Bloomberg, Funds Explorer, Status Invest, Mais Retorno, Quantum Axis (mesmo baseline do Fundos 18/04).
2. **Gap analysis 360º** em 4 dimensões: Features, UX/UI, Narrativa/Storytelling, Performance.
3. **Investigação backend**: hub-macro-api v9 Edge Function + tabela `hub_macro_series_meta` (73 séries de crédito distribuídas em 11 categorias).
4. **Code review**: HubCredito.tsx (915 linhas) + 8 componentes filhos + 1 edge function.
5. **Priorização** impacto×esforço (P0 = bloqueia beta, P1 = alta alavancagem pós-beta, P2 = polish).

---

## P0 — Bloqueadores de Beta (entregues nesta sessão)

### P0-1 · Diagnóstico backend hub-macro-api + hub_macro_series_meta
**Status**: ✅ Concluído. Query executada, catálogo mapeado (73 séries crédito), validado contra os 58 SGS codes referenciados no frontend.

Descoberta: **29 de 58 SGS codes declarados em `CreditOperationsPanel.tsx` NÃO existem na base** ou têm `last_date=null`. Em particular:
- `saldo_pj_modal` codes 20553/20556/20560/20564: catálogo existe, BACEN não publica atualização
- Per-modality taxa codes (20742, 21095, 21101…): não existem — BACEN só publica taxa agregada por tipo+recurso

Isso explicava por que o panel recorria a pesos sintéticos.

### P0-2 · Fix CreditOperationsPanel — bug crítico pesos proporcionais
**Status**: ✅ Concluído. Full rewrite (`src/components/hub/CreditOperationsPanel.tsx`).

**Root cause**: Código antigo (linhas 446–467) tinha um objeto `weights` com multiplicadores constantes (0.35, 0.18, 0.07…) aplicados ao saldo agregado quando uma modalidade específica era filtrada. Resultado: gráficos exibiam dados que pareciam plausíveis mas eram 100% sintéticos.

**Fix arquitetural**:
- Substituído 6 chamadas `useHubSeries` por 6 chamadas `useHubSeriesBundle` (por categoria) + `pickSeries(bundle, code)` por modalidade.
- Novo tipo `SeriesRef { cat, code, aggregate? }` declarando explicitamente qual série SGS cada modalidade consome.
- 18 modalidades rebuilds usando APENAS códigos SGS reais verificados contra `hub_macro_series_meta`:
  - PF Livres: `20570` (Não Consignado), `20572` (Consignado INSS), `20581` (Veículos), `20590` (Cartão)
  - PF Direcionados: `20593` (Rural), `20599` (Habitacional), `20606` (BNDES)
  - PJ Livres: `20551` (Capital de Giro), `20561` (Cartão Rotativo)
  - PJ Direcionados: `20611` (Rural), `20614` (Habitacional), `20622` (BNDES), `20602` (Financiamento)
  - Agregados: `20541`/`20542`/`20543`/`20544`/`20540`
- Fallback explícito com flag `aggregate=true` quando taxa/inadim por modalidade não existe → UI exibe ícone ⓘ com tooltip "Taxa agregada (tipo+recurso) — BACEN SGS não publica taxa específica por modalidade".
- `normalizeToBi()` valida `meta.unit` ("R$ milhões" → /1000, "R$ bi" passthrough).
- Multi-series chart merge corrigido: `Map<date>` outer join (substituiu assunção de índices alinhados que quebrava quando séries tinham comprimentos diferentes).
- `AlertTriangle` badge em modalidades com `last_date=null`.

### P0-3 · CSV export pt-BR (separator `;` + BOM UTF-8)
**Status**: ✅ Concluído (integrado no rewrite P0-2).

Migrado para `exportCsv(rows, columns, filename)` do `@/lib/csvExport`:
- Separador `;` (nativo Excel pt-BR).
- BOM UTF-8 `\uFEFF` no início do arquivo (Excel detecta encoding correto).
- Filename via `csvFilename("credito_operacoes", tag)` para consistência com Fundos.
- 3 botões: Saldo CSV, Taxa CSV, Inad CSV, com `aria-label` e `type="button"`.

### P0-4 · DataAsOfStamp integrado em HubCredito header
**Status**: ✅ Concluído.

- `DataAsOfStamp` importado em `HubCredito.tsx`.
- `latestDate` computado via `useMemo` como max de `kpis[].last_date`.
- Badge no sticky header (compact mode, `cadence="monthly"`, `source="BACEN SGS"`).
- Staleness dot: emerald ≤45d, amber ≤90d, red >90d (cadence=monthly thresholds).
- Panel-level: `DataAsOfStamp` também integrado no header do `CreditOperationsPanel` (data = max across 6 bundles).

### P0-5 · NarrativeSection foundation — prosa + mini-stats
**Status**: ✅ Concluído (3 de 6 sections com foundation — Volume, Preço, Risco).

Pattern aplicado: prose de abertura com regime classification + 4 mini-stats com deltas MoM/YoY + tooltips. Strictly segue padrão dos Fundos batch 22/23:

- **Volume** (accent `#10B981`): Saldo SFN + YoY, Concessões PF MoM, Consignado, Crédito/PIB. Prose classifica aceleração/desaceleração do fluxo de novo crédito.
- **Preço/Taxas & Spreads** (accent `#F59E0B`): Taxa Média PF, Spread PF + MoM delta, Diferencial PF×PJ vs histórico, Selic Ref. Prose classifica ciclo monetário (restritivo/neutro/acomodatício).
- **Risco** (accent `#EF4444`): Inadim. Total + MoM, Inadim. Livres, Delta PF×PJ, Regime (Saudável/Neutro/Alerta/Stress). Prose narra estado do stress cíclico.

Sections Visão Geral, Operações, Analytics podem receber NarrativeSection em sprint seguinte — foundation está provado e as 3 sections entregues cobrem os insights de maior leitura do AAI.

Helpers centralizados no topo do componente: `lastVal()`, `momDelta()`, `yoyDelta()`.

### P0-6 · KPI_HINTS expandido com termos de crédito
**Status**: ✅ Concluído.

`src/components/hub/KPICard.tsx` — KPI_HINTS ganhou **26 novos termos** de crédito organizados em 6 blocos:
- Inadimplência (4): `inadim. total`, `inadim. pf`, `inadim. pj`, `inadim. livres`
- Spreads (3): `spread`, `spread pf`, `spread pj`, `spread médio`
- Taxas (4): `taxa pf`, `taxa pj`, `taxa veículos`, `taxa micro`
- Saldos (5): `saldo total`, `saldo pf`, `saldo pj`, `saldo pj livres`, `saldo pme`
- Concessões (4): `concessões`, `concessões pf`, `concessões pj`, `consignado`
- Macro (3): `crédito/pib`, `cartões de crédito`, `cartão de crédito`
- Referências monetárias (3): `selic`, `tlp`, `tjlp`, `tr`

Pattern: cada hint pt-BR com contexto quantitativo (benchmarks históricos, thresholds críticos, fórmulas relevantes). HintIcon (ⓘ) renderiza automaticamente em `KPICard` e `SimpleKPICard` quando o `title/label` bate com uma chave.

### P0-7 · Audit doc `AUDIT_CREDITO_PROFUNDO_19ABR.md`
**Status**: ✅ Este documento.

### P0-8 · Build + commit + push
**Status**: ✅ Concluído em commit `30253fb`. Build clean (tsc 0, vite ~5.1s). HubCredito chunk 89 → 104 kB (+15 kB com NarrativeSection foundation + DataAsOfStamp + KPI_HINTS expandido). Pushed to `origin/main`.

---

## P1 — High-Impact Pós-Beta

Organizados por impacto×esforço. Todos frontend-only ou dados já disponíveis via BACEN SGS.

**Status entrega (commit `1628bf5`):** 7 de 8 tickets shipped. P1-6 (alertas dinâmicos) deferido — requer migration + admin UI.

### P1-1 · Rolling indicators grid no Visão Geral
**Status**: ✅ Shipped. Novo helper `src/lib/creditRollingDeltas.ts` com tipos `IndicatorKind` ("rate" | "spread" | "default" | "volume") + `buildCreditRollingRow(label, data, kind, window)`. Novo componente `src/components/hub/CreditRollingGrid.tsx` — Tech-Noir table com colunas 1m/3m/6m/12m/24m/36m, intensidade de cor *direction-aware* (deltas negativos em inadim/spread/taxa pintados emerald; positivos em volume pintados emerald; vice-versa). HubCredito Visão Geral agora fetcha 5y bundles (saldo, concessao, taxa, spread, inadimplencia) com `enabled: true` e monta 4 rows: Inad. Total, Spread PF, Taxa PF, Concessões PF. Accent `#10B981`.

### P1-2 · COPOM event overlay em charts Macro-ligados
**Status**: ✅ Shipped. `MacroChartEvent` prop integrado em 3 charts da section Preço (Taxa Média PF, Spread PF, Taxa PJ) + 1 chart da section Risco (Inadim vs Selic). `useMonetaryEvents("COPOM")` via `src/hooks/useHubData.ts`. ReferenceLines coloridas (hike=red, cut=emerald, hold=zinc), toggle EV no header de cada chart.

### P1-3 · Breadcrumbs + onboarding tour step
**Status**: ✅ Shipped. `OnboardingTour.tsx` — step Crédito enriquecido com texto específico: "Módulo Crédito — catálogo BACEN SGS, query builder 18 modalidades, 6 narrativas (Visão Geral → Volume → Preço → Risco → Operações → Analytics)." Tour agora tem 8 steps (Welcome + Dashboard + Macro + Crédito + Renda Fixa + Fundos + Ofertas + Feedback). Breadcrumbs já existente em Hub deep pages — refatorado para incluir section atual quando deep-linked via `?section=`.

### P1-4 · PDF export do módulo Crédito
**Status**: ✅ Shipped. `ExportPdfButton` integrado no header sticky de `HubCredito.tsx`. `PrintFooter` renderizado no final da página (visible apenas em @media print). Classes `no-print` aplicadas em HubSidebar, top bar nav, FeedbackWidget, OnboardingTour, MobileNav. @media print CSS de Fundos (`src/index.css`) cobre o módulo — A4, Tech-Noir flip para ink-friendly, break-inside avoid em charts/cards.

### P1-5 · Correlation heatmap com Focus expectativas
**Status**: ✅ Shipped. `CreditCorrelationPanel` refatorado com prop `kind?: "credit" | "focus"`. Analytics section agora monta 2 panels lado-a-lado: (a) correlação crédito-interna (inadim × spread × taxa × concessões), (b) correlação crédito × Focus (inadim × expectativa IPCA/Selic/PIB 12m). Pearson date-aligned via `Map<string, number>` para reconciliar cadência mensal (crédito) com semanal (Focus). Chips indigo para indicadores FWD (Focus) vs emerald para indicadores BACEN (atuais). `useHubSeriesBundle("focus", period, "credito", enabled)` lazy-fetched apenas quando Analytics section está visível.

### P1-6 · Alertas Automáticos com thresholds dinâmicos
**Status**: ⏳ Deferido (requer migration + admin UI). Backlog pós-beta: criar `hub_alert_thresholds` table (module, metric, severity_amber, severity_red, updated_by, updated_at), migrar thresholds hardcoded atuais (4% inadim, 20pp spread, -5% concessões MoM, 55% crédito/PIB), construir admin UI page `/admin/thresholds` acessível apenas por tier=admin.

### P1-7 · Segment drill-down em CreditOperationsPanel
**Status**: ✅ Shipped. Novo `ModalityDetailDrawer` embedded em `CreditOperationsPanel.tsx` — modal fullscreen triggered por click em linha da `ComparisonTable`. Drawer abre com lazy-enabled `useHubSeriesBundle` (5y window, `enabled: drillEnabled` guard evita fetch até drawer abrir). KPI strip topo (Saldo atual, Taxa, Inad, 12m delta). Dual-line chart histórico (saldo + taxa eixos duplos) + single-line inadim chart. Peer benchmarking section: mean dos outros modalities mesmo tipo+recurso via helper `meanByDate(series[], targetDates)` O(N) per-date mean. Drawer a11y: `role="button"`, `tabIndex`, `aria-modal`, ESC handler, body scroll lock, click-outside close, `no-print` class.

### P1-8 · Export state share-link
**Status**: ✅ Shipped. `CreditOperationsPanel` query builder filters (tipo [PF/PJ], recurso [Livres/Direcionados], modalidades[] selecionadas, period [6M/1A/2A/5A/MAX]) agora serializados em `useSearchParams` (replace: true). URL pattern: `/hub/credito?section=operacoes&tipo=PF&recurso=Livres&modalities=20570,20572,20581&period=2A`. Hidratação inicial via lazy `useState` reading searchParams. Debounced sync (300ms) para performance. Links compartilháveis via copy URL ou share button (toast confirm).

---

## P2 — Polish

**Status entrega (commit `<pending>`):** 4 de 8 tickets shipped frontend-only. P2-4 já em produção via commit anterior (InterestCalculator SCENARIOS). P2-6 endereçado por EmptyState existente nos charts. P2-5 e P2-8 diferidos pós-beta (sweep disciplinado + axe-core audit).

### P2-1 · NarrativeSection nas 3 sections restantes
**Status**: ✅ Shipped. Adicionado `NarrativeSection` em **Visão Geral** (5 mini-stats: Regime consolidado, Saldo SFN, Inadim. Total, Taxa PF média, Concessões PF — regime derivado de inadLast/spreadLast/concessoesMoMLast classificando 5 regimes: Stress Sistêmico / Contração / Expansão / Aperto de Risco / Normalização, prosa sintetizando o estado do ciclo de crédito), **Operações** (5 mini-stats: Modalidades disponíveis, Cartões emitidos, Saldo veículos PF, Saldo cartão rotativo, Crédito/PIB — prosa explicando o catálogo de 18 modalidades BACEN + fallback aggregate quando SGS não publica taxa específica) e **Analytics** (5 mini-stats: Selic nominal, Focus IPCA 12m, Focus Selic, Juro real ex-ante com cor dinâmica por severidade, Inadim. SFN — prosa sobre juro real ex-ante como força dominante sobre concessões + alertas automáticos). Todas com accent `#0B6C3E`.

### P2-2 · Heatmap diverging Credit/Spread × Month-year
**Status**: ✅ Shipped. Novo componente `src/components/hub/CreditCalendarHeatmap.tsx` (~284 linhas) espelhando `DrawdownHeatmap` com semântica kind-aware: `rate`/`spread`/`default` (higher = bad, red), `volume` (higher = good, emerald). Pivot ano × mês, 4-step diverging intensity (abs(diff)/maxAbsDiff), footer com Último/Mediana/Máx/Mín (Máx/Mín color-coded por kind). Integrado em HubCredito Visão Geral: `<CreditCalendarHeatmap data={pickSeries(inadBundle5y, "21082")} kind="default" title="Inadimplência SFN — calendário" subtitle="Desvio mensal vs mediana histórica (5 anos) · maior = pior" accent="#EF4444" />`. Mostra sazonalidade do crédito stress e regime shifts.

### P2-3 · Sparkline universal em todas as KPICards
**Status**: ✅ Shipped. Removido `sectionVisible(...)` gate nos bundles `spread`, `concessao` e `cartoes` — agora são sempre fetched junto com os demais Visão Geral bundles. Isso alimenta `sparklineMap` (via `buildSparklineMap`) com mais séries desde o primeiro render, garantindo que KPICards do hero (inc. spread PF `20783`, concessões PF `20631`, cartões emitidos `25147`) nunca renderem sparkline vazio. Custo: ~3 queries extras na landing, todas com `staleTime: 30min`.

### P2-4 · InterestCalculator preset scenarios por perfil AAI
**Status**: ✅ Já shipped em commit anterior (pre-P2 batch). `InterestCalculator.tsx` linhas 43-48 já contém `SCENARIOS` constant com 3 perfis: `Conservador` (12% a.a., 120 meses, R$ 50k), `Base` (20% a.a., 60 meses, R$ 30k), `Agressivo` (35% a.a., 36 meses, R$ 15k). Botões de preset no header do calculator.

### P2-5 · Unit consistency sweep
**Status**: ⏳ Deferido pós-beta. Backlog: aplicar `normalizeToBi()` pattern de `CreditOperationsPanel` em `MacroInsightCard` + outros charts que ainda assumem unidade implícita. Testar 73 séries de crédito individualmente contra `hub_macro_series_meta.unit`.

### P2-6 · Empty states contextuais
**Status**: ✅ Endereçado. `ChartPanel` já renderiza inline empty state ("Sem dados no período") quando series array é vazio. `EmptyState variant="no-data"` disponível como fallback mais elaborado. Não foi necessária refatoração ampla — cobertura atual é suficiente para beta.

### P2-7 · Feedback widget scoped by section
**Status**: ✅ Shipped. `HubLayout.tsx` agora consome `useHubSections()` context e passa `section={activeSectionLabel}` para `<FeedbackWidget />`. `FeedbackWidget.tsx` (sem alteração — prop `section?: string` já existia) anexa o label da section ativa no `hub_feedback.section` column. Isso categoriza feedback por seção do Hub (e.g. "Visão Geral", "Volume", "Taxas & Spreads", "Risco", "Operações", "Analytics") em vez de só pelo pathname.

### P2-8 · a11y sweep
**Status**: ⏳ Deferido pós-beta. axe-core audit + WCAG 2.1 AA compliance check em HubCredito. Áreas prováveis: contraste de texto zinc-600 sobre #0a0a0a em algumas charts, labels ARIA em icon-only buttons do OperationsPanel, tab order em modais.

---

## Entregáveis desta sessão

**P0 (commit `30253fb`):**
- `src/components/hub/CreditOperationsPanel.tsx` — rewrite (~750 linhas, elimina bug sintético)
- `src/pages/HubCredito.tsx` — DataAsOfStamp header + NarrativeSection em 3 sections + helpers lastVal/momDelta/yoyDelta
- `src/components/hub/KPICard.tsx` — KPI_HINTS +26 termos crédito
- `AUDIT_CREDITO_PROFUNDO_19ABR.md` — este documento

**P1 (commit `1628bf5`):**
- `src/lib/creditRollingDeltas.ts` — NEW — tipos IndicatorKind + buildCreditRollingRow
- `src/components/hub/CreditRollingGrid.tsx` — NEW — Tech-Noir table com direction-aware cell colors
- `src/components/hub/CreditCorrelationPanel.tsx` — prop `kind?: "credit" | "focus"` + date-aligned Pearson via Map
- `src/components/hub/CreditOperationsPanel.tsx` — `ModalityDetailDrawer` drill-down + peer benchmarking + URL persistence
- `src/pages/HubCredito.tsx` — 5y bundles para Rolling Grid + Focus bundle lazy-fetched em Analytics + COPOM overlay em 4 charts + ExportPdfButton integrado
- `src/components/hub/OnboardingTour.tsx` — Crédito step enriquecido (8 steps total)

**P2 (commit `<pending>`):**
- `src/components/hub/CreditCalendarHeatmap.tsx` — NEW (~284 linhas) — Year × Month diverging heatmap com semântica kind-aware (rate/spread/default = higher bad; volume = higher good)
- `src/pages/HubCredito.tsx` — NarrativeSection em Visão Geral + Operações + Analytics (15 mini-stats novos, 3 regimes/5 estados detectados), CreditCalendarHeatmap integrado em Visão Geral (inadimplência SFN calendário 5y), removido gate lazy-load de spread/concessao/cartoes bundles para universal sparkline coverage
- `src/components/hub/HubLayout.tsx` — `useHubSections()` wire para passar `section={activeSectionLabel}` ao FeedbackWidget (feedback agora scoped por seção ativa do Hub)
- `AUDIT_CREDITO_PROFUNDO_19ABR.md` — este documento atualizado com status P2

## Métricas

- **Bug crítico**: 1 corrigido (CreditOperationsPanel pesos sintéticos)
- **Código P0**: ~900 linhas net, 0 erros TypeScript
- **Código P1**: ~580 linhas net (rolling grid + drawer + Focus correlation + overlays), 0 erros TypeScript
- **Código P2**: ~300 linhas net (CreditCalendarHeatmap + 3 NarrativeSection + feedback wire), 0 erros TypeScript
- **Pattern parity com Fundos**: 8/8 (NarrativeSection, KPI_HINTS, DataAsOfStamp, CSV export pt-BR, Rolling grid, PDF export, Drill-down drawer, Calendar heatmap)
- **Séries SGS re-validadas**: 18 modalidades × 3 (saldo/taxa/inadim) = 54 refs, 100% contra `hub_macro_series_meta`
- **Bundle impact**: HubCredito 89 → 129 kB (+40 kB para 19 features P0+P1+P2)
- **Tickets P1 mapeados**: 8 (7 shipped, 1 deferido)
- **Tickets P2 mapeados**: 8 (4 shipped novos + 1 pré-shipped + 1 já endereçado + 2 diferidos)

## Commits

- `30253fb` — feat(hub/credito): P0 audit fixes (bug sintético + NarrativeSection + DataAsOfStamp + KPI_HINTS)
- `1628bf5` — feat(hub/credito): P1 batch (Rolling Grid + COPOM overlay + Focus correlation + Drill-down + URL persistence + PDF export + Onboarding)
- `<pending>` — feat(hub/credito): P2 polish (Calendar heatmap + 3 NarrativeSection + sparkline universal + feedback scoped)
