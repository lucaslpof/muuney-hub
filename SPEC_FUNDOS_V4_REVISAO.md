# Muuney.hub — Módulo Fundos V4: Plano de Revisão Completo

**Data:** 05/04/2026
**Benchmark:** fidcs.com.br (4.000+ FIDCs, R$50/mês, público institucional)
**Decisão Estratégica:** Vertical FIDC + FII | Público Institucional/Gestor | Fix Data First

---

## 1. Diagnóstico: Estado Atual vs Benchmark

### 1.1 Auditoria de Dados (Números Reais — API 05/04/2026)

| Dimensão | Estado Atual | Problema | Benchmark (fidcs.com.br) |
|----------|-------------|----------|--------------------------|
| **FIDC — Universo** | 128 fundos | Apenas ~3% do mercado real (~4.000 FIDCs ativos) | 4.000+ FIDCs |
| **FIDC — Lastro** | 100% classificado como "Outros" (null) | Campo `tp_lastro_principal` não é extraído do CVM | Classificação por 11+ segmentos ANBIMA |
| **FIDC — Inadimplência** | Média 485% (impossível) | Cálculo `vlInadim/vlCarteira` retorna lixo quando `vlCarteira` é de outra tabela | Inadimplência real por faixa (15-90d, >90d) |
| **FIDC — Subordinação** | Top 5: 3 de 5 com `null` | Tab I parsing incompleto (muitos campos opcionais) | Subordinação detalhada (sênior/mezanino/sub) |
| **FII — Universo** | 27 fundos (absurdo) | Ingestão pegou apenas um subconjunto minúsculo | ~700+ FIIs ativos no mercado |
| **FII — Dividend Yield** | 0% em todos | Campo `dividend_yield_mes` vem zerado do CVM ZIP | DY mensal/anualizado por FII é dado essencial |
| **FII — Segmentos** | 3 (Shoppings, Multi, Outros) | Amostra ínfima, sem diversidade real | 10+ segmentos (Logística, CRI, Lajes, Híbrido, etc.) |
| **FIP — Universo** | 1.000 fundos | Ok, mas dados de Dez/2025 (defasados) | N/A (fidcs.com.br não cobre FIP) |
| **Fundos Regulares** | 27.651 no catálogo, 1.000 com daily | `is_active=true` aplicado com topN=50 no `ingestCadFi()` legado | N/A |
| **Taxa Admin** | `null` nos top 20 por PL | Campo não populado na migração V3 RCVM 175 | Dados completos |
| **Catálogo Unificado** | FIDC/FII/FIP **não aparecem** no screener | `classe_rcvm175` não inclui "FIDC"/"FII"/"FIP" — dados em tabelas separadas | Busca unificada |

### 1.2 Problemas de UX/UI

| Área | Estado Atual | Problema | Benchmark |
|------|-------------|----------|-----------|
| **Lâminas** | FundLamina.tsx (417 linhas) só para fundos regulares | Sem lâmina para FIDC/FII/FIP | Lâmina detalhada por FIDC com carteira, subordinação, cedentes |
| **Rankings** | FundCategoryRankings (6 cards genéricos) | Rankings rasos, sem filtro por segmento/lastro | Rankings por 11 segmentos ANBIMA, por gestora, por admin |
| **Screener** | Client-side, limit 100 | Não escala, sem filtros avançados para FIDC (lastro, subordinação) | Filtros avançados por tipo de lastro, porte, performance |
| **Ofertas Públicas** | Inexistente | Feature zero | Radar de ofertas com timeline, coordenador, volume |
| **Dashboard** | Seções fixas narrativas | Sem personalização | Widgets arrastáveis, monitoramento multi-fundo |
| **Modo Assessor** | Toggle existe mas cosmético | Não muda dados, apenas label | N/A |
| **Comparador** | Até 6 fundos, quota-based | Não compara métricas FIDC (subordinação, inadimplência) | Comparação profunda por métricas específicas |

### 1.3 Arquitetura — Dívida Técnica

1. **Silos de dados**: `hub_fundos_meta` / `hub_fundos_diario` (regulares) vs `hub_fidc_mensal` vs `hub_fii_mensal` vs `hub_fip_quadrimestral` — sem JOIN nem catálogo unificado
2. **Ingestão legada**: `ingestCadFi()` dentro do hub-cvm-api pega apenas top-N do `cad_fi.csv`, não o universo completo
3. **Edge Function monolítica**: 962 linhas, 33 endpoints num único switch — difícil escalar
4. **Frontend acoplado**: HubFundos.tsx com ~1200 linhas, 6 seções narrativas — difícil manter

---

## 2. Plano de Revisão — 5 Fases

### Fase 0: Data Emergency Fix (Semana 1)

**Objetivo:** Dados confiáveis antes de qualquer feature.

#### 0.1 — FIDC Data Pipeline Rebuild

**Root cause:** A ingestão FIDC atual faz parse apenas da Tab I do ZIP CVM, mas muitos campos vêm de Tab II, III, IV e X. O campo `tp_lastro_principal` requer cruzamento com dados ANBIMA ou classificação CVM separada.

Ações:
- [ ] **Reescrever `ingestFidcMensal()`** para parsear TODAS as tabs relevantes:
  - Tab I: dados básicos + PL + cota + rentabilidade
  - Tab II: composição carteira (tipos de ativo) → classificar lastro
  - Tab III: carteira de direitos creditórios → inadimplência REAL (a vencer vs vencido por faixa)
  - Tab IV: provisão (PDD) → cobertura
  - Tab X_2: cedentes + concentração
  - Tab X_3: sacados + concentração
- [ ] **Ampliar universo FIDC**: Ingerir TODOS os FIDCs do CVM (não filtrar por cnpjSet). O fidcs.com.br tem 4.000+, nós temos 128.
- [ ] **Corrigir cálculo inadimplência**: `taxa_inadimplencia = vlInadim / vlCarteira` está usando campos errados. Usar `VL_CARTEIRA_INADIMPLENTE / VL_CARTEIRA_DIREITOS` da MESMA row.
- [ ] **Classificar lastro**: Criar tabela `fidc_lastro_classification` com mapeamento TP_ATIVO → segmento ANBIMA (Recebíveis Comerciais, Crédito Consignado, Imobiliário, Agro, Factoring, etc.)
- [ ] **Backfill 12 meses** de dados FIDC corrigidos (Abr 2025 — Mar 2026)
- [ ] **Schema update `hub_fidc_mensal`**: adicionar campos faltantes:
  - `tp_lastro` (classificação normalizada)
  - `segmento_anbima` (lookup ou computed)
  - `inadim_15_90`, `inadim_90_plus` (faixas de atraso)
  - `nr_sacados`, `concentracao_sacado`
  - `prazo_medio_carteira`
  - `razao_cobertura` (PDD / inadimplência)

#### 0.2 — FII Data Pipeline Rebuild

**Root cause:** A ingestão FII faz parse de `inf_mensal_fii_YYYYMM.zip` mas o universo retornado é ínfimo (27 de ~700+ ativos). Provável filtro de CNPJ ou parsing errado do ZIP.

Ações:
- [ ] **Debug ingestão FII**: ZIP CVM confirmado disponível (`inf_mensal_fii_2026.zip` = 350KB, `inf_mensal_fii_2025.zip` disponível). O problema é provavelmente no parsing — verificar se nosso `ingest-cvm-data?module=fii` está filtrando CNPJs indevidamente ou se o formato CSV mudou.
- [ ] **Fonte alternativa FII**: B3 dados públicos (IFIX composição) para tickers e preço de mercado — complementar os dados CVM
- [ ] **Corrigir Dividend Yield**: O campo `dividend_yield_mes` vem zerado. Verificar se o nome da coluna no CSV CVM é diferente do esperado. Possível que seja `RENDIMENTO` ou `DISTRIBUICAO_RENDIMENTOS / VP_COTA`.
- [ ] **Ampliar segmentos**: Ingerir campo `SEGMENTO` completo — atualmente só 3 segmentos porque a amostra é ínfima
- [ ] **Schema update `hub_fii_mensal`**: adicionar:
  - `ticker` (código B3 — fundamental para o público)
  - `preco_mercado` (se disponível via B3)
  - `p_vp` (preço / valor patrimonial)
  - `vacancia_fisica`, `vacancia_financeira` (se disponível no informe)
  - `num_imoveis`, `area_total` (segmento tijolo)
- [ ] **Backfill 12 meses** dados FII corrigidos

#### 0.3 — Catálogo Unificado

**Root cause:** `hub_fundos_meta` usa `classe_rcvm175` que só tem valores para fundos regulares (RF, Multi, Ações, Cambial). FIDC/FII/FIP estão em tabelas separadas sem presença no catálogo.

Ações:
- [ ] **Opção A (recomendada): View unificada** — criar `v_fund_universe` (Postgres VIEW) que faz UNION de:
  - `hub_fundos_meta` (regulares) com source='regular'
  - `hub_fidc_mensal` (latest) JOIN meta por cnpj com source='fidc'
  - `hub_fii_mensal` (latest) JOIN meta por cnpj com source='fii'
  - `hub_fip_quadrimestral` (latest) JOIN meta por cnpj com source='fip'
- [ ] **Opção B: Merge no meta** — popular `hub_fundos_meta` com entries para todos FIDC/FII/FIP com `classe_rcvm175` = 'FIDC' / 'FII' / 'FIP'
- [ ] **Endpoint `universal_search`**: busca unificada que retorna fundos de QUALQUER classe
- [ ] **Endpoint `universal_catalog`**: catálogo com filtro por source/classe que inclui estruturados

#### 0.4 — Fund Data Completeness

- [ ] **Corrigir `taxa_adm = null`**: O catálogo RCVM 175 (`registro_fundo_classe.zip`) não tem taxa_adm. Fazer JOIN com `cad_fi.csv` (cadastro legado) que tem o campo.
- [ ] **Enriquecer dados regulares**: `benchmark`, `taxa_perfm`, `gestor_nome`, `admin_nome` — muitos nulls no catálogo V3
- [ ] **Daily data coverage**: Hoje 1.000 fundos com daily (top 1000 por PL). Para institucional, precisamos de pelo menos 5.000+.

---

### Fase 1: FIDC Deep Module (Semana 2-3)

**Objetivo:** FIDC como vertical premium — competir com fidcs.com.br.

#### 1.1 — Lâmina FIDC Dedicada (`/hub/fundos/fidc/:slug`)

Seções da lâmina:
1. **Resumo** — Nome, CNPJ, gestora, admin, PL, classe ANBIMA, lastro, data constituição
2. **Estrutura de Capital** — Gráfico waterfall: sênior / mezanino / subordinada / PL total + índice de subordinação temporal
3. **Carteira de Crédito** — Composição por tipo de ativo (donut), prazo médio, concentração cedentes/sacados
4. **Inadimplência & Risco** — Inadimplência por faixa (a vencer, 15-90d, >90d, prejuízo), PDD coverage, evolução temporal
5. **Performance** — Rentabilidade sênior vs CDI, spread, evolução mensal
6. **Informações Gerais** — Dados cadastrais, documentos CVM links, contatos

#### 1.2 — Rankings FIDC por Segmento

- **11 segmentos ANBIMA**: Recebíveis Comerciais, Consignado, Imobiliário, Agro, Factoring, Setor Público, Infraestrutura, Cartão de Crédito, Veículos, Corporativo, Outros
- **Métricas rankeáveis**: PL, subordinação, inadimplência, rentabilidade, spread CDI, nr cotistas, concentração cedente
- **Filtros**: segmento, faixa de PL, faixa de subordinação, faixa de inadimplência
- **Visualizações**: tabela sortable + scatter plot (risco × retorno)

#### 1.3 — FIDC Screener Avançado

Filtros dedicados:
- Segmento/lastro (multi-select)
- PL mínimo/máximo
- Subordinação mínima/máxima
- Inadimplência máxima
- Rentabilidade mínima
- Nr cedentes mínimo
- Gestora (autocomplete)
- Admin (autocomplete)

Server-side pagination (não client-side).

#### 1.4 — FIDC Comparador

Comparar até 4 FIDCs lado a lado:
- Subordinação (stacked bar)
- Inadimplência evolução (line chart)
- Rentabilidade sênior vs CDI (indexed line)
- Composição carteira (radar chart)
- Métricas summary table

#### 1.5 — FIDC Market Intelligence

- **Regime detection** (já temos `CreditNarrativePanel` — adaptar para FIDC):
  - Stress Sistêmico, Contração, Expansão, Normalização
- **Cross-signals FIDC×Macro**:
  - Inadimplência FIDC vs Selic (leading indicator)
  - Spread sênior vs CDI vs Selic
  - Fluxo líquido FIDC vs crédito SFN
- **Alertas automatizados** (já temos `detect-fund-insights`):
  - Spike inadimplência (z-score > 2)
  - Queda subordinação (< threshold por lastro)
  - PL drop significativo

---

### Fase 2: FII Deep Module (Semana 3-4) — ✅ **CONCLUÍDA 11/04/2026**

**Entregue:** `hub-fii-api` v2 (6 endpoints), `FiiHub.tsx` (4 seções narrativas), `FiiLamina.tsx` (Resumo + Performance + Composição + Similares), rotas Pro-gated `/fundos/fii` e `/fundos/fii/:slug`. Dados: 1.253 FIIs (Jan-Fev 2026, Mar filtrado por completude). Commit: `26ff312`.

**Objetivo:** FII como segunda vertical — dados completos + métricas de mercado.

#### 2.1 — Lâmina FII Dedicada (`/hub/fundos/fii/:slug`)

Seções:
1. **Resumo** — Ticker, nome, segmento, gestora, admin, PL, VP/cota, nr cotistas
2. **Rendimentos** — DY mensal/anualizado, histórico distribuições, consistência (meses com DY > 0)
3. **Performance** — Rentabilidade patrimonial + efetiva, evolução VP, comparação IFIX
4. **Portfólio** (se disponível) — Imóveis, segmento, vacância, área, localização
5. **Métricas** — P/VP, cap rate estimado, despesas admin %
6. **Informações** — Dados cadastrais, tipo gestão, mandato

#### 2.2 — Rankings FII por Segmento

- **Segmentos**: Shoppings, Logística, Lajes Corporativas, Recebíveis (CRI), Híbrido, Residencial, Hotéis, Agro (FIAGRO), FOFs, Outros
- **Métricas**: DY, P/VP, rentabilidade, PL, cotistas, vacância
- **Filtros**: segmento, faixa DY, faixa PL, tipo gestão (ativa/passiva)

#### 2.3 — FII Screener

Similar ao FIDC Screener mas com filtros FII-specific: segmento, DY range, P/VP range, gestão, mandato.

#### 2.4 — FII Market Intelligence

- IFIX tracking (se possível integrar dados B3)
- DY médio por segmento evolução
- Fluxo cotistas (entrada/saída)
- Cross-signal: Selic × DY spread → atratividade relativa

---

### Fase 3: Ofertas Públicas Radar (Semana 4-5)

**Objetivo:** Monitoramento de novas emissões CVM — feature que fidcs.com.br cobra premium.

#### 3.1 — Fonte de Dados (Confirmado 05/04/2026)

- **CVM OFERTA/DISTRIB**: `https://dados.cvm.gov.br/dados/OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip` (5MB, atualizado 04/04/2026)
- **CVM COORD_OFERTA**: `https://dados.cvm.gov.br/dados/COORD_OFERTA/CAD/DADOS/cad_coord_oferta.zip` (20KB, atualizado 04/04/2026)
- Dados: emissor, coordenador, tipo instrumento, volume alvo, status, data registro, prazo
- Ambos confirmados disponíveis e recentes

#### 3.2 — Schema `hub_ofertas_publicas`

```sql
CREATE TABLE hub_ofertas_publicas (
  id SERIAL PRIMARY KEY,
  nr_protocolo TEXT UNIQUE,
  emissor TEXT,
  cnpj_emissor TEXT,
  coordenador TEXT,
  tipo_instrumento TEXT, -- FIDC, FII, CRI, CRA, Debênture
  volume_alvo NUMERIC,
  volume_captado NUMERIC,
  status TEXT, -- Aberta, Encerrada, Cancelada, Em Análise
  dt_registro DATE,
  dt_encerramento DATE,
  dt_inicio_distribuicao DATE,
  instrucao TEXT, -- RCVM 160, 400, etc.
  last_fetched_at TIMESTAMPTZ
);
```

#### 3.3 — Frontend: Radar de Ofertas

- **Timeline** — ofertas recentes em cards cronológicos
- **Filtros** — tipo instrumento, status, coordenador, volume mínimo
- **KPIs** — ofertas abertas, volume total captado (30d), top coordenadores
- **Alertas** — notificação de novas ofertas FIDC/FII (integra com insights)

#### 3.4 — Ingestão Automatizada

- pg_cron diário: fetch ofertas CVM, upsert, detect novas
- Edge Function `ingest-cvm-ofertas`

---

### Fase 4: UX/UI Overhaul (Semana 5-6)

**Objetivo:** Transformar de dashboard genérico para plataforma institucional.

#### 4.1 — Navegação Redesign

**Atual:** 6 seções narrativas num scroll vertical (Visão Geral → Estruturados → Gestoras → Métricas → Composição → Analytics)

**Proposta:** Navegação por classe com sub-rotas:
```
/hub/fundos                    → Dashboard overview (KPIs globais + alerts)
/hub/fundos/fidc               → FIDC hub (rankings, screener, overview)
/hub/fundos/fidc/:slug         → Lâmina FIDC individual
/hub/fundos/fii                → FII hub
/hub/fundos/fii/:slug          → Lâmina FII individual
/hub/fundos/regular            → RF/Multi/Ações (catálogo existente)
/hub/fundos/regular/:slug      → Lâmina fundo regular (já existe)
/hub/fundos/ofertas            → Radar ofertas públicas
/hub/fundos/comparador         → Comparador cross-class
/hub/fundos/screener           → Screener unificado
/hub/fundos/gestoras           → Rankings gestoras
/hub/fundos/administradoras    → Rankings admins
```

#### 4.2 — Dashboard Overview Redesign

**KPIs hero** (4 cards):
- Total PL mercado (por classe)
- Fundos ativos monitorados
- Alertas ativos (últimos 7d)
- Ofertas públicas abertas

**Seções**:
1. Market Pulse — regime monetário + signals cross-class (já temos NarrativePanel)
2. Últimas Movimentações — InsightsFeed (últimas 48h)
3. FIDC Spotlight — top 5 por PL, inadimplência média, spread médio
4. FII Spotlight — top 5 por DY, IFIX tracking
5. Rankings rápidos — top gestoras, top admins

#### 4.3 — Design System Ajustes

- **Density**: Aumentar densidade de informação (target institucional, não retail)
- **Tabelas**: Tabelas mais compactas, font-size 12px, row-height 32px
- **Charts**: Reduzir padding, maximizar data-ink ratio
- **Cores por classe**: Manter RCVM175_COLORS mas com saturação maior para contraste
- **Dark mode refinement**: Manter Tech-Noir mas com contraste WCAG AA mínimo
- **Data freshness indicator**: Badge "Atualizado em DD/MM" em cada seção

#### 4.4 — Dashboard Personalizável (Premium — Fase 5)

Diferencial vs fidcs.com.br: widgets arrastáveis para monitoramento multi-fundo.
- Widget types: KPI card, mini chart, fund watchlist, alert feed, comparador rápido
- Layout: CSS Grid com drag-and-drop (react-grid-layout)
- Persistência: localStorage ou Supabase user_preferences
- **Prioridade: Fase 5 Premium**

---

### Fase 5: Premium Gates & Polish (Semana 6-7)

#### 5.1 — Free vs Pro Tier

| Feature | Free | Pro (R$49/mês) |
|---------|------|----------------|
| Catálogo fundos regulares | ✅ Full | ✅ Full |
| Lâminas básicas | ✅ Resumo + 3m | ✅ Completa + max |
| Rankings top 10 | ✅ | ✅ Full |
| FIDC Screener | ❌ | ✅ |
| FIDC Lâminas | ✅ Resumo | ✅ Full (carteira, cedentes) |
| FII Lâminas | ✅ Resumo | ✅ Full |
| Ofertas Públicas Radar | ✅ Últimos 5d | ✅ Full + alertas |
| Comparador | ✅ 2 fundos | ✅ 6 fundos cross-class |
| Insights/Alertas | ✅ Feed básico | ✅ Alertas customizados |
| Dashboard Personalizável | ❌ | ✅ |
| Export Excel/PDF | ❌ | ✅ |
| API Access | ❌ | ✅ (futuro) |

#### 5.2 — Export Features

- **Excel export**: Histórico completo de séries (subordinação, inadimplência, DY, etc.)
- **PDF lâminas**: Geração de lâmina em PDF formatado (cabeçalho Muuney, data, selo)
- **CSV export**: Já temos parcial, expandir para FIDC/FII

#### 5.3 — Performance & SEO

- **SSR/SSG para lâminas**: Considerar Next.js migration para lâminas indexáveis
- **Meta tags dinâmicas**: OG image por fundo (nome + classe + PL)
- **Sitemap dinâmico**: Incluir /fundos/:slug no sitemap
- **Performance**: Code splitting por módulo (FIDC/FII/regular separados)

---

## 3. Priorização e Timeline

```
Semana 1 (Fase 0): DATA FIX
├── 0.1 FIDC pipeline rebuild + backfill
├── 0.2 FII pipeline rebuild + backfill
├── 0.3 Catálogo unificado (view ou merge)
└── 0.4 Completude dados regulares (taxa_adm, daily coverage)

Semana 2-3 (Fase 1): FIDC DEEP MODULE
├── 1.1 Lâmina FIDC dedicada
├── 1.2 Rankings por segmento
├── 1.3 Screener avançado
├── 1.4 Comparador FIDC
└── 1.5 Market intelligence FIDC

Semana 3-4 (Fase 2): FII DEEP MODULE
├── 2.1 Lâmina FII dedicada
├── 2.2 Rankings por segmento
├── 2.3 Screener FII
└── 2.4 Market intelligence FII

Semana 4-5 (Fase 3): OFERTAS PÚBLICAS
├── 3.1 Fonte de dados CVM
├── 3.2 Schema + ingestão
├── 3.3 Frontend radar
└── 3.4 Automação pg_cron

Semana 5-6 (Fase 4): UX OVERHAUL
├── 4.1 Navegação redesign (sub-rotas)
├── 4.2 Dashboard overview redesign
├── 4.3 Design system ajustes (density, tables)
└── 4.4 Dashboard personalizável (premium)

Semana 6-7 (Fase 5): PREMIUM & POLISH
├── 5.1 Free vs Pro gates
├── 5.2 Export Excel/PDF
└── 5.3 Performance + SEO
```

---

## 4. Métricas de Sucesso

| Métrica | Atual | Target Fase 0 | Target V4 Final |
|---------|-------|---------------|-----------------|
| FIDCs monitorados | 128 | 3.000+ | 4.000+ |
| FIIs monitorados | 27 | 500+ | 700+ |
| FIDC com lastro classificado | 0% | 80%+ | 95%+ |
| FIDC inadimplência válida | ~30% | 90%+ | 98%+ |
| FII com DY calculado | 0% | 80%+ | 95%+ |
| Fundos regulares com daily | 1.000 | 3.000+ | 5.000+ |
| Taxa admin populada | ~0% (top funds) | 70%+ | 90%+ |
| Endpoints Edge Function | 33 | 40+ | 50+ |
| Tempo carregamento lâmina | N/A (broken) | <2s | <1s |

---

## 5. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| CVM ZIP FII não contém todos os FIIs | Alto | Fonte alternativa B3 / scrape informe mensal |
| FIDC lastro requer classificação manual | Médio | Tabela lookup + ML text classification no `TP_ATIVO` |
| Edge Function timeout com 4.000+ FIDCs | Médio | Pagination server-side, cache Supabase, CDN |
| Monolith Edge Function fica ingerenciável | Médio | Split em 3 Edge Functions (query, ingest, insights) |
| Dados CVM atrasados (D+30 para mensal) | Baixo | Disclaimer "Dados CVM — atualização mensal" + daily para regulares |

---

## 6. Decisões Arquiteturais Pendentes

1. **Edge Function split**: Manter monolith hub-cvm-api ou dividir em `hub-cvm-query` (read) + `hub-cvm-ingest` (write) + `hub-cvm-insights` (detection)?
2. **FII dados B3**: Integrar dados B3 (ticker, preço, IFIX) requer nova fonte. Priorizar ou manter apenas dados CVM?
3. **Next.js migration**: Para lâminas SEO-friendly, considerar migração parcial ou pre-rendering via Vite SSG plugin?
4. **Catálogo unificado**: View SQL (mais elegante, zero duplicação) vs merge no meta (mais simples, melhor performance)?

---

---

## 7. Mapa Completo de Fontes CVM (Auditoria 05/04/2026)

Base URL: `https://dados.cvm.gov.br/dados/`

### 7.1 — Fontes JÁ UTILIZADAS (4 pipelines ativos)

| Fonte | Path CVM | Edge Function | pg_cron | Status |
|-------|----------|---------------|---------|--------|
| **FI Cadastro RCVM175** | `FI/CAD/DADOS/registro_fundo_classe.zip` | ingest-fundos-catalog (tombstoned) | — | ✅ 27.651 classes ingeridas |
| **FI Informe Diário** | `FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_YYYYMM.zip` | hub-cvm-api (ingestCadFi legado) | — | ⚠️ Apenas top-N, precisa expansão |
| **FI CDA (Composição)** | `FI/DOC/CDA/DADOS/cda_fi_YYYYMM.zip` | ingest-cvm-data?module=cda | Job #15 (dia 8, 06:00 UTC) | ✅ 15.829 registros |
| **FIDC Informe Mensal** | `FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_YYYYMM.zip` | ingest-cvm-data?module=fidc | Job #16 (dia 8, 06:15 UTC) | ⚠️ 128 fundos (deveria ser 4.000+) |
| **FII Informe Mensal** | `FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_YYYY.zip` | ingest-cvm-data?module=fii | Job #17 (dia 8, 06:30 UTC) | ❌ Apenas 27 fundos, DY=0% |
| **FIP Quadrimestral** | `FIP/DOC/INF_QUADRIMESTRAL/DADOS/inf_quadrimestral_fip_YYYY.csv` | ingest-cvm-data?module=fip | Job #18 (dia 15 Jan/Mai/Set, 06:00 UTC) | ✅ 5.974 registros, 2.190 fundos |
| **FI Cadastro Legado** | `FI/CAD/DADOS/cad_fi.csv` | hub-cvm-api (ingestCadFi) | — | ⚠️ Usado para taxa_adm mas top-N limitado |

### 7.2 — Fontes NÃO UTILIZADAS (oportunidades)

| Fonte | Path CVM | Tamanho | Atualização | Valor p/ Muuney | Prioridade |
|-------|----------|---------|-------------|-----------------|------------|
| **FIE/MEDIDAS** | `FIE/MEDIDAS/DADOS/medidas_mes_fie_YYYYMM.csv` | ~2MB/mês | Mensal | 🔴 **CRÍTICO** — PL + cotistas para TODOS os fundos estruturados (FIDC, FII, FIP). Resolve problema de universo sem rebuildar cada pipeline individual. | **P0** |
| **OFERTA/DISTRIB** | `OFERTA/DISTRIB/DADOS/oferta_distribuicao.zip` | 5MB | Diário | 🔴 **ALTO** — Ofertas públicas (FIDC, FII, CRI, CRA, Debêntures). Feature diferenciadora vs benchmark. | **P1** |
| **FIAGRO Mensal** | `FIAGRO/DOC/INF_MENSAL/DADOS/inf_mensal_fiagro_YYYYMM.zip` | ~1MB | Mensal | 🟡 **MÉDIO** — Segmento em crescimento. Formato similar ao FII. Complementa vertical FII. | **P2** |
| **FII Trimestral** | `FII/DOC/INF_TRIMESTRAL/DADOS/` | Variável | Trimestral | 🟡 **MÉDIO** — Dados detalhados de portfólio (imóveis, vacância, contratos). Enriquece lâmina FII. | **P2** |
| **FII Anual** | `FII/DOC/INF_ANUAL/DADOS/` | Variável | Anual | 🟢 **BAIXO** — Informações anuais consolidadas. Complementar. | **P3** |
| **FI Lâmina** | `FI/DOC/LAMINA/DADOS/` | ~50MB | Mensal | 🟡 **MÉDIO** — Lâminas oficiais CVM (rentabilidade, benchmark, gestor, etc.). Pode enriquecer dados regulares. | **P2** |
| **FI Perfil Mensal** | `FI/DOC/PERFIL_MENSAL/DADOS/perfil_mensal_fi_YYYYMM.csv` | ~5MB | Mensal | 🟢 **BAIXO** — Perfil de cotistas (PF/PJ/Instit). Nice-to-have para analytics. | **P3** |
| **FI Balancete** | `FI/DOC/BALANCETE/DADOS/` | ~100MB | Mensal | 🟢 **BAIXO** — Contabilidade detalhada. Muito granular para UX atual. | **P4** |
| **COORD_OFERTA** | `COORD_OFERTA/CAD/DADOS/cad_coord_oferta.zip` | 20KB | Diário | 🟡 **MÉDIO** — Cadastro coordenadores de oferta. Complementa OFERTA/DISTRIB. | **P2** |
| **Securitizadora CRI/CRA** | `SECURITIZADORA/` (vários sub-paths) | Variável | Mensal | 🟡 **MÉDIO** — Dados CRI/CRA individuais. Complementa crédito privado do módulo Renda Fixa. | **P2** |

### 7.3 — Dicionários de Dados CVM (links oficiais)

Cada dataset no portal `dados.cvm.gov.br/dataset/` possui link para dicionário:

| Dataset | Dicionário |
|---------|-----------|
| FI Cadastro | `dados.cvm.gov.br/dataset/fi-cad` |
| FI Informe Diário | `dados.cvm.gov.br/dataset/fi-doc-inf_diario` |
| FI CDA | `dados.cvm.gov.br/dataset/fi-doc-cda` |
| FI Perfil Mensal | `dados.cvm.gov.br/dataset/fi-doc-perfil_mensal` |
| FI Lâmina | `dados.cvm.gov.br/dataset/fi-doc-lamina` |
| FIDC Inf. Mensal | `dados.cvm.gov.br/dataset/fidc-doc-inf_mensal` |
| FII Inf. Mensal | `dados.cvm.gov.br/dataset/fii-doc-inf_mensal` |
| FII Inf. Trimestral | `dados.cvm.gov.br/dataset/fii-doc-inf_trimestral` |
| FIP Inf. Quadrimestral | `dados.cvm.gov.br/dataset/fip-doc-inf_quadrimestral` |
| FIAGRO Inf. Mensal | `dados.cvm.gov.br/dataset/fiagro-doc-inf_mensal` |
| FIE Medidas | `dados.cvm.gov.br/dataset/fie-medidas` |
| Oferta Distribuição | `dados.cvm.gov.br/dataset/oferta-distrib` |
| Coord. Oferta | `dados.cvm.gov.br/dataset/coord_oferta-cad` |

### 7.4 — Gap Analysis: Impacto na Fase 0

**Descoberta-chave: `FIE/MEDIDAS`**

O dataset `medidas_mes_fie_YYYYMM.csv` contém PL e número de cotistas para **todos** os fundos estruturados (FIDC, FII, FIP) em formato mensal unificado. Isso significa:

1. **Resolve FII universe problem** — em vez de depender do ZIP `inf_mensal_fii` que retorna 27 fundos, podemos pegar PL+cotistas de 700+ FIIs via FIE/MEDIDAS
2. **Complementa FIDC** — validação cruzada do PL reportado no informe mensal
3. **Cobertura FIP** — dados mensais em vez de quadrimestrais

**Recomendação para Fase 0:**
- Adicionar ingestão `FIE/MEDIDAS` como **primeiro passo** antes de rebuildar pipelines individuais
- Usar FIE/MEDIDAS como "fonte de verdade" para PL + cotistas, enriquecendo com dados específicos de cada pipeline (subordinação FIDC, DY FII, etc.)
- Criar tabela `hub_fie_medidas` e incluir no catálogo unificado

### 7.5 — Paths Confirmados vs Código Atual

| Pipeline | Path no Código (`ingest-cvm-data`) | Path Oficial CVM | Match? |
|----------|-------------------------------------|-------------------|--------|
| CDA | `FI/DOC/CDA/DADOS/cda_fi_${ym}.zip` | `FI/DOC/CDA/DADOS/cda_fi_YYYYMM.zip` | ✅ |
| FIDC | `FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_${ym}.zip` | `FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_YYYYMM.zip` | ✅ |
| FII | `FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_${year}.zip` | `FII/DOC/INF_MENSAL/DADOS/inf_mensal_fii_YYYY.zip` | ✅ |
| FIP | `FIP/DOC/INF_QUADRIMESTRAL/DADOS/inf_quadrimestral_fip_${year}.csv` | `FIP/DOC/INF_QUADRIMESTRAL/DADOS/inf_quadrimestral_fip_YYYY.csv` | ✅ |
| Cadastro RCVM175 | `FI/CAD/DADOS/registro_fundo_classe.zip` | `FI/CAD/DADOS/registro_fundo_classe.zip` | ✅ |
| Cadastro Legado | `FI/CAD/DADOS/cad_fi.csv` | `FI/CAD/DADOS/cad_fi.csv` | ✅ |

**Conclusão: Todos os 6 paths CVM estão corretos.** Os problemas de dados (FIDC 128 fundos, FII 27 fundos) NÃO são causados por URLs errados — são bugs de parsing/filtragem na lógica de ingestão.

---

## 8. Ordem de Execução Revisada (Fase 0)

Com base na auditoria CVM, a Fase 0 ganha um passo adicional (0.0):

```
Fase 0: Data Emergency Fix (Revisada)
├── 0.0 NEW: Ingerir FIE/MEDIDAS (PL+cotistas todos estruturados) → resolve universe
├── 0.1 FIDC pipeline rebuild (lastro, inadimplência, universo completo)
├── 0.2 FII pipeline rebuild (debug 27-fund issue, DY fix, segmentos)
├── 0.3 Catálogo unificado (view + FIE/MEDIDAS como base)
├── 0.4 Fund data completeness (taxa_adm, daily coverage)
└── 0.5 NEW: Ingerir OFERTA/DISTRIB (ofertas públicas — quick win para Fase 3)
```

---

*Documento gerado em 05/04/2026 — atualizado com auditoria CVM completa*
*Benchmark: fidcs.com.br | Estratégia: Vertical FIDC+FII | Público: Institucional*
