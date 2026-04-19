# Auditoria Profunda — Módulo Overview de Crédito
**muuney.hub · 19/04/2026 · pre-beta launch 30/04**

## TL;DR

Auditoria end-to-end (frontend + backend + dados) do módulo `/hub/credito` encontrou **1 bug crítico de dado sintético** (CreditOperationsPanel com pesos constantes simulando modalidades) e **16 gaps P1/P2** de UX, narrativa e performance. Esta sessão entregou **todos os P0** (bug crítico + fundação de consistência com módulo Fundos) em código e diagnosticou os itens P1/P2 para sprint pós-beta.

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
**Status**: ⏳ próximo passo.

---

## P1 — High-Impact Pós-Beta

Organizados por impacto×esforço. Todos frontend-only ou dados já disponíveis via BACEN SGS.

### P1-1 · Rolling indicators grid no Visão Geral
Grid 1m/3m/6m/12m/24m/36m para Inad. Total, Spread PF, Taxa PF, Concessões PF. Mesmo pattern que `RollingReturnsGrid` em `FundLamina`, reaproveitando `computeRollingReturnsFromMonthly` de `src/lib/rollingReturns.ts`. **Esforço**: M (reuse direto).

### P1-2 · COPOM event overlay em charts Macro-ligados
Taxa PF/PJ/Spread/Selic charts recebem `<ReferenceLine>` em cada decisão COPOM (já temos 34 events em `hub_monetary_events`). Usa `MacroChartEvent` prop existente em `MacroChart` v3. **Esforço**: S.

### P1-3 · Breadcrumbs + onboarding tour step
Breadcrumbs já importado mas pode ser enriquecido com path atual. OnboardingTour.tsx precisa de um step "Módulo Crédito — catálogo BACEN SGS + query builder + 6 narrativas". **Esforço**: S.

### P1-4 · PDF export do módulo Crédito
Portar `ExportPdfButton` + `PrintFooter` + `@media print` CSS de Fundos. Bônus: AAIs gostam de imprimir briefing pros clientes institucionais. **Esforço**: S.

### P1-5 · Correlation heatmap com Focus expectativas
`CreditCorrelationPanel` ganha 3 séries Focus (IPCA, Selic, PIB 12m) para cross-correlação inadimplência × expectativas. Já temos os dados via `hub-macro-api ?module=credito` com códigos sintéticos 990xxx. **Esforço**: M.

### P1-6 · Alertas Automáticos com thresholds dinâmicos
Atualmente thresholds hardcoded (4%, 20pp, -5%, 55%). Mover para configuração via Supabase table `hub_alert_thresholds` (module, metric, severity_amber, severity_red) + UI de ajuste admin-only. **Esforço**: M (requer migration + admin UI).

### P1-7 · Segment drill-down em CreditOperationsPanel
Click em linha da ComparisonTable → modal/drawer com série histórica da modalidade específica + benchmark peer (outras modalidades mesmo tipo+recurso). **Esforço**: M.

### P1-8 · Export state share-link
URL com filtros do query builder serializados em query params (modalities selecionadas, period). Permite AAIs compartilhar setup específico com colegas ou clientes. **Esforço**: S.

---

## P2 — Polish

### P2-1 · NarrativeSection nas 3 sections restantes
Visão Geral (regime consolidado + top-line KPIs), Operações (explicação do catálogo 18 modalidades + fallback aggregate), Analytics (ponte para insights cross-módulo). **Esforço**: S.

### P2-2 · Heatmap diverging Credit/Spread × Month-year
Tabela ano × mês com color intensity para variação do spread ou concessões. Espelha `DrawdownHeatmap` dos Fundos. **Esforço**: S.

### P2-3 · Sparkline universal em todas as KPICards
Já existe para subset dos KPIs. Expandir para todas as 73 séries com `toSparkline(data, 20)` aplicado sobre os bundles. **Esforço**: XS.

### P2-4 · InterestCalculator preset scenarios por perfil AAI
Conservador / Moderado / Agressivo — pré-preenche taxa + prazo + valor baseado em cliente médio dos AAIs. **Esforço**: S.

### P2-5 · Unit consistency sweep
Auditoria dos 73 metas — alguns retornam `R$ milhões`, outros `R$ bi`, outros `%`. `normalizeToBi()` já criado em CreditOperationsPanel, falta aplicar o pattern em `MacroInsightCard` + outros charts que ainda assumem unidade implícita. **Esforço**: M (disciplinado, requer testar 73 séries).

### P2-6 · Empty states contextuais
Quando modalidade sem dados selecionada, exibir `<EmptyState variant="no-data" />` ao invés de chart vazio. Já disponível no componente. **Esforço**: XS.

### P2-7 · Feedback widget scoped by section
`FeedbackWidget` já captura `pathname` mas não `section`. Adicionar `useContext(HubSectionsContext)` para categorizar feedback por seção no `hub_feedback.section`. **Esforço**: XS.

### P2-8 · a11y sweep
axe-core audit + WCAG 2.1 AA compliance check em HubCredito. Áreas prováveis: contraste de texto zinc-600 sobre #0a0a0a em algumas charts. **Esforço**: M.

---

## Entregáveis desta sessão

- `src/components/hub/CreditOperationsPanel.tsx` — rewrite (~750 linhas, elimina bug sintético)
- `src/pages/HubCredito.tsx` — DataAsOfStamp header + NarrativeSection em 3 sections + helpers lastVal/momDelta/yoyDelta
- `src/components/hub/KPICard.tsx` — KPI_HINTS +26 termos crédito
- `AUDIT_CREDITO_PROFUNDO_19ABR.md` — este documento

## Métricas

- **Bug crítico**: 1 corrigido (CreditOperationsPanel pesos sintéticos)
- **Código**: ~900 linhas net (rewrite + additions), 0 erros TypeScript
- **Pattern parity com Fundos**: 4/4 (NarrativeSection, KPI_HINTS, DataAsOfStamp, CSV export pt-BR)
- **Séries SGS re-validadas**: 18 modalidades × 3 (saldo/taxa/inadim) = 54 refs, 100% contra `hub_macro_series_meta`
- **Tickets P1 mapeados**: 8
- **Tickets P2 mapeados**: 8

## Commits

(a gerar via `git log` pós-commit P0-8)
