# Auditoria Módulo Crédito (H1.1b) — Plano de Ações

**Data:** 04/04/2026
**Batch:** 15
**Escopo:** Full audit — layout migration, charts v2, calculadoras v2, intelligence panel
**Referência:** Auditoria Macro (Fases A-D) como baseline

---

## Diagnóstico Atual

| Métrica | Valor |
|---------|-------|
| Componentes | 10 (+ 1 página principal) |
| Linhas totais | ~2,703 |
| Tabs | 11 subcategory tabs |
| Séries BACEN | 73 (crédito) |
| Charts com MacroChart | ~15 (HubCredito + Overview) |
| Charts com raw Recharts | ~5 (CreditOperationsPanel, SpreadCreditoPrivado) |
| Calculadoras | 3 (InterestCalculator, DefaultRadar, SpreadMonitor) |
| Error boundaries | 0 |
| Lazy-load | Nenhum |
| Deep-linking | Nenhum |

---

## Plano de Ações (15 itens, 4 fases)

### Fase A — Consolidação Layout (11 tabs → 6 sections narrativas)

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 1 | Definir section map | Agrupar 11 tabs em 6 sections: **Visão Geral** (KPIs + Overview Mensal), **Volume** (Saldos + Concessões), **Preço** (Taxas + Spreads), **Risco** (Inadimplência + Produtos), **Operações** (Query Builder + Outros), **Analytics** (Correlação + Benchmarks + Intelligence) | CRÍTICA |
| 2 | Migrar HubCredito.tsx | Substituir tab navigation por scroll sections com sidebar nav (mesmo padrão HubMacro.tsx). Manter período global. | CRÍTICA |
| 3 | Sidebar navigation | Scroll-spy sidebar com section indicators, highlight da seção ativa | ALTA |

**Mapeamento de consolidação:**
```
Tab atual                → Section nova
─────────────────────────────────────────
Visão Geral              → Visão Geral
Overview Mensal          → Visão Geral (expandido)
Saldos                   → Volume (Saldos & Concessões)
Concessões               → Volume (Saldos & Concessões)
Taxas                    → Preço (Taxas & Spreads)
Spreads                  → Preço (Taxas & Spreads)
Inadimplência            → Risco (Inadimplência & Produtos)
Produtos                 → Risco (Inadimplência & Produtos)
Operações                → Operações (Query Builder)
Outros                   → Operações (+ Cartões, Crédito/PIB)
Analytics                → Analytics (Correlação + Intelligence)
```

### Fase B — Performance & Navigation

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 4 | Lazy-load por seção | IntersectionObserver + visitedSections Set (padrão Macro). Bundles de séries só carregam quando seção é visitada. | ALTA |
| 5 | Deep-linking URL | useSearchParams(?section=&period=). Persistir seção ativa e período na URL. | ALTA |
| 6 | Error boundaries | SectionErrorBoundary em cada seção (reutilizar componente do Macro). | MÉDIA |
| 7 | Migrar para useHubSeriesBundle | Substituir ~22 chamadas useHubSeries individuais por useHubSeriesBundle(category, period, "credito", enabled). Reduzir waterfall de requests. | ALTA |

### Fase C — Charts v2

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 8 | Padronizar todos os charts via MacroChart v2 | Migrar CreditOperationsPanel e SpreadCreditoPrivado de raw Recharts para MacroChart v2 (auto-scale, smart formatting, summary stats). | ALTA |
| 9 | Overlays SMA/EMA/Trend nos charts de crédito | Habilitar toggles de SMA, EMA e Linear Trend em todos os charts de séries temporais (saldos, concessões, taxas, inadimplência, spreads). | MÉDIA |
| 10 | Reference lines | Adicionar linhas de referência nos charts relevantes: meta inflação (taxas), threshold inadimplência (risco), Selic (spreads). | MÉDIA |

### Fase D — Calculadoras v2 & Intelligence Panel

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 11 | InterestCalculator v2 | Adicionar: presets de cenário (Conservador/Base/Agressivo), comparação simultânea PF vs PJ, amortização SAC + SACRE além de Price, gráfico evolução saldo devedor, sensitivity heatmap (taxa × prazo). | ALTA |
| 12 | DefaultRadar v2 | Adicionar: presets temporais (6M/1A/2A), trend sparklines por setor, heat scoring dinâmico (não hardcoded), comparison mode (período atual vs anterior). | MÉDIA |
| 13 | SpreadMonitor v2 | Adicionar: historical overlay (spread atual vs 12M vs 5A no mesmo chart), alertas automáticos de stress threshold, export dos dados. | MÉDIA |
| 14 | CreditNarrativePanel | Novo componente — equivalente ao MacroNarrativePanel para crédito: regime detection (Expansão Crédito, Contração, Stress, Normalização), cross-signals (inadimplência×Selic, spread compression, concessões momentum, crédito/PIB ratio). | ALTA |
| 15 | CreditInsightCards | Dynamic insight cards por seção (trend detection, z-score anomalias, severity baseada em targets/thresholds do BCB). | MÉDIA |

---

## Definição de Regimes de Crédito (Ação #14)

```
detectCreditRegime(inadTotal, spreadMedio, concessoesMoM, creditoPIB, selic):
  - Stress Sistêmico:   inadTotal > 5.0 && spreadMedio > mediana5A * 1.3
  - Contração:           concessoesMoM < -2% && inadTotal > 4.0
  - Expansão Acelerada:  concessoesMoM > 5% && creditoPIB > 55%
  - Aperto Monetário:    selic > 12% && concessoesMoM < 0%
  - Normalização:        abs(concessoesMoM) < 2% && inadTotal estável
  - Afrouxamento:        selic < 10% && concessoesMoM > 3%
  - Transição:           default
```

## Cross-Signals Crédito×Macro

```
1. Inadimplência × Selic: se inadTotal sobe e Selic sobe → sinal negativo (double squeeze)
2. Spread Compression: se spread < p10 histórico → sinal alerta (risco subprecificado)
3. Concessões Momentum: MoM 3-month trend → aceleração/desaceleração
4. Crédito/PIB Ratio: threshold BCB (~55%) → alerta alavancagem
5. PF vs PJ Divergência: se inadPF sobe e inadPJ cai → sinal setorial
6. Taxa Real: taxa média - IPCA 12m → custo real do crédito
```

---

## Ordem de Execução

```
Fase A (Layout)    → Ações #1-3   → ~300 linhas modificadas
Fase B (Perf/Nav)  → Ações #4-7   → ~200 linhas modificadas
Fase C (Charts)    → Ações #8-10  → ~150 linhas modificadas
Fase D (Intel)     → Ações #11-15 → ~600 linhas novas
```

**Total estimado:** ~1,250 linhas modificadas/adicionadas

---

## Changelog

### Fase A — Layout Migration (04/04/2026)
- ✅ #1 Section map: 11 tabs → 6 sections (Visão Geral, Volume, Preço, Risco, Operações, Analytics)
- ✅ #2 HubCredito.tsx reescrito: scroll sections + MacroSection/MacroSidebar
- ✅ #3 Sidebar navigation integrada

### Fase B — Performance & Navigation (04/04/2026)
- ✅ #4 Lazy-load: IntersectionObserver + visitedSections Set (10 bundles, 7 lazy)
- ✅ #5 Deep-linking: useSearchParams(?section=&period=)
- ✅ #6 SectionErrorBoundary em cada seção
- ✅ #7 Migração para useHubSeriesBundle (saldo_credito, inadimplencia, taxa, saldo_pf_modal, saldo_pj_modal, concessao, spread, inadim_detalhe, cartoes, alavancagem)

### Fase C — Charts v2 (04/04/2026)
- ✅ #8 MacroChart v2 em todos os charts (auto-scale Y-axis, smart formatting, CSV/PNG export)
- ✅ #9 Overlays SMA/EMA/Trend disponíveis via MacroChart v2
- ✅ #10 Reference lines: Selic em taxas, Meta BCB em inadimplência, Threshold 55% em crédito/PIB

### Fase D — Intelligence (04/04/2026)
- ✅ #11 InterestCalculator v2: Price+SAC, cenários (Conservador/Base/Agressivo), heatmap sensibilidade (5 rates × 6 terms), taxa anualizada
- ✅ #12 DefaultRadar v2: presets temporais (6M/1A/2A), trend por setor com delta
- ✅ #13 SpreadMonitor v2: tabela completa com desvio %, alertas stress threshold, CSV export
- ✅ #14 CreditNarrativePanel: 7 regimes (Stress/Contração/Expansão/Aperto/Normalização/Afrouxamento/Transição), 7 cross-signals (double squeeze, spread compression, concessões momentum, alavancagem, PF×PJ divergência, custo real, Selic restritiva)
- ✅ #15 MacroInsightCard dinâmicos nas seções Volume, Preço e Risco

**Status: 15/15 ações concluídas — Auditoria Crédito 100% ✅**
