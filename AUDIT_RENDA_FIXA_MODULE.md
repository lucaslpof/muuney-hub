# Auditoria Módulo Renda Fixa (H1.3) — Plano de Ações

**Data:** 04/04/2026
**Batch:** 16
**Escopo:** Full audit — layout migration, charts v2, calculadoras v2, intelligence panel
**Referência:** Auditorias Macro (batch 14) e Crédito (batch 15) como baseline

---

## Diagnóstico Atual

| Métrica | Valor |
|---------|-------|
| Componentes | 3 (+ 1 página principal + YieldCurveSimulator) |
| Linhas totais | ~1,810 |
| Tabs | 8 subcategory tabs |
| Séries BACEN | 30 indicadores |
| Charts com MacroChart | ~12 |
| Charts com raw Recharts | ~4 (yield curve, BondCalculator, SpreadCreditoPrivado) |
| Error boundaries | 0 |
| Lazy-load | Nenhum |
| Deep-linking | Nenhum |
| Intelligence panel | Nenhum |
| Cross-signals | Nenhum |

---

## Plano de Ações (15 itens, 4 fases)

### Fase A — Consolidação Layout (8 tabs → 5 sections narrativas)

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 1 | Definir section map | 5 sections: **Visão Geral** (KPIs + taxas ref.), **Taxas & Curva** (DI curve + evolução vértices), **Títulos Públicos** (Tesouro + NTN-B + breakeven), **Crédito Privado** (spreads + emissões), **Analytics** (calculadora + correlação + intelligence) | CRÍTICA |
| 2 | Migrar HubRendaFixa.tsx | Scroll sections + MacroSection/MacroSidebar. Remover tab system, manter period global. | CRÍTICA |
| 3 | Sidebar navigation | Scroll-spy sidebar com highlight, mesmo padrão Macro/Crédito | ALTA |

**Mapeamento:**
```
Tab atual               → Section nova
────────────────────────────────────────
Visão Geral             → Visão Geral
Taxas de Referência     → Visão Geral (KPIs + charts taxas)
Curva de Juros          → Taxas & Curva
Tesouro Direto          → Títulos Públicos
NTN-B / IPCA+           → Títulos Públicos
Crédito Privado         → Crédito Privado
Calculadora             → Analytics
Analytics               → Analytics
```

### Fase B — Performance & Navigation

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 4 | Lazy-load por seção | IntersectionObserver + visitedSections. Bundles só carregam quando seção visitada. | ALTA |
| 5 | Deep-linking URL | useSearchParams(?section=&period=) | ALTA |
| 6 | Error boundaries | SectionErrorBoundary em cada seção | MÉDIA |
| 7 | Migrar para useHubSeriesBundle | Substituir ~15 useHubSeries individuais por bundles agrupados por categoria | ALTA |

### Fase C — Charts v2

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 8 | Yield curve → MacroChart v2 | Migrar snapshot e evolução temporal para MacroChart v2 com auto-scale, reference lines (Focus Selic, corredor política) | ALTA |
| 9 | Overlays em todos os charts | SMA/EMA/Trend nos time-series (taxas ref., NTN-B, breakeven, spreads) | MÉDIA |
| 10 | Reference lines | Selic meta nos charts de taxa, Meta IPCA nos breakevens, Focus expectations na curva | MÉDIA |

### Fase D — Calculadoras v2 & Intelligence Panel

| # | Ação | Descrição | Prioridade |
|---|------|-----------|------------|
| 11 | BondCalculator v2 | Convexidade, cenários comparativos (3 títulos lado a lado), evolução saldo com chart, sensitivity heatmap (taxa × prazo), presets expandidos | ALTA |
| 12 | YieldCurveSimulator v2 | Parallel shift + twist + butterfly, DV01 estimado, comparação com Focus expectativas, nice Y-axis | MÉDIA |
| 13 | SpreadCreditoPrivado v2 | Regime crédito privado, cross-signals (spread×Selic, emissões momentum, rating migration), CSV export | MÉDIA |
| 14 | FixedIncomeNarrativePanel | Regime monetário (Aperto/Neutro/Afrouxamento/Transição) baseado em curva shape + Focus + Selic. Cross-signals: curva×inflação, spread×Selic, NTN-B breakeven vs IPCA realizado, fluxo TD, convergência DI×Focus | ALTA |
| 15 | InsightCards dinâmicos | MacroInsightCard nas seções Taxas & Curva, Títulos Públicos e Crédito Privado | MÉDIA |

---

## Definição de Regimes Monetários (Ação #14)

```
detectMonetaryRegime(selicMeta, focusSelic, curvaShape, spreadAA, breakeven1a, ipca12m):
  - Aperto Agressivo:   selicMeta > 13% && focusSelic > selicMeta && curvaShape == "Invertida"
  - Aperto Moderado:    selicMeta > 11% && focusSelic >= selicMeta
  - Neutro:             abs(focusSelic - selicMeta) < 0.5 && curvaShape == "Normal"
  - Afrouxamento:       focusSelic < selicMeta - 1.0 && curvaShape == "Normal"
  - Stress Crédito:     spreadAA > 2.0 && breakeven1a > ipca12m + 1.5
  - Transição:          default
```

## Cross-Signals Renda Fixa

```
1. Curva × Inflação: curva invertida + breakeven rising → sinal recessivo com inflação persistente
2. Spread × Selic: spreadAA comprimindo enquanto Selic sobe → subprecificação de risco
3. NTN-B Breakeven vs IPCA: breakeven 1a > IPCA 12m + 1.5 → mercado precifica aceleração inflacionária
4. Fluxo Tesouro Direto: vendas líquidas negativas → sinal de aversão a risco
5. Convergência DI × Focus: vértice 360d convergindo para Focus Selic → mercado alinhado ao consenso
6. Term Premium: spread 5a-1a comprimindo → incerteza de longo prazo reduzindo
```

---

## Changelog

### Fase A — Layout Migration (04/04/2026)
- ✅ #1 Section map: 8 tabs → 5 sections (Visão Geral, Taxas & Curva, Títulos Públicos, Crédito Privado, Analytics)
- ✅ #2 HubRendaFixa.tsx reescrito: scroll sections + MacroSection/MacroSidebar
- ✅ #3 Sidebar navigation integrada

### Fase B — Performance & Navigation (04/04/2026)
- ✅ #4 Lazy-load: IntersectionObserver + visitedSections Set (7 bundles, 3 lazy: ntnb/breakeven/tesouro + credpriv)
- ✅ #5 Deep-linking: useSearchParams(?section=&period=)
- ✅ #6 SectionErrorBoundary em cada seção
- ✅ #7 Migração para useHubSeriesBundle (taxa_ref, curva_di, ntnb, breakeven, tesouro, poupanca, credpriv)

### Fase C — Charts v2 (04/04/2026)
- ✅ #8 MacroChart v2 em todos os charts incluindo yield curve snapshot e NTN-B term structure (auto-scale, SMA/EMA/Trend overlays, CSV/PNG export)
- ✅ #9 Overlays SMA/EMA/Trend disponíveis via MacroChart v2
- ✅ #10 Reference lines: Selic Meta na curva DI, 70% Selic na poupança, Média Histórica nos NTN-B, Meta IPCA nos breakevens

### Fase D — Intelligence (04/04/2026)
- ✅ #11 BondCalculator v2: convexidade, comparador 3 títulos (Curto/Médio/Longo), heatmap sensibilidade (5 rates × 6 terms), ΔP/Δy estimado
- ✅ #12 YieldCurveSimulator v2: 3 modos (Parallel/Twist/Butterfly), DV01 estimado, comparação com Focus expectations, nice Y-axis
- ✅ #13 SpreadCreditoPrivado v2: regime detection (Stress/Complacência/Expansão/Retração/Neutro), 4 cross-signals, CSV export
- ✅ #14 FixedIncomeNarrativePanel: 6 regimes monetários (Aperto Agressivo/Moderado, Neutro, Afrouxamento, Stress Crédito, Transição), 8 cross-signals (Curva×Inflação, Spread×Selic, Breakeven vs IPCA, Fluxo TD, DI×Focus, Term Premium, Juro Real, Breakeven Desancoragem)
- ✅ #15 MacroInsightCard dinâmicos nas seções Taxas & Curva, Títulos Públicos e Crédito Privado

**Status: 15/15 ações concluídas — Auditoria Renda Fixa 100% ✅**
