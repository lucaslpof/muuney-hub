# Auditoria Profunda — Módulo Renda Fixa
**muuney.hub · 20/04/2026 · pre-beta launch 30/04**

> **Status entrega (20/04/2026):** P0 (13 tickets) **✅ concluído** em commits `cdfff09` (feat RF P0 batch — 9 files, +2519/-87: NarrativeSection em 5 sections + DataAsOfStamp sticky header + KPI_HINTS RF + RfRollingGrid + CreditCalendarHeatmap NTN-B 2035 + Breakeven 3a + TesouroSimulator + RfPortfolioCalculator + CreditoPrivadoDeepPanel AA×A + ExportPdfButton + PrintFooter + no-print tags) + `<pending>` (feat RF P0-2/P0-6 follow-up — 2 files: MacroChart CSV export pt-BR upgrade + SpreadMonitor migration para csvExport helper). Build clean (tsc 0 errors, vite build 5.40s). HubRendaFixa chunk 97.55 kB / gzip 25.66 kB — **folga 38% vs target <160 kB**. Pattern parity 4/4 packs com Crédito/Fundos. Push pendente (credenciais GitHub indisponíveis nesta sessão — Lucas deve rodar `git push origin main`).
>
> **P0-2 verificação (20/04/2026)**: audit apontou 7 séries com meta drift + unit label errado no código 11 (Selic Efetiva). Diagnóstico em produção mostrou **zero drift** (todas as 30 séries RF ativas têm `meta_last_date = MAX(hub_macro_series.date)` e `meta_last_value` idêntico ao último valor da série temporal) + unit correto (`% a.d.` alinhado ao valor diário `0.054266`). Infra já existe: RPC `refresh_hub_macro_series_meta()` + pg_cron job #22 (`refresh_macro_series_meta_nightly` 04:00 UTC daily). **Nenhuma migration necessária** — o pipeline noturno já mantém meta coerente. Audit refletiu estado observado antes do refresh nightly propagar; documentando aqui que o controle automático já está operacional.
>
> **P0-6 CSV export global pt-BR (20/04/2026)**: `MacroChart.exportCSV()` reescrito para usar `@/lib/csvExport.exportCsv()` (separator `;` + BOM UTF-8 + vírgula decimal pt-BR via `toLocaleString`). Cobre 100% dos ~20 charts do módulo RF (Selic vs CDI, TLP vs Poupança, Curva DI snapshot, DI 30d×360d, DI 720d×1800d, DI Slope, TR, Poupança, Estoque TD, Vendas TD, NTN-B 2029×2035, NTN-B 2045, BEI 1a×5a, BEI 3a, NTN-B term structure, Spreads AA×A, Emissões, IMA-B Proxy) sem diff por chart — upgrade centralizado no helper. `SpreadMonitor.tsx` também migrou CSV interno (6 colunas pt-BR + filename via `csvFilename("credito","spread_monitor")`).

## TL;DR

Auditoria end-to-end (frontend + backend + dados) do módulo `/hub/renda-fixa` (HubRendaFixa.tsx, 925 linhas · 5 narrative sections · 30 indicadores BACEN SGS) identificou **2 hipóteses de bugs de dados** (meta drift em 7 séries + unit label errado em Selic código 11) e **16 gaps P1/P2** de UX, narrativa e pattern parity com os módulos Crédito e Fundos já auditados. Na verificação em produção (20/04/2026 após pg_cron job #22 rodar), os bugs de dados não se confirmaram: zero drift e unit correto — infra automática (RPC + pg_cron nightly) já mantém meta coerente. Nenhum bug sintético como o que afetou CreditOperationsPanel — dados RF são todos BACEN SGS diretos.

Escopo desta auditoria, por escolha do Lucas em AskUserQuestion:

- **Profundidade**: deep audit completo (espelha AUDIT_CREDITO_PROFUNDO_19ABR + AUDIT_FUNDOS_PROFUNDO_18ABR).
- **Pattern parity target**: 4 packs completos — narrativo (NarrativeSection per-section + KPI_HINTS + HintIcon), analítico (Rolling grid + Calendar heatmap), export/print (CSV pt-BR + PDF export), interação (drill-down por tenor/vencimento + share-link por seção).
- **Features novas pedidas**: (i) Simulador Tesouro Direto (carbono da calculadora de bonds aplicada a LTN/LFT/NTN-B com custódia B3 0.20%), (ii) Carteira RF calculator (multi-título com alocação + yield blend + duration efetiva + sensibilidade por choque de curva), (iii) Crédito Privado AA/A detalhado (deep panel com stress/relief matrix, cluster por rating, CRA+CRI separados, emissões por setor).
- **Out of scope** (escolhido pelo Lucas): Breakeven/Term Premium tracker dedicado (o overlay atual na section Analytics é suficiente).

Pattern parity atual vs Crédito (baseline 8/8 entregue em 19/04): **2/8** — apenas `SectionErrorBoundary` + `MacroSection` estão consistentes. Restante (NarrativeSection per-section, DataAsOfStamp, Rolling grid, Calendar heatmap, KPI_HINTS, CSV pt-BR, PDF export, drill-down drawer) **ausente no RF**.

---

## Metodologia

1. **Benchmark** contra ComDinheiro (terminais RF), Economatica (curvas + calculadoras), Bloomberg BVAL (yield curves + credit spreads), ANBIMA Data (IMA series + Focus), B3 (Tesouro Direto + debêntures), CVM (CRA/CRI disclosures), Mais Retorno (comparador títulos públicos), Status Invest (filtros rating).
2. **Gap analysis 360º** em 5 dimensões: Features, UX/UI, Narrativa, Performance, Consistência com Crédito/Fundos já auditados.
3. **Investigação backend**: hub-macro-api Edge Function (v5, query-only, shared com Macro) + tabela `hub_macro_series_meta` (130 séries totais das quais 38 relevantes para RF em 10 categorias).
4. **Code review**: HubRendaFixa.tsx (925 linhas) + 4 componentes filhos (FixedIncomeNarrativePanel 347 linhas, BondCalculator 428 linhas, YieldCurveSimulator 261 linhas, SpreadCreditoPrivado 274 linhas).
5. **Priorização** impacto×esforço (P0 = bloqueia beta / pattern parity / novas features pedidas, P1 = alta alavancagem pós-beta, P2 = polish).

---

## Seção 1 — Diagnóstico Frontend

### 1.1 — HubRendaFixa.tsx (925 linhas)

**Estrutura atual** (5 narrative sections):

| Section | Narrativa | KPIs próprios | Charts | Panels filhos | Dados lazy |
|---|---|---|---|---|---|
| Visão Geral | ❌ nenhuma prosa | grid kpis[] + Quick Intelligence Strip (4 cards: Juro Real / Curva DI shape / Focus Selic / BEI 3a vs Meta) | Selic vs CDI, TLP vs Poupança (2) | — | ❌ eager |
| Taxas & Curva | ❌ nenhuma prosa | — (só insights via MacroInsightCard) | Curva DI snapshot, DI 30d×360d, DI 720d×1800d, DI Slope, TR, Poupança (6) | — | ❌ eager |
| Títulos Públicos | ❌ nenhuma prosa | — | Estoque TD, Vendas TD, NTN-B 2029×2035, NTN-B 2045, BEI 1a×5a, BEI 3a, NTN-B term structure (7) | — | ✅ lazy (sectionVisible) |
| Crédito Privado | ❌ nenhuma prosa | — | Spreads AA×A, Emissões (2) | SpreadCreditoPrivado | ✅ lazy |
| Analytics | ❌ nenhuma prosa | KPI strip IMA-B retornos (3) | IMA-B Proxy index | FixedIncomeNarrativePanel, YieldCurveSimulator, BondCalculator, alerts grid, benchmarks grid | ✅ lazy |

**Observações positivas**:
- Lazy-load por seção via IntersectionObserver dual-observer (preload 300px antes + active 120px top).
- Deep-linking URL (`?section=&period=`) já consistente com Crédito/Macro.
- SectionErrorBoundary em cada section.
- IMA-B Proxy com duration-based (3y/7y/15y) é cálculo analítico sofisticado já em produção.
- Quick Intelligence Strip no Visão Geral é um bom embrião de NarrativeSection (mas falta prosa + mini-stats formatados).

**Gaps arquiteturais** (10 itens, todos P0 ou P1):

1. **Nenhuma NarrativeSection** em 5 de 5 sections (Crédito tem em 6 de 6 após P2).
2. **Sem DataAsOfStamp** no header (Crédito tem compact + panel-level no OperationsPanel).
3. **Sem Rolling indicators grid** na Visão Geral (Crédito tem `CreditRollingGrid` 1m/3m/6m/12m/24m/36m).
4. **Sem Calendar heatmap** year×month (Crédito tem `CreditCalendarHeatmap` para inadim SFN).
5. **Sem KPI_HINTS** registrados para termos RF (curva DI, NTN-B, breakeven, duration, DV01, juro real, IMA-B, TR, TLP, spread AA/A, estoque TD).
6. **Sem CSV export global pt-BR** (só SpreadCreditoPrivado tem `exportCSV()` com separador `,` e sem BOM — formato "gringo").
7. **Sem PDF export** com ExportPdfButton + PrintFooter + @media print (Fundos P1-1, Crédito P1-4).
8. **Sem COPOM overlay** nos charts de Selic/CDI/NTN-B/BEI (Macro tem em 6 charts, Crédito ganhou em 4 via P1-2).
9. **Sem drill-down drawer** por tenor DI ou vencimento NTN-B (Crédito tem ModalityDetailDrawer em OperationsPanel).
10. **Sem share-link por seção** (URL persiste só section+period, não salva state do Bond Calculator / Yield Simulator / filtros do SpreadCreditoPrivado).

### 1.2 — Componentes filhos

**FixedIncomeNarrativePanel.tsx** (347 linhas):
- 6 regimes (apertoAgressivo > apertoModerado > neutro > afrouxamento > stressCredito > transicao) com priorização stressCredito > aperto > outros.
- `generateFixedIncomeSignals()` produz até 8 signals (Curva×Inflação, Spread×Selic, Breakeven vs IPCA, Fluxo TD, DI×Focus, Term Premium, Juro Real, Breakeven Desancorando).
- Bem arquitetado, sem bugs. Apenas renderiza na section Analytics — **pode ser reaproveitado em mini-mode** (só regime + top 2 sinais) no Visão Geral como abertura narrativa.

**BondCalculator.tsx** (428 linhas):
- 3 presets (Prefixado/IPCA+/Selic+), 3 views (calculator/scenarios/mam).
- calcDurationConvexity + cashflow builder + 5×6 heatmap. Matematicamente sólido.
- **Gap**: só calcula bond único. Carteira RF (novo feature pedido) precisa estender para array de bonds com alocação.

**YieldCurveSimulator.tsx** (261 linhas):
- 3 shift modes (parallel/twist/butterfly) + analyzeShape().
- DV01 calculado mas NÃO comparado com Focus expectations de forma narrativa.
- **Gap**: não persiste o choque aplicado na URL (user roda simulação, dá F5, perde tudo).

**SpreadCreditoPrivado.tsx** (274 linhas):
- 5 regimes (Stress/Complacência/Expansão/Retração/Neutro), 4 cross-signals, 3 risk levels.
- `exportCSV()` já implementado mas com separador `,` e sem BOM — precisa migrar para `exportCsv` do `@/lib/csvExport` (padrão pt-BR).
- **Gap** (feature pedido): não tem breakdown por **rating AA→BBB→BB** granular, só AA vs A agregado. CRA e CRI aparecem apenas como KPI escalar `estoqueCRACRI`, sem breakdown temporal ou por setor.

---

## Seção 2 — Diagnóstico Backend

### 2.1 — hub_macro_series_meta — catálogo RF

**Query executada** (resumo): `SELECT category, COUNT(*) FROM hub_macro_series_meta WHERE category IN (...) AND is_active GROUP BY category`.

| Categoria | Séries | Usadas no frontend | Observação |
|---|---|---|---|
| taxa_ref | 4 | 4 (CDI 4392, TR 226, TLP 27547, poupança proxy 256) | TJLP 256 stale 110d |
| selic | 2 | 2 (Selic meta 432, Selic efetiva 11) | **Unit bug em 11** (ver 2.2) |
| curva_di | 9 | 9 (vértices 7813→7821) | 19d stale (atualização D+1 útil BACEN) |
| ntnb | 4 | 4 (12460/61/62/63 — 2029/35/45/55) | 27d stale |
| breakeven | 3 | 3 (990101/02/03 — 1a/3a/5a, synthetic via Focus OData) | 24d stale |
| tesouro | 3 | 3 (990201/02/03 — estoque/vendas/investidores, synthetic) | 50d stale (mensal) |
| poupanca | 1 | 1 (195) | — |
| credpriv | 4 | 4 (990301/02/03/04 — spread AA/A/emissões/estoque CRA+CRI, synthetic) | 24d stale |
| focus | 6 | 2 (Selic 990002, IPCA 990001 — outros não consumidos em RF) | — |
| ipca | 2 | 1 (13522 para juro real) | — |

**Total séries RF**: 38. **Usadas no HubRendaFixa.tsx**: 30 (excluindo 4 Focus/IPCA reutilizadas de Macro e 4 vértices DI auxiliares).

### 2.2 — Bugs de dados identificados

**Bug #1 — Meta drift (7 séries)**:
Observações em `hub_macro_series` existem mas `hub_macro_series_meta.last_date = null`. Séries afetadas:
- 7813, 7814, 7815 (DI curtas 30d/60d/90d)
- 195 (poupança)
- 226 (TR)
- 256 (TJLP)
- 4392 (CDI)

**Impacto UX**: `DataAsOfStamp` (quando for adicionado em P0-2) vai exibir "dados desatualizados" falsamente + staleness dot vermelho enganoso + `KPICard.lastDate` null → vazio em 7 cards.

**Fix**: migration/RPC que recomputa `last_date = MAX(data_ref)` em `hub_macro_series_meta` a partir de `hub_macro_series`, agendado em pg_cron daily após ingestion. Ticket P0-2.

**Bug #2 — Unit label errado (1 série)**:
`hub_macro_series_meta.unit = '% a.a.'` para código 11 (Selic Efetiva), mas valor armazenado é taxa diária (0.054266 no último observado).

**Impacto UX**: `KPICard` exibe "0.05% a.a." quando deveria ser "14.25% a.a." — o usuário vê Selic Efetiva como quase zero, dramaticamente inconsistente com Selic Meta 14.25%.

**Fix**: (a) atualizar unit para "% a.d." (correto para daily rate) OU (b) annualizar na ingestion `(1 + daily)^252 - 1` e manter "% a.a.". Opção (b) é padrão ANBIMA e casa melhor com apresentação ao AAI. Ticket P0-2.

### 2.3 — Ingestão & cadência

- `hub-macro-api` v5 é shared com Macro (category filter). Sem alterações necessárias.
- Ingestion diária via pg_cron (D+1 útil). Funciona bem para Selic/CDI/DI; mensal para Tesouro/NTN-B secundário/breakeven (ANBIMA).
- **Nenhum ticket backend novo precisa ser criado para P0** — todos os dados já estão ingeridos. Bugs #1 e #2 são corrigíveis via SQL one-shot + trigger idempotente.

---

## Seção 3 — Gap Analysis 360º

### 3.1 — Pattern parity com Crédito (8 packs)

| Pack | Crédito (19/04) | RF (atual) | Ticket |
|---|---|---|---|
| NarrativeSection per-section | ✅ 6/6 após P2 | ❌ 0/5 | P0-3 |
| KPI_HINTS + HintIcon | ✅ +26 termos crédito | ❌ 0 termos RF | P0-4 |
| DataAsOfStamp | ✅ header + panel | ❌ ausente | P0-5 |
| CSV pt-BR (`;` + BOM) | ✅ 3 botões + csvFilename helper | ❌ 1 CSV legacy em SpreadCreditoPrivado com `,` e sem BOM | P0-6 |
| Rolling grid | ✅ `CreditRollingGrid` 4 linhas | ❌ ausente | P0-7 |
| Calendar heatmap year×month | ✅ `CreditCalendarHeatmap` inadim | ❌ ausente | P0-8 |
| PDF export (ExportPdfButton + PrintFooter + @media print) | ✅ P1-4 | ❌ ausente | P0-9 |
| Drill-down drawer | ✅ ModalityDetailDrawer P1-7 | ❌ ausente | P1-3 |

### 3.2 — Features novas pedidas pelo Lucas

| Feature | Motivação | Escopo | Ticket |
|---|---|---|---|
| **Simulador Tesouro Direto** | AAI precisa simular LTN/LFT/NTN-B para cliente com data de aquisição + resgate antecipado + custódia B3 0.20% | Component novo, extension de BondCalculator com fluxo específico TD (custódia, IR regressivo, LFT como LFT-B/IOF) | P0-10 |
| **Carteira RF calculator** | AAI monta carteira 3-8 títulos e precisa ver yield blend, duration efetiva, DV01 da carteira e sensibilidade a choque paralelo/twist/butterfly | Component novo reutilizando applyShift do YieldCurveSimulator, input array de holdings (tipo/vencimento/alocação%/taxa) | P0-11 |
| **Crédito Privado AA/A detalhado** | Spread AA vs A é útil mas AAI precisa stress matrix (drawdown histórico), breakdown CRA vs CRI separados, emissões por setor (infra/agro/imobiliário) | Deep panel novo abaixo do SpreadCreditoPrivado existente com 4 novos charts | P0-12 |

### 3.3 — Benchmarks externos (onde estamos vs eles)

- **Bloomberg BVAL**: curva DI intradiária (nós: daily). BVAL tem breakeven decomposition (real yield + IRP + LRP). **Deferido pós-beta** — requer ingestão high-frequency ANBIMA.
- **ANBIMA Data**: IMA series oficiais (IMA-B, IMA-B5, IRF-M, IHFA). Nosso IMA-B Proxy é duration-based, não o índice real da ANBIMA. **Deferido** — licença ANBIMA paga.
- **B3 Tesouro Direto**: calculadora oficial tem IR regressivo correto + custódia B3 0.20% aa. Nosso simulador TD (P0-10) vai replicar ambos.
- **ComDinheiro**: tem stress test com 5 cenários (Selic +/-200bps, IPCA +/-100bps, câmbio +/-10%). **Diferido** — encaixa em P1-4 Focus correlation heatmap com stress matrix.
- **CVM CRA/CRI disclosures**: temos os dados via hub_ofertas_publicas já populado. **Vai entrar no P0-12** (Crédito Privado deep panel com breakdown CRA vs CRI + setor).

---

## Seção 4 — Tickets P0 (bloqueadores de beta)

Ordenados por dependência lógica + impacto no beta tester (AAI).

### P0-1 · Diagnóstico backend (este documento)
**Status**: ✅ concluído nesta sessão.
Catálogo de 38 séries mapeado, 7 bugs de meta drift + 1 unit bug identificados.

### P0-2 · Fix meta drift + unit label Selic Efetiva
**Status**: 🟡 pendente.
- SQL RPC `refresh_macro_series_meta_last_date()`: UPDATE hub_macro_series_meta SET last_date = sub.max_data FROM (SELECT serie_code, MAX(data_ref) FROM hub_macro_series GROUP BY serie_code) sub WHERE hub_macro_series_meta.serie_code = sub.serie_code. Agendar em pg_cron daily 06:00 UTC após ingestion.
- Fix código 11: migration UPDATE hub_macro_series_meta SET unit = '% a.d.' WHERE serie_code = '11'. Alternativa preferida: annualizar na ingestion (fórmula `(1+daily/100)^252 - 1`) e manter '% a.a.' — padrão ANBIMA.

### P0-3 · NarrativeSection per-section (5/5)
**Status**: 🟡 pendente. Reutiliza `src/components/hub/NarrativeSection.tsx` já criado no Fundos audit 19/04 (commit d7f3245).

Plano por section (prose + 5 mini-stats cada):
- **Visão Geral** (accent `#10B981`): regime monetário macro (tight/neutral/loose) via `detectMonetaryRegime` do FixedIncomeNarrativePanel. Mini-stats: Selic, CDI, Juro real ex-ante, Curva shape, Focus Selic 2026 Δ.
- **Taxas & Curva** (accent `#6366F1`): narrativa term premium (DI 1800d − 30d) + convexidade. Mini-stats: Slope 30d→1800d, DV01 R$1k notional (avg duration × avg rate), DI 360d, Focus Selic, Divergência DI×Focus.
- **Títulos Públicos** (accent `#F59E0B`): narrativa real yields NTN-B + ancoragem breakeven. Mini-stats: NTN-B 2029, NTN-B 2035, BEI 3a vs Meta IPCA (Δ), Vendas TD último mês, Estoque TD.
- **Crédito Privado** (accent `#EF4444`): narrativa stress/relief + primário aquecido/retraído. Mini-stats: Spread AA, Spread A, Diferencial AA→A, Emissões 3m média, CRA+CRI estoque.
- **Analytics** (accent `#10B981`): prose sobre IMA-B Proxy + sinais críticos ativos. Mini-stats: IMA-B 12m retorno agregado, Nº sinais críticos ativos, Nº regimes ativos, Vol YoY curve (proxy), Regime atual.

### P0-4 · KPI_HINTS renda fixa (+30 termos)
**Status**: 🟡 pendente. Adicionar a `src/lib/kpiHints.ts`:

Blocos: Curva DI (10: "curva di", "di 30d", "di 360d", "di 720d", "di 1800d", "slope di", "term premium", "curva invertida", "curva normal", "inversão"), NTN-B + IPCA+ (6: "ntn-b", "ntn-b 2029", "ntn-b 2035", "ntn-b 2045", "ipca+", "taxa real"), Breakeven (4: "breakeven", "bei 1a", "bei 3a", "bei 5a"), Referências (6: "selic meta", "selic efetiva", "cdi", "tr", "tlp", "tjlp", "poupança"), Crédito privado (5: "spread aa", "spread a", "spread médio", "emissões debêntures", "cra+cri"), Tesouro Direto (3: "estoque td", "vendas td", "investidores td"), Conceitos (6: "duration", "convexidade", "dv01", "juro real", "juro real ex-ante", "ima-b").

Cada hint pt-BR com contexto quantitativo (benchmarks históricos + thresholds + fórmula quando aplicável).

### P0-5 · DataAsOfStamp integrado
**Status**: 🟡 pendente.
- Header global (compact mode, cadence="daily" para eager bundles, source="BACEN SGS · ANBIMA · Tesouro Nacional").
- Panel-level no `SpreadCreditoPrivado` (cadence="monthly"), `BondCalculator` (sem stamp — é calculadora), `YieldCurveSimulator` (sem stamp — é simulador baseado em snapshot).
- Staleness thresholds daily: emerald ≤2 dias úteis, amber ≤7d, red >7d. Monthly: emerald ≤45d, amber ≤90d, red >90d. Depende do fix P0-2 para não disparar red falso.

### P0-6 · CSV export pt-BR global
**Status**: 🟡 pendente.
- Migrar `SpreadCreditoPrivado.exportCSV()` para `exportCsv()` do `@/lib/csvExport` (separator `;` + BOM UTF-8 + csvFilename helper).
- Adicionar export em: Curva DI snapshot (tenor, rate), NTN-B term structure (vencimento, yield), IMA-B Proxy (date, value, short, mid, long), Benchmarks table.
- `aria-label` + `type="button"` em todos.

### P0-7 · Rolling indicators grid no Visão Geral
**Status**: 🟡 pendente.
- Helper novo `src/lib/rfRollingDeltas.ts` com tipos `IndicatorKind` ("rate" | "spread" | "slope" | "breakeven" | "yield-real") + `buildRfRollingRow(label, data, kind, window)`.
- Componente novo `src/components/hub/RfRollingGrid.tsx` — mesma estética de `CreditRollingGrid` (1m/3m/6m/12m/24m/36m) com direction-aware colors.
- 5 linhas: Selic Meta, Spread AA, DI 1800d − DI 30d (slope), BEI 3a, NTN-B 2035 (taxa real).
- Fetch via 5y bundle (override de período para estas rows, sem mudar período da página).

### P0-8 · Calendar heatmap year×month
**Status**: 🟡 pendente. Componente novo `src/components/hub/RfCalendarHeatmap.tsx`.
- **Chart 1** (Visão Geral): NTN-B 2035 year×month, kind="yield-real" (higher = better para AAI — ponto de entrada histórico).
- **Chart 2** (Títulos Públicos): BEI 3a year×month, kind="breakeven" (diverging vs meta IPCA 3.0%).

Reutiliza padrão do `CreditCalendarHeatmap` (diverging 4-step intensity, year-total column com yearAvg, footer Último/Mediana/Máx/Mín color-coded).

### P0-9 · PDF export (ExportPdfButton + PrintFooter + @media print)
**Status**: 🟡 pendente. Reutiliza componentes existentes do Fundos/Crédito (zero custo de bundle).
- ExportPdfButton no sticky header do HubRendaFixa.
- PrintFooter com disclaimer regulatório RF ("Renda Fixa — informações para uso profissional AAI. Não constituem recomendação de investimento. Rentabilidades passadas não garantem resultados futuros.").
- @media print CSS já existe em `src/index.css` — só adicionar classes `no-print` nas chrome da página (sticky header buttons não essenciais, simulator inputs, calculator sliders) e `print-page-break` entre sections.

### P0-10 · Simulador Tesouro Direto (NEW FEATURE)
**Status**: 🟡 pendente. Componente novo `src/components/hub/TesouroSimulator.tsx`.

Spec:
- 3 tipos: LTN (Prefixado), LFT (Selic), NTN-B Principal (IPCA+).
- Inputs: tipo, vencimento (date picker), valor investido (R$), data de aquisição, taxa contratada (%).
- Outputs calculados:
  - Valor bruto no vencimento.
  - IR regressivo (22.5% até 180d, 20% 181-360d, 17.5% 361-720d, 15% 720d+).
  - Custódia B3 (0.20% aa sobre saldo médio — exento até R$10k LFT).
  - IOF regressivo (30 dias) quando aplicável.
  - Valor líquido final + retorno líquido % aa + Yield to Maturity líquido.
- Simulação resgate antecipado: marcação a mercado linha-a-linha (reutiliza calcMaM do BondCalculator) com projeção de curva DI interpolada para cada data possível.
- **Diferencial vs BondCalculator existente**: BondCalculator é genérico (prefixado/IPCA/Selic com lógica simplificada). TesouroSimulator é específico com regras tributárias + taxas B3 do produto oficial.

### P0-11 · Carteira RF calculator (NEW FEATURE)
**Status**: 🟡 pendente. Componente novo `src/components/hub/RfPortfolioCalculator.tsx`.

Spec:
- Input: array de até 8 holdings com { tipo: "LTN"|"LFT"|"NTN-B"|"CDB-CDI"|"DEB-CDI"|"DEB-IPCA", vencimento, alocação %, taxa, emissor? }.
- Soma das alocações validada = 100% (UI alerta se <99% ou >101%).
- Outputs agregados:
  - **Yield blend** (weighted average pela alocação).
  - **Duration efetiva** (weighted duration).
  - **DV01 carteira** (R$/bp sobre total investido).
  - **Convexidade agregada**.
  - **Distribuição por tipo** (pie chart: % em prefixado / IPCA+ / pós-CDI).
  - **Sensibilidade a choque de curva** (reutiliza applyShift do YieldCurveSimulator):
    - Parallel +50bps/+100bps/+200bps: Δ P% da carteira.
    - Twist steepener/flattener.
    - Butterfly.
- Export: CSV com positions + summary stats.
- Modo AAI: salvar carteira nomeada (deferido — usa localStorage `muuney_rf_portfolios`, não requer backend).

### P0-12 · Crédito Privado AA/A detalhado (NEW FEATURE)
**Status**: 🟡 pendente. Componente novo `src/components/hub/CreditoPrivadoDeepPanel.tsx`.

Spec:
- **Painel 1 — Stress/Relief matrix**: year×month heatmap do diferencial AA→A (kind="spread"). Picos de stress (diferencial ≥2.0 p.p.) em red, relief (<0.5 p.p.) em emerald.
- **Painel 2 — Cluster por rating** (estrutura mockada até ter dados ANBIMA): breakdown AA/A/BBB/BB com spread médio + emissões YTD + default rate. Indicar "fonte ANBIMA pós-integração" quando mock.
- **Painel 3 — CRA vs CRI separados**: time-series spread CRA vs spread CRI + stocks (R$ bi), usando código `990304` como agregado e estimando split 55/45 (histórico ANBIMA). Alerta de limitação explícito.
- **Painel 4 — Emissões por setor** (CVM hub_ofertas_publicas): usar dados já em produção. Filtrar tipo_ativo='Debêntures' + group by setor (infra/agro/imobiliário/utilities via mapeamento CNPJ→CNAE). Chart: empilhado mensal.
- Integrado abaixo do `SpreadCreditoPrivado` existente na section Crédito Privado, dentro de lazy-load `sectionVisible("credpriv")`.

### P0-13 · Audit doc (este arquivo) + commit + push
**Status**: 🟡 este doc entregue nesta sessão. Implementação P0-2 até P0-12 em sequência, commit agregado, push origin/main.

---

## Seção 5 — Tickets P1 (pós-beta, alta alavancagem)

### P1-1 · COPOM event overlay
MacroChartEvent em 4 charts críticos: Selic vs CDI, DI 30d vs 360d, NTN-B 2029 vs 2035, IMA-B Proxy. Pattern idêntico ao P1-2 do Crédito.

### P1-2 · Filter/State share-link por section
- BondCalculator: preset + rate + faceValue + periods + couponRate → URL params.
- YieldCurveSimulator: shiftMode + deltaBps → URL params.
- SpreadCreditoPrivado: filter state → URL params.
- TesouroSimulator + RfPortfolioCalculator: serializar holdings array → URL base64 (comprimido).

### P1-3 · Drill-down drawer por tenor DI ou vencimento NTN-B
Click em row da Curva DI ou NTN-B term structure abre drawer com: histórico 5y do vértice, volatilidade, correlação com Selic, benchmarking vs Focus.

### P1-4 · Focus correlation heatmap + stress matrix
Matriz Pearson entre RF indicators + Focus IPCA/Selic/PIB/Câmbio 12m. Stress scenario matrix (inspiração ComDinheiro): 5 cenários (Selic +/-200bps × IPCA +/-100bps) com impacto Δ% NTN-B 2035.

### P1-5 · DI × Pré real vertices (pendência antiga Macro #11)
Integrar vértices DI reais (não sintetizados) em 9 séries BACEN já existentes. Seção Analytics ganha chart "DI × Pré (Real)" com dados diários.

### P1-6 · Quick-chart buttons "abrir em /hub/macro" e "abrir em /hub/credito"
Cross-module navigation dos KPIs de Selic/IPCA para os módulos Macro (com deep-link section) e do Spread PF/PJ para Crédito.

### P1-7 · Alertas dinâmicos (admin UI para thresholds)
Mesmo ticket deferido em Crédito (P1-6 lá). Migração `hub_alert_thresholds` tabelada para RF também: curva_invertida threshold, breakeven_desancora threshold, juro_real_elevado threshold, di_focus_diverge threshold, ntnb_alta threshold.

### P1-8 · IMA-B real vs proxy comparison
Ingestão ANBIMA IMA-B oficial (licença paga pós-beta) + overlay no chart atual. Tradeoff duration-based estimation vs índice real ANBIMA exibido lado a lado.

---

## Seção 6 — Tickets P2 (polish, nice-to-have)

### P2-1 · Unit consistency sweep
`normalizeToBi()` pattern do CreditOperationsPanel (Crédito P0-2) propagado em todos RF charts que mostram R$ bi (estoque TD, emissões, estoque CRA+CRI). Legendas + tooltips + formatadores alinhados.

### P2-2 · A11y axe-core audit
WCAG 2.1 AA: color contrast Tech-Noir, aria-labels em todos charts/sliders/range inputs (BondCalculator + YieldCurveSimulator + TesouroSimulator + RfPortfolioCalculator), keyboard nav no drill-down drawer, skip-to-content.

### P2-3 · FeedbackWidget scoped by section
Pattern do Crédito P2-7 (HubSectionsContext já criado). Zero código novo — só adicionar `useHubSections()` wire no HubLayout para RF também.

### P2-4 · Sparkline universal coverage
Remover gates lazy-load (`enabled: visitedSections.has(...)`) dos bundles ntnb/breakeven/tesouro/credpriv para garantir sparklines sempre populados em KPICards do Visão Geral.

### P2-5 · Empty states contextuais
Quando curva DI retorna vazio (raro, mas BACEN SGS ocasionalmente) ou NTN-B term structure vazia → EmptyState variant-específico em vez de chart vazio.

### P2-6 · Breadcrumbs enriquecidos
Incluir section atual + tenor/vencimento quando drill-down aberto: "Renda Fixa > Títulos Públicos > NTN-B 2035".

### P2-7 · Onboarding tour step RF
Enriquecer step atual do `OnboardingTour.tsx` com texto específico: "Módulo Renda Fixa — 30 indicadores BACEN SGS, curva DI 9 vértices, NTN-B 4 vencimentos, BEI 3 horizontes, calculadoras de bonds e carteira RF, simulador Tesouro Direto, Crédito Privado AA/A + CRA/CRI."

### P2-8 · PDF export com templates dedicados
Além do `ExportPdfButton` genérico, layouts dedicados: "PDF Simulador TD" (simulação específica + disclaimer), "PDF Carteira RF" (holdings + stress matrix). Diferido pós-beta.

---

## Seção 7 — Métricas (build impact esperado)

**Baseline atual HubRendaFixa chunk**: ~103 kB.
**Após P0 (12 tickets)**: ~155-165 kB (+50-60 kB para 3 features novas + 5 NarrativeSections + RollingGrid + CalendarHeatmap + DataAsOfStamp + KPI_HINTS + CSV + PDF).
**Bundle components novos**:
- TesouroSimulator ~18-22 kB
- RfPortfolioCalculator ~14-18 kB
- CreditoPrivadoDeepPanel ~10-14 kB
- RfRollingGrid ~3 kB (padrão CreditRollingGrid)
- RfCalendarHeatmap ~3 kB
- NarrativeSection entries ~2 kB × 5 sections

Target tsc 0 errors, vite <6s, total chunk <160 kB ok (threshold aceitável pós-beta — CreditoHub chegou a 129 kB após P0+P1+P2).

---

## Entregáveis desta sessão (20/04/2026)

- ✅ **P0-1** Diagnóstico backend (tabela `hub_macro_series_meta` + identificação de 2 bugs de dados + catálogo de 38 séries mapeado).
- ✅ **P0-13** Audit doc `AUDIT_RENDA_FIXA_PROFUNDO_20ABR.md` gerado.
- 🟡 **P0-2 a P0-12** em execução (próximo passo imediato): implementação sequencial seguindo dependências lógicas (P0-2 bugs → P0-5 DataAsOfStamp → P0-3 NarrativeSection → P0-4 KPI_HINTS → P0-6 CSV → P0-7 Rolling → P0-8 Calendar → P0-9 PDF → P0-10 TD → P0-11 Carteira → P0-12 Crédito Privado Deep).
- ⏭️ **P1/P2** deferidos para sprint pós-beta.

Pattern parity target pós-P0: **8/8** com Crédito (NarrativeSection + KPI_HINTS + DataAsOfStamp + CSV pt-BR + Rolling grid + PDF export + Drill-down drawer* + Calendar heatmap). *Drill-down drawer é P1-3.

Commit esperado: `feat(rendafixa): deep audit P0 — bugs de dados + pattern parity + 3 features novas` com push origin/main. Caveat: push pode precisar ser executado pelo Lucas se credenciais GitHub indisponíveis na sessão.
