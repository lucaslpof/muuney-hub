# Muuney.hub — Módulo Fundos V3: Reestruturação Completa

**Data:** 05/04/2026
**Status:** SPEC — Aguardando aprovação
**Autor:** Lucas + Claude (CMO/CTO)

---

## 1. Diagnóstico: Por que o módulo atual não gera valor

### 1.1 Dados fundamentalmente quebrados

| Problema | Gravidade | Detalhe |
|----------|-----------|---------|
| 456 de 724 fundos são **CANCELADOS** mas marcados como `is_active=true` | 🔴 Crítico | Catálogo poluído com fundos mortos |
| Apenas **22 fundos** em funcionamento normal | 🔴 Crítico | Base real é ~3% do que parece |
| 242 fundos com **sit = NULL** (status desconhecido) | 🔴 Crítico | Dados órfãos sem classificação |
| **76% dos fundos** sem campo `classe` preenchido | 🔴 Crítico | Impossível filtrar por categoria |
| Apenas **17 fundos** com `classe_anbima` | 🔴 Crítico | Classificação ANBIMA praticamente ausente |
| Dados diários cobrindo **apenas março/2026** (1 mês) | 🟡 Alto | Séries históricas insuficientes para métricas |
| **Zero fundos** registrados pós-2024 (RCVM 175) | 🔴 Crítico | Nenhum fundo no formato novo |
| Sem campo `cnpj_fundo_classe` no schema | 🔴 Crítico | Incompatível com RCVM 175 |

**Conclusão:** O catálogo precisa ser reconstruído do zero com dados da CVM atualizados.

### 1.2 UX: Estatístico demais, analítico de menos

**O que temos (estatístico):**
- Rankings por PL/cotistas (tabelas numéricas)
- Comparador com métricas Sharpe/Sortino/Drawdown
- Fund Score™ percentile-based
- Charts de rentabilidade indexada

**O que falta (analítico/informativo) — o que faz o usuário pagar:**
- **Lâmina do fundo**: Página dedicada com resumo executivo, história, composição, gestor, documentos
- **Rankings inteligentes**: "Top RF Curto Prazo", "Melhores Multimercado 2026" — filtráveis por categoria ANBIMA
- **Screening multi-filtro**: Classe + PL mín + Taxa máx + Retorno mín + Sharpe mín
- **Insights acionáveis**: "Fundo X trocou de gestor", "PL caiu 30% em 3 meses", "Drawdown > 10%"
- **Hierarquia RCVM 175**: Fundo → Classe → Subclasse visualmente clara
- **Modo assessor**: Toggle entre visão retail (simplificada) e visão pro (avançada)

### 1.3 Benchmarks: O que a concorrência faz melhor

**Mais Retorno (líder retail BR):**
- Lâmina completa por fundo com gráficos, composição, gestor
- Comparador intuitivo com até 4 fundos
- Rankings por categoria ANBIMA com filtros
- Badge "✓ RCVM 175 Adaptado" como trust signal
- Coleções editoriais: "Melhores Fundos RF", "Top Multimercado"

**Quantum Finance (líder B2B BR):**
- Screening avançado com 20+ filtros
- Due diligence completa com documentos
- Analytics de gestor (histórico, AuM, track record)
- Terminal profissional — preço justificado pela profundidade

**Morningstar (referência global):**
- Star rating (1-5) como proxy de qualidade — equivalente ao nosso Fund Score™
- Analyst picks e research notes
- Fund profile com seções: Overview, Performance, Portfolio, People, Fees
- Peer comparison automática (vs categoria)

---

## 2. Plano de Reestruturação — 5 Fases

### Fase 0: Fundação de Dados (BLOQUEANTE — fazer primeiro)

**Objetivo:** Reconstruir o catálogo com dados CVM atualizados e estrutura RCVM 175.

**2.0.1 — Novo schema `hub_fundos_meta` (migration)**

```sql
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS cnpj_fundo_classe text;
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS cnpj_fundo_subclasse text;
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS subclasse text;
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS classe_rcvm175 text;  -- Renda Fixa / Ações / Multi / Cambial
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS subclasse_rcvm175 text; -- Crédito Livre, Dinâmico, etc.
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS tributacao text;  -- Longo Prazo / Curto Prazo
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS publico_alvo text;  -- Geral / Qualificado / Profissional
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS rentab_fundo text;  -- benchmark textual
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS prazo_resgate text;
ALTER TABLE hub_fundos_meta ADD COLUMN IF NOT EXISTS aplicacao_min numeric;
-- Corrigir is_active para refletir sit real
UPDATE hub_fundos_meta SET is_active = false WHERE sit = 'CANCELADA' OR sit = 'LIQUIDAÇÃO';
-- Criar índice para classe
CREATE INDEX IF NOT EXISTS idx_fundos_meta_classe_rcvm175 ON hub_fundos_meta(classe_rcvm175);
CREATE INDEX IF NOT EXISTS idx_fundos_meta_cnpj_classe ON hub_fundos_meta(cnpj_fundo_classe);
```

**2.0.2 — Ingestão massiva do cadastro CVM (cad_fi)**

Fonte: `https://dados.cvm.gov.br/dados/FI/CAD/DADOS/cad_fi.csv` (~230k linhas, todos os fundos BR)
- Filtrar por `SIT = 'EM FUNCIONAMENTO NORMAL'` → ~30k fundos ativos
- Mapear campos RCVM 175:
  - `CNPJ_FUNDO` → cnpj_fundo (mantém compatibilidade)
  - `CNPJ_FUNDO_CLASSE` → cnpj_fundo_classe (NOVO — ID primário pós-175)
  - `DENOM_SOCIAL` → denom_social (SEMPRE exibir como nome principal)
  - `CLASSE_RCVM_175` → classe_rcvm175
  - `SUBCLASSE_RCVM_175` → subclasse_rcvm175
  - `TP_FUNDO` → tp_fundo
  - `CLASSE_ANBIMA` → classe_anbima
  - `PUBLICO_ALVO` → publico_alvo
  - `TRIB_LPRAZO` → tributacao
  - `TAXA_ADM` → taxa_adm
  - `TAXA_PERFM` → taxa_perfm
- Upsert em hub_fundos_meta (ON CONFLICT cnpj_fundo)
- Meta: 25-30k fundos ativos com classificação completa

**2.0.3 — Migrar hub_fundos_diario para CNPJ_FUNDO_CLASSE**

Fonte: `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/`
- Novo campo na coluna: `cnpj_fundo_classe` (já presente nos CSVs recentes da CVM)
- Ingestão de pelo menos 12 meses de dados diários (não apenas 1 mês)
- Considerar window de 6M para dados iniciais, expandir para 24M incrementalmente

**2.0.4 — pg_cron: Atualização automática do cadastro**

- Job semanal: re-ingestão do cad_fi.csv (detectar novos fundos, fundos cancelados)
- Job diário: inf_diario_fi (dados D+1 útil)

**Entregável:** Catálogo com ~25k+ fundos ativos, classificados, com hierarquia RCVM 175 e 6+ meses de dados diários.

---

### Fase 1: UX Foundation — Nome > CNPJ + Hierarquia Visual

**Objetivo:** Reformar toda a camada de apresentação para ser name-first e RCVM 175-aware.

**2.1.1 — Identificação por nome em todo o módulo**

Regra universal: `denom_social` é SEMPRE o identificador primário. CNPJ aparece como detalhe secundário, nunca como fallback visual principal.

Componentes afetados (refactor):
- `shortCnpj()` → renomear para `formatCnpj()`, usar apenas em contexto de detalhe
- Todos os `denom_social || shortCnpj(cnpj)` → `denom_social` (com fallback apenas em erro)
- FundSearchBar, FundRankingTable, FIDCPanel, FIIPanel, FIPPanel, FundCompareChart, ComparadorSection

**2.1.2 — Hierarquia visual RCVM 175**

Badge system:
```
[RF] Renda Fixa → [Crédito Livre] → [Classe Única]
[MULTI] Multimercado → [Dinâmico] → [Sênior | Subordinada]
[AÇÕES] Ações → [Livre]
[FII] Imobiliário → [Tijolo | Papel | Híbrido]
[FIDC] Direitos Creditórios → [Sênior | Mezanino | Subordinada]
[FIP] Participações → [Multi | Capital Semente | IE]
```

Cores por classe RCVM 175:
- Renda Fixa: `#3B82F6` (blue)
- Multimercado: `#8B5CF6` (purple)
- Ações: `#22C55E` (green)
- Cambial: `#F59E0B` (amber)
- FII: `#EC4899` (pink)
- FIDC: `#F97316` (orange)
- FIP: `#06B6D4` (cyan)

**2.1.3 — Modo Assessor toggle**

- Toggle global no header: "Visão Investidor" ↔ "Visão Assessor"
- Investidor: linguagem simplificada, Fund Score™ em destaque, menos métricas
- Assessor: métricas completas (Sharpe, Sortino, Calmar, VaR), composição CDA, due diligence

---

### Fase 2: Lâmina do Fundo — Página dedicada por fundo

**Objetivo:** Criar a página `/hub/fundos/:cnpj` com visão completa do fundo — o core product.

**Estrutura da Lâmina (inspiração Mais Retorno + Morningstar):**

```
┌─────────────────────────────────────────────────────────┐
│ HEADER                                                   │
│ [RF] BB TOP CP 2 FI CURTO PRAZO          Fund Score: 78  │
│ CNPJ Classe: 10.807.247/0001-78 · Gestor: BB DTVM       │
│ PL: R$ 2.1B · Cotistas: 45.231 · Tx Adm: 0.50%         │
│ ✓ RCVM 175 Adaptado · Público: Geral · Tributação: LP   │
├─────────────────────────────────────────────────────────┤
│ TABS: Resumo | Performance | Composição | Gestor | Docs  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│ === Resumo (tab default) ===                              │
│ KPI Cards: Retorno 12M | Vol | Sharpe | Max DD            │
│ Mini-chart rentabilidade 12M                              │
│ "O que é este fundo" (descrição em linguagem acessível)  │
│ Classe ANBIMA · Benchmark · Aplicação Mín · Resgate      │
│                                                           │
│ === Performance ===                                       │
│ Chart rentabilidade (1M/3M/6M/1A/2A/Max) vs benchmark   │
│ Retorno acumulado tabela (MTD/YTD/12M/24M/36M/Desde)    │
│ Drawdown chart · Rolling volatility                       │
│ Fund Score™ detalhado (4 pilares com barras)             │
│                                                           │
│ === Composição (CDA) ===                                  │
│ Donut chart por bloco CVM                                 │
│ Top 10 ativos (tabela)                                    │
│ Concentração setorial                                     │
│                                                           │
│ === Gestor ===                                            │
│ Dados da gestora · AuM total · Nº fundos                 │
│ Outros fundos da mesma gestora (cross-sell)              │
│ Histórico (dt_reg, dt_const)                              │
│                                                           │
│ === Documentos ===                                        │
│ Link regulamento CVM · Lâmina oficial                    │
│ Informes periódicos                                       │
│                                                           │
│ SIDEBAR: Fundos similares (mesma classe/subclasse)       │
└─────────────────────────────────────────────────────────┘
```

**Rota:** `/hub/fundos/:identificador` (slug ou CNPJ formatado)

**Componentes novos:**
- `FundLamina.tsx` — página completa (lazy-loaded)
- `FundLaminaHeader.tsx` — header com KPIs, badges, Score
- `FundLaminaResumo.tsx` — tab resumo com linguagem acessível
- `FundLaminaPerformance.tsx` — charts e métricas
- `FundLaminaGestor.tsx` — dados da gestora + cross-sell
- `FundSimilares.tsx` — sidebar com fundos da mesma categoria

---

### Fase 3: Rankings Inteligentes + Screening

**Objetivo:** Permitir que o usuário encontre fundos por categoria com filtros úteis.

**2.3.1 — Rankings por categoria**

Pré-configurados (coleções editoriais):
- "Top Renda Fixa" → classe_rcvm175 = 'Renda Fixa', order by retorno 12M
- "Melhores Multimercado" → classe_rcvm175 = 'Multimercado'
- "Ações com melhor Sharpe"
- "FIIs com maior DY"
- "FIDCs por PL"
- "Menor taxa de administração"

Cada coleção mostra:
- Cards com Fund Score™, mini sparkline, PL, retorno 12M
- Toggle: "Ordenar por Score | Retorno | Sharpe | PL | Taxa"
- Filtro rápido: Público (Geral/Qualif/Prof) + Tributação (LP/CP)

**2.3.2 — Screener avançado (Modo Assessor)**

Filtros disponíveis:
- Classe RCVM 175 (multi-select)
- Subclasse RCVM 175
- Classe ANBIMA
- PL mínimo / máximo
- Taxa Adm máxima
- Taxa Performance máxima
- Retorno mínimo (período selecionável)
- Sharpe mínimo
- Volatilidade máxima
- Público alvo
- Fundo exclusivo (Sim/Não)
- Condomínio (Aberto/Fechado)
- Gestor específico

Resultado: Tabela paginada com export CSV, link para lâmina de cada fundo.

---

### Fase 4: Insights e Alertas

**Objetivo:** Gerar valor contínuo com informações acionáveis.

**2.4.1 — Insights automáticos (Edge Function + pg_cron)**

Detecção diária/semanal:
- **Mudança de gestor**: comparar gestor_nome entre snapshots
- **Queda brusca de PL**: > 20% em 30 dias → alerta
- **Drawdown relevante**: > 10% → flag visual na lâmina
- **Mudança de taxa**: taxa_adm ou taxa_perfm alterada
- **Fluxo anormal**: captação ou resgate > 2σ da média
- **Novo fundo**: registrado na CVM esta semana
- **Fundo cancelado**: sit mudou para CANCELADA

Storage: `hub_fundos_insights` (cnpj, tipo, data, detalhe, severidade)

**2.4.2 — Feed de insights no módulo**

- Seção "Últimas Movimentações" no topo do módulo
- Cards com ícone + texto + data + link para lâmina
- Filtro por tipo (todos/gestora/PL/taxa/performance)
- Badge de contagem no sidebar: "3 novos insights"

---

### Fase 5: Integração Ecossistema + Premium Gates

**Objetivo:** Conectar com os outros módulos e definir o que é gratuito vs. pago.

**2.5.1 — Cross-module intelligence**

- Macro regime → Recomendação de classe: "Aperto Monetário → Considere RF Pós-fixado"
- Curva de juros → Impacto em RF Pré: "Curva invertida → Risco em Pré-fixados longos"
- Crédito regime → FIDC signal: "Spread compression → Atenção em FIDC subordinada"

**2.5.2 — Premium gates (Pro tier)**

Gratuito:
- Catálogo completo (busca + lâmina resumida)
- Rankings básicos (top 10 por categoria)
- Fund Score™ (badge, sem detalhes)
- Comparador (2 fundos)

Pro:
- Lâmina completa (composição, gestor, docs)
- Rankings ilimitados com filtros avançados
- Screener multi-filtro
- Comparador (até 6 fundos) com Fund Score™ detalhado
- Insights e alertas
- Export PDF/CSV
- Modo Assessor

---

## 3. Priorização e Dependências

```
Fase 0 (Dados) ──────► Fase 1 (UX Name-First) ──────► Fase 2 (Lâminas)
                                                    └──► Fase 3 (Rankings/Screening)
                                                    └──► Fase 4 (Insights)
                                                              │
                                                              ▼
                                                        Fase 5 (Premium)
```

**Fase 0 é BLOQUEANTE.** Sem dados corretos, tudo o mais é cosmético.

### Estimativa de esforço

| Fase | Escopo | Esforço estimado |
|------|--------|------------------|
| 0 | Schema + Ingestão CVM + pg_cron | 1-2 sessões |
| 1 | UX name-first + badges + modo assessor | 1 sessão |
| 2 | Lâmina do fundo (página dedicada) | 2-3 sessões |
| 3 | Rankings + Screening | 1-2 sessões |
| 4 | Insights engine | 1-2 sessões |
| 5 | Cross-module + Premium gates | 1 sessão |

---

## 4. Decisões Pendentes

1. **Profundidade do histórico diário:** 6M? 12M? 24M? (impacta storage e tempo de ingestão)
2. **Slug da lâmina:** `/hub/fundos/:cnpj` ou `/hub/fundos/:slug-amigavel`?
3. **Dados ANBIMA:** Incluir classificação ANBIMA como fonte adicional (requer acordo)?
4. **Documentos CVM:** Linkar para CVM ou fazer cache dos PDFs?
5. **Threshold de fundos no catálogo:** Incluir todos os 30k ativos ou filtrar por PL mínimo?
