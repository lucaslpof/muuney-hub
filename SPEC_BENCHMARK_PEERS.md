# Muuney.hub — Benchmark Competitivo vs Peers

> Compilado: 12/04/2026 | Peers: fidcs.com.br, Mais Retorno, Quantum Finance, Anbima Data
> Método: Feature matrix 0-5 por dimensão × módulo. Score = média ponderada.
> Objetivo: Identificar gaps e implementar catch-up para superioridade comprovada.

---

## Legenda de Scoring

| Score | Significado |
|-------|-------------|
| 0 | Não oferece |
| 1 | Dados brutos sem contexto |
| 2 | Dados + filtros básicos |
| 3 | Dados + filtros + visualizações |
| 4 | Dados + analytics + insights computados |
| 5 | Intelligence layer (regime, signals, narrativa, alertas automatizados) |

---

## 1. Módulo Ofertas Públicas

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Pipeline CVM (160/400/476) | 4 | 3 | 0 | 1 | 2 |
| Timeline mensal | 4 | 2 | 0 | 0 | 1 |
| Explorer multi-filtro | 4 | 2 | 0 | 0 | 1 |
| KPIs agregados | 4 | 2 | 0 | 0 | 2 |
| Regime detection | 5 | 0 | 0 | 0 | 0 |
| Cross-signals | 5 | 0 | 0 | 0 | 0 |
| Narrativa contextual | 4 | 0 | 0 | 0 | 0 |
| HHI / concentração | 4 | 0 | 0 | 0 | 0 |
| Top emissores ranking | 4 | 2 | 0 | 0 | 1 |
| Detalhe por oferta (drawer) | 4 | 3 | 0 | 0 | 1 |
| Exportação (CSV/PDF) | 1 | 3 | 0 | 0 | 2 |
| Alertas novas ofertas | 0 | 0 | 0 | 0 | 0 |
| Histórico de pricing/rating | 0 | 1 | 0 | 2 | 1 |
| Coordenador analytics | 0 | 2 | 0 | 1 | 1 |
| **Média** | **3.1** | **1.3** | **0.0** | **0.3** | **0.8** |

### Gaps Muuney (Ofertas):
- **G-O1**: Exportação CSV/PDF das tabelas e charts → prioridade média
- **G-O2**: Alertas de novas ofertas (push/email quando nova oferta aparece) → prioridade alta (diferenciador)
- **G-O3**: Histórico de pricing/rating por emissor → prioridade baixa (requer dados adicionais)
- **G-O4**: Coordenador analytics (ranking de coordenadores por volume, success rate) → prioridade média
- **G-O5**: Comparação YoY (mesmo período ano anterior) → prioridade média

---

## 2. Módulo FIDC

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Catálogo fundos | 5 | 4 | 2 | 3 | 3 |
| Lâmina detalhada | 5 | 4 | 1 | 3 | 0 |
| Rankings sortable | 5 | 3 | 2 | 3 | 1 |
| Screener multi-filtro | 4 | 1 | 0 | 2 | 0 |
| Subordinação/risco | 4 | 3 | 0 | 2 | 2 |
| Inadimplência tracking | 4 | 3 | 0 | 3 | 2 |
| Lastro segmentation | 4 | 2 | 0 | 1 | 3 |
| Série temporal mensal | 4 | 3 | 0 | 3 | 1 |
| Rentabilidade indexada | 3 | 2 | 1 | 3 | 0 |
| Regime detection | 5 | 0 | 0 | 0 | 0 |
| Cross-signals (FIDC×Macro) | 5 | 0 | 0 | 0 | 0 |
| Fundos similares | 4 | 0 | 0 | 0 | 0 |
| Composição carteira (CDA) | 3 | 2 | 0 | 2 | 0 |
| Exportação dados | 1 | 3 | 0 | 3 | 2 |
| Benchmark vs CDI | 0 | 2 | 0 | 3 | 0 |
| Fluxo de cotistas | 0 | 1 | 0 | 2 | 1 |
| **Média** | **3.5** | **2.1** | **0.4** | **1.9** | **0.9** |

### Gaps Muuney (FIDC):
- **G-F1**: Benchmark vs CDI (rentabilidade relativa ao CDI acumulado) → prioridade ALTA
- **G-F2**: Fluxo de cotistas (captação líquida, entradas/saídas) → prioridade alta
- **G-F3**: Exportação CSV das tabelas → prioridade média
- **G-F4**: Rentabilidade indexada base 100 na lâmina FIDC → prioridade média (já existe em FundLamina genérica)

---

## 3. Módulo Macro

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Séries BACEN SGS | 5 | 0 | 1 | 2 | 1 |
| Focus Expectativas | 5 | 0 | 0 | 1 | 0 |
| Regime detection (7 regimes) | 5 | 0 | 0 | 0 | 0 |
| Cross-signals macro | 5 | 0 | 0 | 0 | 0 |
| COPOM/FOMC overlay | 5 | 0 | 0 | 1 | 0 |
| Correlation matrix | 5 | 0 | 0 | 2 | 0 |
| Inflation calculator | 5 | 0 | 1 | 0 | 0 |
| Fiscal calculator | 5 | 0 | 0 | 0 | 0 |
| Yield curve simulator | 5 | 0 | 0 | 2 | 2 |
| SMA/EMA/Trend overlays | 5 | 0 | 0 | 3 | 0 |
| Deep-linking por seção | 5 | 0 | 0 | 0 | 0 |
| Health Index indicadores | 4 | 0 | 0 | 0 | 0 |
| Exportação CSV/PNG | 3 | 0 | 0 | 3 | 1 |
| Alertas macro (notif.) | 0 | 0 | 0 | 0 | 0 |
| **Média** | **4.4** | **0.0** | **0.1** | **1.0** | **0.3** |

### Gaps Muuney (Macro):
- **G-M1**: Alertas macro automáticos (email/push quando indicador cruza threshold) → prioridade alta (diferenciador)
- **G-M2**: PDF export de seções → prioridade média (pendente Macro #15)

---

## 4. Módulo Crédito

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Saldos SFN/PF/PJ | 5 | 0 | 0 | 1 | 1 |
| Concessões + MoM | 5 | 0 | 0 | 1 | 1 |
| Taxas PF/PJ/Veículos | 5 | 0 | 0 | 1 | 0 |
| Inadimplência tracking | 5 | 0 | 0 | 1 | 0 |
| Spreads + stress index | 5 | 0 | 0 | 1 | 0 |
| Regime detection | 5 | 0 | 0 | 0 | 0 |
| Cross-signals | 5 | 0 | 0 | 0 | 0 |
| Interest calculator | 5 | 0 | 1 | 0 | 0 |
| Credit product panel | 4 | 0 | 0 | 0 | 0 |
| Operations query builder | 4 | 0 | 0 | 0 | 0 |
| Heatmap modalidades | 4 | 0 | 0 | 0 | 0 |
| Alertas crédito | 0 | 0 | 0 | 0 | 0 |
| **Média** | **4.3** | **0.0** | **0.1** | **0.4** | **0.2** |

### Gaps Muuney (Crédito):
- **G-C1**: Alertas automáticos de crédito (inadimplência sobe, spread stress) → prioridade alta

---

## 5. Módulo Renda Fixa

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Taxas referência | 5 | 0 | 1 | 2 | 3 |
| Curva DI (9 vértices) | 5 | 0 | 0 | 3 | 4 |
| NTN-B / Breakeven | 5 | 0 | 0 | 2 | 3 |
| Tesouro Direto dados | 4 | 0 | 1 | 1 | 1 |
| Crédito privado spreads | 4 | 0 | 0 | 2 | 2 |
| Bond calculator | 5 | 0 | 0 | 1 | 0 |
| Yield curve simulator | 5 | 0 | 0 | 2 | 2 |
| Regime detection | 5 | 0 | 0 | 0 | 0 |
| Cross-signals | 5 | 0 | 0 | 0 | 0 |
| IMA indices | 0 | 0 | 0 | 2 | 5 |
| IDkA indices | 0 | 0 | 0 | 2 | 5 |
| Alertas RF | 0 | 0 | 0 | 0 | 0 |
| **Média** | **3.6** | **0.0** | **0.2** | **1.3** | **2.1** |

### Gaps Muuney (Renda Fixa):
- **G-RF1**: IMA indices (IMA-Geral, IMA-B, IMA-S, IRF-M) → prioridade ALTA (Anbima API, benchmark padrão de mercado)
- **G-RF2**: IDkA indices (duration-keyed) → prioridade média (complementa IMA)
- **G-RF3**: Alertas RF (inversão de curva, breakeven desancoragem) → prioridade alta

---

## 6. Módulo Fundos (Geral + FII + FIP)

| Feature | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|---------|--------|-------------|-------------|---------|--------|
| Catálogo RCVM 175 | 5 | 0 | 2 | 3 | 3 |
| Lâminas detalhadas | 4 | 0 | 2 | 3 | 0 |
| Fund Score™ | 5 | 0 | 0 | 0 | 0 |
| Comparador cross-class | 5 | 0 | 3 | 3 | 0 |
| Screener multi-filtro | 4 | 0 | 2 | 3 | 0 |
| Rankings por categoria | 4 | 0 | 3 | 3 | 1 |
| InsightsFeed (alertas) | 5 | 0 | 0 | 0 | 0 |
| FII deep module | 4 | 0 | 1 | 2 | 1 |
| FIP deep module | 3 | 0 | 0 | 1 | 1 |
| Regime detection fundos | 5 | 0 | 0 | 0 | 0 |
| Composição CDA | 3 | 0 | 0 | 2 | 0 |
| Portfolio tracker | 3 | 0 | 1 | 0 | 0 |
| Fluxo captação/resgate | 0 | 0 | 1 | 3 | 3 |
| Benchmark vs índice | 0 | 0 | 2 | 3 | 2 |
| Exportação dados | 1 | 0 | 1 | 3 | 2 |
| **Média** | **3.4** | **0.0** | **1.2** | **1.9** | **0.9** |

### Gaps Muuney (Fundos):
- **G-FU1**: Fluxo captação/resgate (net flow por fundo e por classe) → prioridade ALTA
- **G-FU2**: Benchmark vs índice (CDI, IBOV, IMA-B) em lâminas → prioridade ALTA
- **G-FU3**: Exportação CSV das tabelas → prioridade média

---

## Score Consolidado (PRÉ catch-up — 12/04/2026 manhã)

| Módulo | Muuney | fidcs.com.br | Mais Retorno | Quantum | Anbima |
|--------|--------|-------------|-------------|---------|--------|
| Ofertas Públicas | **3.1** | 1.3 | 0.0 | 0.3 | 0.8 |
| FIDC | **3.5** | 2.1 | 0.4 | 1.9 | 0.9 |
| Macro | **4.4** | 0.0 | 0.1 | 1.0 | 0.3 |
| Crédito | **4.3** | 0.0 | 0.1 | 0.4 | 0.2 |
| Renda Fixa | **3.6** | 0.0 | 0.2 | 1.3 | 2.1 |
| Fundos | **3.4** | 0.0 | 1.2 | 1.9 | 0.9 |
| **MÉDIA GERAL** | **3.7** | **0.6** | **0.3** | **1.1** | **0.9** |

---

## Score Revisado (PÓS catch-up — 12/04/2026)

Features implementadas nesta sessão (sem fontes pagas/externas):

### Ofertas Públicas: 3.1 → 4.2 (+1.1)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Exportação CSV/PDF | 1 | 4 | CSV export Explorer + Top Emissores |
| Alertas novas ofertas | 0 | 3 | OfertasNarrativePanel com 7 signals automáticos |
| Coordenador analytics | 0 | 4 | Ranking coordenadores (volume, count, emissores distintos) |
| YoY comparison | — | 4 | Volume + count YoY no Timeline (quando ≥12 meses) |
| Narrativa contextual | 4 | 5 | Narrativa por seção (Overview, Timeline, Pipeline, Explorer) |

### FIDC: 3.5 → 4.2 (+0.7)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Exportação dados | 1 | 4 | CSV rankings export |
| Benchmark vs CDI | 0 | 4 | Narrativa comparativa (rentab senior vs CDI ~1.1%) |
| Fluxo de cotistas | 0 | 4 | Net flow proxy em FundLamina (ΔPL - rentab×PL) |
| Rentabilidade indexada | 3 | 4 | CDI benchmark line + vs CDI KPI em FundLamina |

### FII: 3.5 → 4.2 (+0.7)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Exportação dados | 1 | 4 | CSV rankings export |
| Benchmark vs CDI | 0 | 4 | Narrativa comparativa (rentab vs CDI ~1.1%) |

### Macro: 4.4 → 4.7 (+0.3)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Alertas macro | 0 | 4 | 4 alertas automáticos (Selic, IPCA, Focus, desemprego) |
| Health Index | 4 | 5 | Alertas complementam com severity-based assessment |

### Crédito: 4.3 → 4.7 (+0.4)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Alertas crédito | 0 | 4 | 4 alertas automáticos (inadim, spread, concessões, PIB) |

### Renda Fixa: 3.6 → 4.2 (+0.6)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| IMA indices | 0 | 3 | IMA-B proxy computado de NTN-B yields (sem Anbima API) |
| Alertas RF | 0 | 4 | 3 alertas (inversão curva, breakeven, juro real) |

### Fundos: 3.4 → 4.1 (+0.7)
| Feature | Antes | Depois | O que mudou |
|---------|-------|--------|-------------|
| Fluxo captação/resgate | 0 | 4 | Net flow proxy em FundLamina |
| Benchmark vs índice | 0 | 4 | CDI line + vs CDI KPI em FundLamina |
| Exportação dados | 1 | 4 | CSV export gestoras + screener |

### Score Consolidado Revisado

| Módulo | Antes | Depois | Delta | Status |
|--------|-------|--------|-------|--------|
| Ofertas Públicas | 3.1 | **4.2** | +1.1 | ✅ ≥4.0 |
| FIDC | 3.5 | **4.2** | +0.7 | ✅ ≥4.0 |
| Macro | 4.4 | **4.7** | +0.3 | ✅ ≥4.5 |
| Crédito | 4.3 | **4.7** | +0.4 | ✅ ≥4.5 |
| Renda Fixa | 3.6 | **4.2** | +0.6 | ✅ ≥4.0 |
| Fundos | 3.4 | **4.1** | +0.7 | ✅ ≥4.0 |
| **MÉDIA GERAL** | **3.7** | **4.35** | **+0.65** | ⚠️ abaixo de 4.5 |

### Para atingir média 4.5 (faltam +0.15):
- Ofertas 4.2→4.5: precisa alertas push reais (email/webhook) — requer Resend ativo
- FIDC 4.2→4.5: rentabilidade indexada base 100 na FidcLamina dedicada
- RF 4.2→4.5: IMA proxy 3→4 (adicionar retorno acumulado da proxy, não só estimativa pontual)
- Fundos 4.1→4.5: FIP deep polish (3→4), composição CDA enriquecida (3→4)

---

## Gaps Prioritários (Implementação Catch-up)

### P0 — Implementar AGORA (beta differentiators):
1. **Benchmark vs CDI** em lâminas FIDC/FII/Fundos (rentab relativa)
2. **Fluxo captação/resgate** (net flow computado de hub_fundos_diario — proxy: ΔPL - rentab×PL)
3. **Coordenador analytics** em Ofertas (ranking coordenadores por volume, count, taxa sucesso)
4. **CSV export** botão em todas as tabelas principais

### P1 — Implementar semana 2-3 beta:
5. **Alertas automáticos** cross-módulo (novas ofertas, macro threshold, FIDC stress, fund insights push)
6. **IMA indices** via Anbima API (IMA-B, IMA-S, IRF-M — require partnership check)
7. **YoY comparison** em Ofertas timeline

### P2 — Pós-beta:
8. **IDkA indices** (Anbima)
9. **Histórico pricing/rating** por emissor
10. **PDF export** de seções/lâminas

---

## Vantagens Exclusivas Muuney (Nenhum peer oferece):

1. **Regime Detection** — 7 regimes em cada módulo (Macro, Crédito, RF, Fundos, Ofertas)
2. **Cross-Signals** — 6-8 sinais cruzados por módulo com severity indicators
3. **Fund Score™** — Composite scoring 4 pilares (Rentab/Risco/Liquidez/Custos)
4. **InsightsFeed** — Alertas automatizados diários (PL drops, drawdowns, anomalias)
5. **COPOM/FOMC Event Overlay** — Decisões monetárias plotadas nos charts
6. **Narrative Panels** — Contextualização automática por regime
7. **Deep-linking** — Compartilhamento de seções específicas via URL
8. **Onboarding Tour** — Guided experience (7 steps)
9. **Feedback Widget** — Coleta contextual in-app
10. **Tech-Noir Aesthetic** — Identidade visual única no mercado BR
