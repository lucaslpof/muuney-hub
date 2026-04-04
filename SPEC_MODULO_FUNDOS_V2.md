# Muuney.hub — Módulo Fundos V2: Spec Completo

**Data:** 04/04/2026 · **Autor:** Lucas + Claude · **Status:** Draft para revisão

---

## 1. Visão Estratégica

O Módulo Fundos deve ser a referência de analytics para fundos brasileiros no ecossistema Muuney — equivalente ao que o fidcs.com.br faz para FIDCs e o painelfidc.com.br faz para panorama setorial, mas expandido para **todos os tipos de fundos** (FIDC, FII, FIP, multimercado, ações, RF) com camada analítica proprietária que agrega valor real sobre dados públicos CVM.

**Diferencial competitivo:** Não somos apenas um visualizador de dados CVM. Somos uma **camada de inteligência** que computa métricas derivadas, scores proprietários, alertas de mudança de regime e insights cross-module (integração com Macro e Crédito).

### 1.1 Benchmarks Analisados

**fidcs.com.br** — Referência para análise individual de FIDCs:
- Foco em 5 métricas-chave: subordinação, PDD/cobertura, taxa inadimplência, spread CDI, concentração
- Guia educacional com checklist pre-investimento
- Análise por tipo de cota (sênior vs subordinada vs mezanino)
- Rating como "termômetro de risco de crédito"
- Limitação: apenas FIDCs, sem cross-asset analytics

**painelfidc.com.br** — Referência para panorama setorial e inteligência regulatória:
- Database: 3.000+ FIDCs ativos com busca por gestor/admin/patrimônio/status
- Panorama: estatísticas consolidadas ANBIMA, evolução mercado, gráficos interativos
- Segmentação: 6 categorias de lastro (Agro, Imobiliário, Veículos, Cartão, Consignado, Outros)
- Busca semântica CVM: pesquisa inteligente em ofícios circulares e Resolução 175
- Taxonomia regulatória: navegação hierárquica de conceitos normativos
- Banco de Teses: guias de estruturação por setor
- Academia FIDC: conteúdo educacional especializado
- Limitação: dados ANBIMA agregados, sem métricas derivadas ou analytics preditivo

**Onde Muuney supera ambos:**
1. Multi-asset: FIDCs + FIIs + FIPs + todos os demais (não apenas FIDCs)
2. Score proprietário: Muuney Fund Score™ computado por tipo de fundo
3. Analytics preditivo: ARIMA, regime detection, anomaly alerts
4. Cross-module: insights cruzando fundos × macro × crédito × renda fixa
5. Dual-layer UX: interface retail (educativa) + pro (técnica) no mesmo produto
6. Composição carteira: drill-down asset-level via CDA (não apenas agregado)
7. Screening multi-dimensional: filtros combinados com ranked output + sparklines

---

## 2. Arquitetura de Dados CVM

### 2.1 Fontes de Dados Disponíveis

| Fonte CVM | Endpoint | Frequência | Conteúdo |
|-----------|----------|------------|----------|
| `cad_fi.csv` | Cadastro | Diário | Metadados: CNPJ, nome, classe, gestor, admin, taxas, benchmark, status |
| `inf_diario_fi_YYYYMM.zip` | Informe Diário | Diário (D+1) | Cota, PL, captação, resgate, nr cotistas |
| `perfil_mensal_fi_YYYYMM.csv` | Perfil Mensal | Mensal | Rentabilidade, captação líquida, benchmark, PL |
| `cda_fi_YYYYMM.zip` | CDA (Composição) | Mensal | **Portfolio asset-level**: 8 blocos (títulos públicos, cotas FI, swaps, CDB, agro, exterior, etc.) |
| `fidc-doc-inf_mensal` | FIDC Inf. Mensal | Mensal | **FIDC-específico**: subordinação, PDD, inadimplência, cedentes, lastro, classes |
| `fii-doc-inf_mensal` | FII Inf. Mensal | Mensal | **FII-específico**: ativos, passivos, dividendos, vacância, resultado financeiro |
| `fip-doc-inf_trimestral` | FIP Inf. Trimestral | Trimestral | **FIP-específico**: participações societárias, avaliação, governança |

### 2.2 Modelo de Dados (Supabase)

**Tabelas existentes:**
- `hub_fundos_meta` — Cadastro (cad_fi.csv)
- `hub_fundos_diario` — Informe diário (inf_diario)
- `hub_fundos_mensal` — Perfil mensal (perfil_mensal)

**Novas tabelas necessárias:**

```sql
-- Composição de carteira (CDA) — asset-level
CREATE TABLE hub_fundos_carteira (
  cnpj_fundo TEXT NOT NULL,
  dt_comptc DATE NOT NULL,
  tp_ativo TEXT NOT NULL,        -- bloco CDA (titulo_publico, cota_fi, swap, etc.)
  cd_ativo TEXT,                 -- código do ativo
  nm_ativo TEXT,                 -- nome/descrição
  vl_merc_pos_final NUMERIC,    -- valor de mercado posição final
  vl_custo_pos_final NUMERIC,   -- valor de custo posição final
  vl_perc_pl NUMERIC,           -- % do PL
  qt_pos_final NUMERIC,         -- quantidade
  PRIMARY KEY (cnpj_fundo, dt_comptc, tp_ativo, cd_ativo)
);

-- FIDC Informe Mensal — dados específicos FIDC
CREATE TABLE hub_fidc_mensal (
  cnpj_fundo TEXT NOT NULL,
  dt_comptc DATE NOT NULL,
  -- Cotas
  vl_cota_senior NUMERIC,
  vl_cota_subordinada NUMERIC,
  vl_cota_mezanino NUMERIC,
  qt_cota_senior NUMERIC,
  qt_cota_subordinada NUMERIC,
  -- PL por classe
  vl_pl_senior NUMERIC,
  vl_pl_subordinada NUMERIC,
  vl_pl_mezanino NUMERIC,
  -- Subordinação
  indice_subordinacao NUMERIC,  -- calculado: (sub+mez)/PL_total
  -- Carteira de direitos creditórios
  vl_carteira_direitos NUMERIC,
  vl_carteira_a_vencer NUMERIC,
  vl_carteira_inadimplente NUMERIC,
  vl_carteira_prejuizo NUMERIC,
  -- PDD
  vl_pdd NUMERIC,
  indice_pdd_cobertura NUMERIC, -- calculado: PDD/inadimplente
  -- Taxa inadimplência
  taxa_inadimplencia NUMERIC,   -- calculado: inadimplente/carteira_total
  -- Performance
  rentab_senior NUMERIC,
  rentab_subordinada NUMERIC,
  rentab_fundo NUMERIC,
  -- Lastro
  tp_lastro_principal TEXT,     -- tipo principal de lastro
  concentracao_cedente NUMERIC, -- % top cedente
  nr_cedentes INTEGER,
  -- Benchmark
  benchmark TEXT,
  rentab_benchmark NUMERIC,
  spread_cdi NUMERIC,           -- calculado: rentab - CDI
  PRIMARY KEY (cnpj_fundo, dt_comptc)
);

-- FII Informe Mensal — dados específicos FII
CREATE TABLE hub_fii_mensal (
  cnpj_fundo TEXT NOT NULL,
  dt_comptc DATE NOT NULL,
  -- Cotas
  vl_cota NUMERIC,
  qt_cotas_emitidas NUMERIC,
  -- PL e ativos
  vl_pl NUMERIC,
  vl_ativo_total NUMERIC,
  vl_imoveis NUMERIC,
  vl_titulos NUMERIC,
  vl_caixa NUMERIC,
  -- Resultado
  resultado_bruto NUMERIC,
  resultado_liquido NUMERIC,
  -- Distribuição
  vl_distribuicao_cota NUMERIC, -- rendimento por cota
  dividend_yield_mes NUMERIC,   -- calculado: distribuição/cota
  -- Vacância (quando disponível)
  taxa_vacancia NUMERIC,
  -- Segmento
  segmento TEXT,                -- tijolo, papel, FOF, híbrido
  tp_imovel TEXT,               -- logística, lajes, shopping, etc.
  -- Métricas derivadas
  p_vp NUMERIC,                 -- calculado: preço mercado / VP cota (via B3, futuro)
  cap_rate NUMERIC,             -- calculado: NOI anualizado / valor imóveis
  PRIMARY KEY (cnpj_fundo, dt_comptc)
);

-- FIP Informe Trimestral — dados específicos FIP
CREATE TABLE hub_fip_trimestral (
  cnpj_fundo TEXT NOT NULL,
  dt_comptc DATE NOT NULL,
  -- PL e patrimônio
  vl_pl NUMERIC,
  vl_ativo_total NUMERIC,
  -- Participações
  nr_empresas_investidas INTEGER,
  vl_participacoes NUMERIC,
  -- Tipo
  tp_fip TEXT,                  -- capital semente, empresas emergentes, infraestrutura, multiestratégia
  -- Performance
  tir_estimada NUMERIC,         -- TIR desde início
  multiplo_capital NUMERIC,     -- MOIC: valor atual / capital investido
  -- Governança
  tem_assento_conselho BOOLEAN,
  PRIMARY KEY (cnpj_fundo, dt_comptc)
);
```

---

## 3. Camada de Analytics

### 3.1 Analytics Base (qualquer fundo)

**Já implementado (H2.1-5, H2.1-6):**
- Retorno período/anualizado, volatilidade, Sharpe, Sortino, max drawdown, Calmar
- Drawdown chart, rolling volatility chart
- Comparação multi-fundo com best-in-class highlighting

**A implementar:**

| Métrica | Fórmula | Categoria |
|---------|---------|-----------|
| Information Ratio | (Ret_fundo - Ret_bench) / Tracking Error | Risk-adjusted |
| Alpha (Jensen) | Ret_fundo - [Rf + β(Ret_bench - Rf)] | Attribution |
| Beta | Cov(Rfundo, Rbench) / Var(Rbench) | Market sensitivity |
| Tracking Error | σ(Rfundo - Rbench) × √252 | Benchmark deviation |
| Upside/Downside Capture | Σret_up_fund / Σret_up_bench | Asymmetry |
| VaR Paramétrico (95%) | μ - 1.645σ (diário → anualizado) | Tail risk |
| Índice de Consistência | % meses batendo benchmark (rolling 12m) | Persistence |
| Drawdown Recovery Time | Dias entre trough e recovery ao pico | Resilience |
| Rolling Sharpe (12m) | Sharpe recalculado janela móvel | Stability |
| Regime Detection | Z-score retorno rolling 60d vs média longa | Regime change |

### 3.2 Analytics FIDC (especializado)

Referência: fidcs.com.br + painelfidc.com.br

| Métrica | Fórmula/Conceito | Importância |
|---------|-------------------|-------------|
| Índice de Subordinação | (PL_sub + PL_mez) / PL_total | **Core safety metric** |
| Evolução Subordinação | Série temporal do índice | Trend analysis |
| PDD/Carteira | PDD / Carteira total direitos | Provisioning adequacy |
| Cobertura PDD | PDD / Créditos inadimplentes | Coverage ratio |
| Taxa Inadimplência | Inadimplente / Carteira total | Credit quality |
| Inadimplência por Aging | Faixas 15-30d, 31-60d, 61-90d, 90d+ | Vintage analysis |
| Spread sobre CDI | Rentab_fundo - CDI_período | Risk premium |
| Spread Senior vs Sub | Rentab_sub - Rentab_senior | Subordination premium |
| Concentração Cedente | % top 1, top 5, top 10 cedentes | Diversification risk |
| Turnover Carteira | Volume originado / Carteira média | Activity |
| Loss Given Default | Prejuízo / (Inadimplente + Prejuízo) | Severity |
| Default Transition Matrix | Migração entre faixas de aging mês a mês | **Predictive** |

**Visualizações FIDC:**
- Waterfall: PL → Senior → Mezanino → Subordinada (composição)
- Aging heatmap: evolução das faixas de inadimplência no tempo
- Scatter: spread vs subordinação (risk-return positioning)
- Radar: 6 eixos (subordinação, PDD, inadim, spread, concentração, tamanho)

### 3.3 Analytics FII (especializado)

| Métrica | Fórmula/Conceito | Importância |
|---------|-------------------|-------------|
| Dividend Yield (mensal) | Distribuição / Cota | **Core income metric** |
| DY anualizado | DY_mensal × 12 (ou soma 12m) | Annualized income |
| DY acumulado 12m | Soma dist. 12m / Cota atual | Trailing yield |
| P/VP | Preço mercado / Valor patrimonial cota | Valuation |
| Desconto/Prêmio P/VP | (P/VP - 1) × 100% | Market sentiment |
| Cap Rate | NOI anualizado / Valor imóveis | Property yield |
| Taxa de Vacância | Área vaga / Área total | Occupancy |
| Payout Ratio | Distribuição / Resultado líquido | Sustainability |
| Consistência Distribuição | % meses com distribuição (12m) | Reliability |
| Crescimento PL | Variação PL 12m | Growth |
| Liquidez | Volume médio negociado / PL | Tradability |

**Visualizações FII:**
- Segmentação por tipo: Tijolo (logística, lajes, shopping, hospital), Papel (CRI/CRA), FOF, Híbrido
- Heatmap: DY × P/VP por segmento (quadrantes de oportunidade)
- Evolução DY + distribuições no tempo
- Comparação setorial (logística vs lajes vs shopping)

### 3.4 Analytics FIP (especializado)

| Métrica | Fórmula/Conceito | Importância |
|---------|-------------------|-------------|
| TIR desde início | IRR fluxos (capital calls + distribuições) | **Core performance** |
| MOIC | Valor atual / Capital investido | Multiple |
| DPI | Distribuições / Capital investido | Cash-on-cash |
| RVPI | Valor residual / Capital investido | Unrealized value |
| TVPI | (Dist + Residual) / Capital investido | Total value |
| J-Curve Position | Estágio no ciclo (investimento/colheita) | Lifecycle |
| Nr Empresas Portfolio | Count participações ativas | Diversification |
| Concentração | % top holding | Risk |

**Visualizações FIP:**
- J-Curve: evolução valor vs tempo desde inception
- Vintage year comparison
- Composição portfolio por setor/estágio

### 3.5 Analytics Preditivo Leve

| Feature | Método | Output |
|---------|--------|--------|
| Tendência PL | EMA(12m) + direção + aceleração | Arrow + classificação (↑ crescendo, → estável, ↓ encolhendo) |
| Tendência Captação | EMA captação líquida 6m | Fluxo: entrada, saída, neutro |
| Anomalia Retorno | Z-score retorno mensal vs rolling 24m | Alerta: retorno atípico (>2σ) |
| Regime Change | Z-score vol rolling 60d vs média 252d | Alerta: mudança regime volatilidade |
| Projeção Inadim. FIDC | ARIMA(1,1,1) na série inadimplência | Forecast 3m com intervalo confiança |
| Alerta Subordinação | Threshold monitoring com trend | Alerta quando subordinação cai abaixo de threshold |
| Consistência Score | Holt-Winters exponential smoothing | Tendência de consistência vs benchmark |

---

## 4. Muuney Fund Score™ (Score Proprietário)

Score composto 0-100 por tipo de fundo, ponderando múltiplas dimensões:

### 4.1 Score Genérico (todos os fundos)

| Dimensão | Peso | Métricas componentes |
|----------|------|---------------------|
| Performance | 25% | Retorno vs benchmark, consistência mensal |
| Risco | 25% | Sharpe, max drawdown, VaR |
| Tamanho/Liquidez | 15% | PL, captação líquida, nr cotistas |
| Custos | 15% | Taxa admin + performance vs peers |
| Persistência | 20% | % meses acima benchmark (rolling 12m/24m) |

### 4.2 Score FIDC (adicional)

| Dimensão | Peso | Métricas componentes |
|----------|------|---------------------|
| Proteção | 30% | Subordinação, PDD/cobertura |
| Qualidade Carteira | 30% | Inadimplência, aging, LGD |
| Spread | 20% | Spread CDI, prêmio senior vs sub |
| Diversificação | 20% | Nr cedentes, concentração |

### 4.3 Score FII (adicional)

| Dimensão | Peso | Métricas componentes |
|----------|------|---------------------|
| Renda | 30% | DY trailing 12m, consistência distribuição |
| Valuation | 25% | P/VP, desconto vs peers |
| Qualidade | 25% | Vacância, cap rate, payout ratio |
| Gestão | 20% | Taxa admin, crescimento PL, liquidez |

### 4.4 Score FIP (adicional)

| Dimensão | Peso | Métricas componentes |
|----------|------|---------------------|
| Performance | 35% | TIR, MOIC, TVPI |
| Diversificação | 25% | Nr empresas, concentração |
| Maturidade | 20% | Estágio J-curve, DPI |
| Governança | 20% | Assentos conselho, tipo FIP |

**Apresentação:** Gauge circular com cor (vermelho→amarelo→verde), breakdown por dimensão em radar chart, ranking percentil vs peers.

---

## 5. Interface Dual-Layer (Retail / Pro)

### 5.1 Modo Retail (default)

Linguagem acessível, alinhada com a marca Muuney ("Seu dinheiro, claro. Sem esforço.")

- **Score visual:** Gauge grande com nota e label ("Excelente", "Bom", "Regular", "Atenção")
- **Cards simplificados:** "Rendeu X% em 12 meses", "Risco: Baixo/Médio/Alto", "Taxa: barata/na média/cara"
- **Comparador visual:** Até 3 fundos lado a lado com barras coloridas
- **Nudges educativos:** Tooltips explicando cada métrica em linguagem simples
- **Alertas amigáveis:** "Este fundo perdeu cotistas nos últimos 3 meses — fique atento"

### 5.2 Modo Pro (toggle)

Linguagem técnica, métricas completas, exportação.

- **Dashboard completo:** Todas as métricas da seção 3 visíveis
- **Screening avançado:** Filtros multi-dimensionais (classe, PL range, retorno range, vol range, Sharpe min, taxa max, gestor, benchmark)
- **Tabela exportável:** Todos os KPIs em tabela sortable com CSV/XLSX export
- **Composição carteira:** Drill-down asset-level (CDA)
- **Relatório PDF:** One-pager exportável com score, métricas, charts, recomendação

### 5.3 Toggle UI

```
┌─────────────────────────────────┐
│  [🔍 Retail]  ←→  [📊 Pro]    │  ← Toggle no header do módulo
└─────────────────────────────────┘
```

Persiste via localStorage (na verdade, React state + URL param `?mode=pro`).

---

## 6. Screening Avançado

### Filtros disponíveis:

| Filtro | Tipo | Opções |
|--------|------|--------|
| Classe | Multi-select | Ações, Multimercado, RF, Cambial, FIDC, FII, FIP |
| Classe ANBIMA | Multi-select | ~40 categorias |
| PL mínimo | Range slider | R$0 → R$10B+ |
| Nr cotistas | Range slider | 0 → 100K+ |
| Retorno período | Range | -50% → +100% |
| Volatilidade máx | Slider | 0% → 50% |
| Sharpe mínimo | Slider | -2 → +3 |
| Max Drawdown | Slider | -50% → 0% |
| Taxa admin máx | Slider | 0% → 5% |
| Taxa performance | Toggle | Com/Sem |
| Benchmark | Multi-select | CDI, IPCA+, Ibovespa, etc. |
| Gestor | Search | Autocomplete |
| Fund Score mín | Slider | 0 → 100 |
| Status | Toggle | Ativo/Todos |

**Output:** Tabela ranked por critério selecionado, com mini-sparklines de cota, badges de score, ação de comparar/detalhar.

---

## 7. Relatório PDF Exportável

One-pager por fundo com:
- Header: nome, CNPJ, classe, gestor, admin
- Muuney Fund Score™ com gauge e breakdown radar
- KPIs principais (retorno, vol, Sharpe, drawdown)
- Chart: evolução cota 12m
- Chart: drawdown
- Tabela: métricas vs peers (percentil)
- Para FIDC: subordinação, PDD, inadimplência
- Para FII: DY, P/VP, vacância
- Footer: "Gerado por Muuney.hub · muuney.com.br · Dados CVM"

---

## 8. Features Inspiradas no Painel FIDC (a incorporar)

### 8.1 Panorama Setorial (inspirado painelfidc.com.br/panorama)
- Dashboard de mercado: total PL, nr fundos ativos, nr gestores, por classe
- Evolução temporal: PL agregado, captação líquida, nr fundos — série mensal
- Breakdown por tipo de lastro (FIDCs) / segmento (FIIs) / estratégia (multimercado)
- Market share: top 10 gestores por PL, top 10 por captação
- Gráficos interativos com drill-down por categoria

### 8.2 Database Inteligente (inspirado painelfidc.com.br/database)
- Busca semântica por nome, CNPJ, gestor, administrador
- Cards de resultado com mini-KPIs (PL, retorno, score, status)
- Filtros rápidos: classe, status, PL range, gestor
- Ordenação por qualquer métrica
- Acesso direto ao detalhe do fundo com 1 clique

### 8.3 Conteúdo Educativo Contextual (inspirado Academia FIDC)
- Tooltips "Saiba mais" em cada métrica com explicação simples
- Mini-guias por tipo de fundo: "Como analisar um FIDC", "Como analisar um FII"
- Glossário integrado com termos regulatórios (CVM, ANBIMA)
- Links para artigos do blog Muuney quando relevante

---

## 9. Navegação Revisada (atualizada)

```
/hub/fundos
├── Visão Geral          (dashboard com overview + top performers + score distribution)
├── Screening            (filtros avançados + tabela ranked) ← NOVO
├── Rankings             (top/bottom por métrica, classe)
├── Métricas             (risk-return deep dive para fundo selecionado)
├── Mensal               (desempenho mensal, overview mercado)
├── Composição           (CDA asset-level drill-down) ← NOVO
├── FIDC                 (painel especializado) ← NOVO
├── FII                  (painel especializado) ← NOVO
├── FIP                  (painel especializado) ← NOVO
├── Comparador           (até 4 fundos side-by-side)
└── Analytics            (cross-module insights, regime detection, alertas)
```

---

## 10. Sequência de Implementação

### Fase 1: Fundação de Dados (H2.1-4, H2.1-CDA)
1. **ETL CDA** — Ingestão composição carteira (8 blocos de ativos)
2. **Tabela hub_fundos_carteira** + endpoint `composition`
3. **ETL FIDC Informe Mensal** — Ingestão dados FIDC-específicos
4. **Tabela hub_fidc_mensal** + endpoint `fidc_monthly`

### Fase 2: Analytics Base Expandido (H2.1-METRICS)
5. **fundMetrics.ts v2** — Information Ratio, Alpha, Beta, Tracking Error, VaR, Capture Ratio, Consistency Index
6. **Regime Detection** — Z-score anomaly, rolling regime classifier
7. **Muuney Fund Score™** — Implementação score genérico
8. **FundScorePanel.tsx** — Gauge, radar, ranking percentil

### Fase 3: FIDC Especializado (H2.1-8)
9. **FIDC Analytics lib** — Subordinação, PDD, inadimplência, aging, spread, concentração
10. **FIDCPanel.tsx** — Dashboard FIDC com waterfall, aging heatmap, radar
11. **FIDC Score** — Score específico FIDC com dimensões de crédito
12. **FIDC Preditivo** — ARIMA inadimplência, alertas subordinação

### Fase 4: FII Especializado (H2.1-9)
13. **ETL FII Informe Mensal** — Ingestão dados FII-específicos
14. **Tabela hub_fii_mensal** + endpoint `fii_monthly`
15. **FII Analytics lib** — DY, P/VP, vacância, cap rate, payout
16. **FIIPanel.tsx** — Dashboard FII com segmentação, heatmap DY×P/VP
17. **FII Score** — Score específico FII

### Fase 5: FIP Especializado (H2.1-10)
18. **ETL FIP Informe Trimestral** — Ingestão dados FIP
19. **Tabela hub_fip_trimestral** + endpoint `fip_quarterly`
20. **FIP Analytics lib** — TIR, MOIC, TVPI, J-curve
21. **FIPPanel.tsx** — Dashboard FIP com vintage comparison
22. **FIP Score** — Score específico FIP

### Fase 6: UX Layer (H2.1-UX)
23. **Dual-layer toggle** — Retail/Pro mode com URL param
24. **Screening avançado** — Multi-filter UI com ranked output
25. **Composição tab** — CDA drill-down visual (treemap + tabela)
26. **PDF Export** — Relatório one-pager via @react-pdf/renderer

### Fase 7: Preditivo + Cross-Module (H2.1-PRED)
27. **Tendência PL/Captação** — EMA + classificação
28. **Anomaly Detection** — Z-score alertas
29. **Cross-module insights** — Correlação fundos × Selic, IPCA, crédito
30. **Analytics tab final** — Dashboard consolidado com alertas e insights

---

## 11. Estimativa de Esforço

| Fase | Subtasks | Complexidade | Prioridade |
|------|----------|-------------|------------|
| 1. Fundação Dados | 4 | Alta | P0 |
| 2. Analytics Base | 4 | Alta | P0 |
| 3. FIDC | 4 | Alta | P1 |
| 4. FII | 5 | Média-Alta | P1 |
| 5. FIP | 5 | Média | P2 |
| 6. UX Layer | 4 | Média | P1 |
| 7. Preditivo | 4 | Média | P2 |

**Total: 30 subtasks · ~7 fases**

---

## 12. Integração Cross-Module

| Insight | Fonte Macro/Crédito | Impacto Fundos |
|---------|--------------------|--------------|
| Selic sobe → RF beneficia | Módulo Macro (Selic) | Highlight RF, alerta multi/ações |
| Inadimplência crédito sobe | Módulo Crédito (inadim) | Alerta FIDCs com lastro similar |
| Spread crédito alarga | Módulo Crédito (spreads) | Oportunidade FIDCs spread alto |
| IPCA acelera | Módulo Macro (IPCA) | Highlight NTN-B FIIs papel |
| Câmbio deprecia | Módulo Macro (PTAX) | Alerta fundos cambiais |

---

*Documento gerado para revisão. Aguardando aprovação antes de iniciar implementação.*
