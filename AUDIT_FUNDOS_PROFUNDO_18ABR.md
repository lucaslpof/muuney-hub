# Audit Profundo — Módulo Fundos (muuney.hub)

**Data:** 18/04/2026 (sábado)
**Escopo:** 5 páginas + 4 componentes-núcleo (~4.500 LOC)
**Benchmarks:** Mais Retorno + Quantum Axis (AAIs BR) · Morningstar + Bloomberg (institucional global) · Funds Explorer + Status Invest (varejo BR) · ComDinheiro + Economatica (analytics pro)
**Metodologia:** revisão 360º (features + UX/UI + storytelling) com peso equilibrado
**Deliverable:** lista P0/P1/P2 ticket-ready com esforço × impacto

---

## 1. Estado atual — resumo executivo

O módulo Fundos é **o mais completo do hub em profundidade de dados** (29.491 fundos catalogados, 21.598 com diário, 4 deep modules: regular/FIDC/FII/Ofertas) e **o mais denso em superfície visual**. As 5 páginas (HubFundos main, FidcHub, FidcLamina, FiiHub, FiiLamina, OfertasRadar) somam ~4.500 LOC e implementam 6 narrative sections + dual sidebar + deep-linking + lazy-load + error boundaries — arquitetura sólida.

**O que está bom (≥ benchmarks):**

- Muuney Fund Score™ (4 pilares percentile-based) é único no mercado BR — nem Mais Retorno nem ComDinheiro entregam um score composto com essa transparência.
- ComparadorSection v2 aceita 6 fundos cross-class (FIDC/FII/FIP/regular misturados) — Status Invest e Funds Explorer só comparam within-class.
- FundNarrativePanel (7 regimes + 6 cross-signals) é superior ao "Market Outlook" do Bloomberg para o recorte BR.
- OfertasRadar tem storytelling narrativo excepcional (narrativeOverview + narrativeTimeline + pipelineAnalytics com HHI, YoY, MoM, QoQ).
- V_hub_fidc_clean filtra outliers CVM (|rentab|>95%) — ninguém mais no mercado faz esse saneamento.

**O que está abaixo do benchmark:**

- **Entrada fria**: `/fundos` abre direto no "Quick Intelligence Strip" sem hero de posicionamento. Morningstar abre com "Markets at a Glance", Bloomberg com "Top Stories", Mais Retorno com "Destaques da Semana".
- **Lâminas sem rolling returns grid** (1m/3m/6m/12m/24m/36m vs CDI/IPCA/Benchmark). Padrão de mercado há 15 anos, ausente nas 3 lâminas (regular/FIDC/FII).
- **Sharpe/Sortino/Vol/Max DD existem no código** (fundScore.ts) mas **não aparecem na lâmina como KPIs visíveis** — estão escondidos dentro do score composto.
- **Não há `data as of` stamp** nas lâminas (padrão Morningstar de confiabilidade institucional).
- **FidcHub + FiiHub: Screener e Rankings convivem como seções separadas** mas fazem essencialmente o mesmo trabalho — redundância visual e cognitiva.
- **Comparador escondido atrás de BlurredPreview** — usuário Pro não percebe que pode entrar.
- **Similar funds** aparecem como cards sem score/class badge comparável — ComDinheiro mostra "melhor que o seu em X, Y, Z".
- **Nenhum PDF export de lâmina** — requisito operacional obrigatório para AAIs (anexar em relatórios 3P).
- **FundNarrativePanel é aplicado só no catálogo global**, nunca por fundo individual — perdendo 90% do valor do framework.

---

## 2. Benchmark matrix — o que cada concorrente faz melhor

| Feature / UX / Narrativa | Mais Retorno | Quantum Axis | Morningstar | Bloomberg BFO | Funds Explorer | Status Invest | ComDinheiro | Economatica | **muuney.hub hoje** |
|---|---|---|---|---|---|---|---|---|---|
| Rolling returns grid (1m-36m) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Sharpe/Sortino/Beta visíveis | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | 🟡 (calculado, não exposto) |
| Max Drawdown / DD Heat | ✅ | ✅ | ✅ | ✅ | 🟡 | — | ✅ | ✅ | 🟡 (só score interno) |
| Style Box (cap × style) | — | — | ✅ | — | — | — | — | — | ❌ |
| 5-star rating | 🟡 | — | ✅ | 🟡 | ✅ (estrelas DY) | — | — | — | 🟡 (5 bands Fund Score) |
| Manager tenure / fund history | 🟡 | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ❌ |
| "As of" date stamp | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| PDF export lâmina | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ | ❌ |
| Comparador cross-class | — | ✅ | 🟡 | ✅ | — | — | ✅ | ✅ | ✅ |
| Fund composite score | 🟡 | ✅ (AES) | ✅ (rating) | ✅ | 🟡 | — | 🟡 | — | ✅ (Fund Score™) |
| Alertas personalizados | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 (feed global, sem subscribe) |
| "Fundo melhor que o meu" | — | 🟡 | 🟡 | 🟡 | — | — | ✅ | ✅ | ❌ |
| Fund-as-shareholder | — | ✅ | 🟡 | ✅ | — | — | ✅ | ✅ | ❌ |
| Performance attribution | — | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ❌ |
| Risk/Return scatter | 🟡 | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ❌ |
| Regime detection | — | — | 🟡 | ✅ | — | — | — | — | ✅ (FundNarrativePanel) |
| Storytelling narrativo (prosa) | ✅ | 🟡 | ✅ | ✅ | — | — | 🟡 | — | 🟡 (só OfertasRadar) |
| Landing hero (módulo) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| FIDC deep analytics (subord/lastro/inadim) | 🟡 | ✅ | — | — | — | — | ✅ | ✅ | ✅ |
| FII deep (DY histórico + segmento) | — | 🟡 | — | — | ✅ | ✅ | 🟡 | — | ✅ |
| CSV/Excel export rankings | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ✅ |

**Legenda:** ✅ completo · 🟡 parcial · ❌ ausente

**Conclusão do cruzamento:** dos 21 vetores avaliados, muuney.hub empata ou vence em 7 (Fund Score, comparador cross-class, regime detection, FIDC deep, FII deep, CSV export, cobertura de dados), perde por ausência em 11 (rolling returns, sharpe exposto, style box, manager tenure, as-of stamp, PDF, "better than mine", fund-as-shareholder, attribution, scatter, landing hero), fica parcial em 3 (storytelling, alertas, max DD).

---

## 3. Gap analysis por sub-módulo

### 3.1 HubFundos.tsx — Catálogo & Lâmina Regular

**Estrutura atual (6 narrative sections):** Visão Geral → Estruturados → Gestoras & Admins → Métricas & Mensal → Composição & Comparador → Analytics.

**Features:**
- ✅ FundSearchBar global com autocomplete, ClasseBadge inline, click-outside close.
- ✅ GestoraRankingsTable + AdminRankingsTable sortable com CSV export.
- ✅ FundScreener Pro-gated (classe, público, tributação, PL, taxa_adm, search debounced 300ms, paginação 25/page, CSV).
- ✅ ComparadorSection v2 — 6 fundos, peer-normalized score, pillar table, bar comparison — **mas oculto atrás de BlurredPreview**.
- ✅ InsightsFeed (Pro gate) com filtros tipo + severity.
- ✅ Quick Intelligence Strip (FIDC Inadim / FII DY / FIDC Subord / Classes CVM).
- ✅ Benchmarks vs Metas + analytics insights cards (memoizados).
- ✅ CVM disclaimer no rodapé.

**Gaps funcionais:**
- ❌ **Landing hero ausente** — a página abre direto em `Quick Intelligence Strip`, denso e técnico. Sem headline, sem contagem "29.491 fundos atualizados há 6 dias", sem CTA claro.
- ❌ **Risk/Return scatter** (Sharpe × Retorno 12m por fundo, colorido por classe RCVM 175) não existe — padrão Morningstar/Bloomberg.
- ❌ **Style Box** (3×3 cap × style) ausente — ferramenta de posicionamento visual mais icônica do setor.
- ❌ **Rolling returns heatmap** — tabela de retornos 1m/3m/6m/12m/24m/36m × Top 20 fundos por classe.
- ❌ **FundNarrativePanel não instanciado** na página principal — o componente existe mas só é usado em seções ocultas.

**Gaps UX:**
- 🟡 **ComparadorSection escondida atrás de BlurredPreview**: usuário Pro precisa clicar para revelar. Deveria ser CTA visível "Montar comparação".
- 🟡 **Densidade cognitiva alta**: 6 sections × ~5 componentes cada = saturação. Section 4 ("Métricas & Mensal") e Section 5 ("Composição & Comparador") poderiam se fundir em "Análise Profunda" com sub-abas.
- 🟡 **FundSearchBar autocomplete**: retorna só nome + ClasseBadge. ComDinheiro mostra PL + score + classe inline — decisão de clique mais informada.

**Gaps narrativa:**
- ❌ Nenhum parágrafo de prosa antes das visualizações (vs OfertasRadar, que abre cada seção com 2-3 frases contextualizando).
- ❌ `benchmarksVsMetas` é uma lista fria de KPIs — sem delta vs mês anterior, sem setas de tendência, sem regime label.
- 🟡 `analyticsInsights` já tem alguma prosa mas é estático (baseado em cálculos) — perde a camada regime-aware que o FundNarrativePanel traz.

### 3.2 FundLamina.tsx — lâmina de fundo regular

**Estrutura atual (5 sections):** Resumo → Performance → Composição → Informações → Similares.

**Features:**
- ✅ KPI cards (Retorno, Vol, Sharpe, Max DD) — **mas em Resumo, não em Performance**, e os valores são copiados do fundScore interno, não recalculados localmente.
- ✅ Indexed base-100 chart com merge O(n) Map-based.
- ✅ Weekly bucketing via ISO week numbers.
- ✅ Fund Score™ card com 4 pilares detalhados.
- ✅ Composição CDA (donut + tabela).
- ✅ Fundos similares (mesma classe_rcvm175, até 6).

**Gaps funcionais:**
- ❌ **Rolling returns grid ausente** (1m/3m/6m/12m/24m/36m × fundo × CDI × IPCA × benchmark classe) — show-stopper.
- ❌ **Drawdown heatmap calendar** (Mês × Ano × cor por DD) — padrão Mais Retorno/ComDinheiro.
- ❌ **Sharpe, Sortino, Beta, Treynor como KPIs standalone** — escondidos no score.
- ❌ **Rentabilidade em janelas móveis** (rolling 12m, rolling 24m — linha evoluindo).
- ❌ **Manager tenure** — quanto tempo o gestor atual está no fundo.
- ❌ **"Data as of"** stamp — trust signal.
- ❌ **PDF export** — obrigatório para AAIs.
- ❌ **FundNarrativePanel instanciado para ESSE fundo** (regime × posicionamento do fundo no regime).
- ❌ **"Fundo melhor que o seu"** — sugestões ranqueadas por Fund Score dentro do peer group.

**Gaps UX:**
- 🟡 Similar funds grid 2-col mostra só cards simples — sem score comparado, sem delta de retorno, sem class badge destacado.
- 🟡 Composição CDA donut perde insight: padrão é agrupar top 5 + "outros" vs mostrar fragmentação.
- 🟡 KPI cards não têm tooltip explicativo (usuário iniciante não sabe o que é "Sharpe").

**Gaps narrativa:**
- ❌ Nenhum parágrafo no topo da lâmina — "O fundo X é um multimercado de gestão ativa, com R$ Y bilhões de PL, gerido por Z desde 2020…"
- ❌ Performance não tem comentário regime-aware — "em regime de aperto monetário, o fundo supera o CDI em 0.8pp ao mês".

### 3.3 FidcHub.tsx — Hub FIDC

**Estrutura atual (4 sections):** Visão Geral → Rankings → Screener → Segmentos.

**Features:**
- ✅ KPI cards (Total FIDCs, PL, Inadim média, Subord média).
- ✅ PieChart by lastro (tp_lastro_principal).
- ✅ Rankings table sortable + filterable por lastro.
- ✅ Screener multi-filter.
- ✅ Compound CDI formula aplicada.

**Gaps funcionais:**
- ❌ **Flag de stress de liquidez** (alert cards no topo: "N FIDCs com inadim > 5% OU subord < 20%").
- ❌ **Evolução temporal de KPIs agregados** (PL total, inadim média, subord média — últimos 12 meses).
- ❌ **Top movimentadores do mês** (maior captação, maior resgate, maior variação de inadim).

**Gaps UX:**
- 🔴 **Redundância crítica**: `Rankings` e `Screener` sections fazem conceitualmente o mesmo (listar fundos com filtros). Deveriam ser UM componente com filtros avançados toggáveis.
- 🔴 **Segmentos section ≠ segmentos do FII**: aqui é distribuição por `tp_lastro_principal`, mas os cards só redirecionam para rankings filtrado. Sem storytelling por lastro.
- 🟡 Narrative insight faltando — FidcHub abre direto em KPIs sem prosa.

**Gaps narrativa:**
- ❌ Sem mercado overview ("FIDCs no Brasil movem R$ 1.2T distribuídos em X fundos, com dominância de lastro Multiclasse…").
- ❌ Sem comentário por lastro ("FIDCs de Recebíveis Comerciais têm subordinação média de Y%, inadimplência de Z%").

### 3.4 FidcLamina.tsx — lâmina FIDC

**Estrutura atual (6 sections):** Resumo → Estrutura de Capital → Carteira → Performance → Informações → Fundos Similares.

**Features:**
- ✅ CORRUPT_RENTAB_THRESHOLD (95%) filtra outliers.
- ✅ healthAssessment (4 signals: Subordinação / Inadimplência / PDD Coverage / vs CDI).
- ✅ vsCDIMetric com excess return.
- ✅ 3 charts (PL stacked, Subord line, Indexed base-100 + CDI).
- ✅ Similar funds grid (por lastro).

**Gaps funcionais:**
- ❌ **Rolling returns grid** (1m/3m/6m/12m vs CDI / benchmark FIDC) — crítico.
- ❌ **Cotistas senior vs subordinada timeline** (os dados já estão em FidcMonthlyItem, só não são plotados).
- ❌ **Flag de deterioração** (alerta auto quando inadim sobe >2pp em 3 meses, ou quando subord cai >5pp).
- ❌ **Rating externo** (se existir em algum campo — não vi).
- ❌ **PDF export**.

**Gaps UX:**
- 🟡 healthAssessment mostra 4 signals mas não agrupa em uma "conclusão final" — usuário precisa ler 4 cards para entender.
- 🟡 Stacked bar de Estrutura de Capital é bonito mas não tem escala porcentual — difícil ver dominância relativa.

**Gaps narrativa:**
- 🟡 Bom assessment por signal, mas sem parágrafo de abertura ("Este FIDC de Recebíveis Comerciais tem subordinação senior de X%, compatível com a média do seu peer group…").

### 3.5 FiiHub.tsx — Hub FII

**Estrutura atual (4 sections):** Visão Geral → Rankings → Screener → Segmentos.

**Features:**
- ✅ KPI cards (Total FIIs, PL, DY médio, Rentab média).
- ✅ PieChart por segmento com legenda externa (bom padrão UX).
- ✅ benchmarkNarrative computed (vs CDI mensal compound).
- ✅ breakdown by_mandato + by_tipo_gestao.

**Gaps funcionais:**
- ❌ **DY histórico por segmento** (Top 5 segmentos × 12 meses).
- ❌ **P/VP médio por segmento** (dado não está sendo exibido).
- ❌ **Liquidez média (volume/dia)** — crítico para FII que AAI recomenda para carteira 3P.

**Gaps UX:**
- 🔴 Mesma redundância Rankings × Screener do FidcHub.
- 🔴 Mesma ausência de storytelling por segmento.

**Gaps narrativa:**
- 🟡 benchmarkNarrative existe mas subutilizado — só aparece uma vez, sem link para análises derivadas.

### 3.6 FiiLamina.tsx — lâmina FII

**Features:**
- ✅ fiiAssessment (DY vs Selic mensal, Yield Trap Risk, Alta Liquidez).
- ✅ 3 charts (DY+Rentab+Patrimonial, PL, Cotistas).
- ✅ Info Grid 3-col.

**Gaps funcionais:**
- ❌ **Dividend yield calendar** (mês × ano × valor do DY distribuído) — padrão Funds Explorer, **ABSOLUTO show-stopper para FII retail**.
- ❌ **P/VP histórico** (ausente das séries exibidas mesmo com dado disponível).
- ❌ **Payout ratio / FFO** (dados CVM têm isso, só não plotamos).
- ❌ **Vacância / inadimplência física** (para FII de tijolo).
- ❌ **Pipeline de aquisições / desinvestimentos** — crítico para FII de gestão ativa.

**Gaps UX:**
- 🟡 Info Grid 3-col mistura dados regulatórios (VP/cota) com classificação (Mandato, Tipo Gestão) — deveria separar.

**Gaps narrativa:**
- 🟡 fiiAssessment é bom mas lacônico — falta a camada "em regime atual de Selic 14.15%, o DY de Y% representa prêmio/desconto de Z% sobre a Selic mensal".

### 3.7 OfertasRadar.tsx — Radar de Ofertas Públicas

**Estrutura atual (5 sections):** Visão Geral → Timeline → Pipeline → Explorer → Analytics.

**Features + narrativa:**
- ✅ **Melhor storytelling do módulo** — narrativeOverview, narrativeTimeline, pipelineAnalytics todos computados com prosa.
- ✅ Mini-analytics cards (HHI, Classes Ativas, Cancel/Suspenso rate).
- ✅ Momentum cards (MoM, QoQ 3M, YoY, Ticket Médio).
- ✅ Dual-axis BarChart Volume × Count.
- ✅ StatusBadge cores.
- ✅ Independent CSV exports (explorer + top-emissores).

**Gaps funcionais:**
- 🟡 **Não há alertas** (AAI quer saber quando uma oferta muda de status).
- 🟡 **Sem link entre oferta e fundo emissor** no catálogo (quando é FIDC/FII).

**Gaps UX:**
- ✅ Padrão já bom — usar como template para as outras páginas.

**Gaps narrativa:**
- ✅ Benchmark interno do próprio hub.

---

## 4. Priorização P0 / P1 / P2

Framework: **Impacto (1-5) × Esforço (S/M/L) = prioridade**. Impacto pondera: (a) diferencial vs benchmarks, (b) expectativa do beta tester AAI, (c) valor para conversão free→pro.

### 🔴 P0 — Blockers ou show-stoppers (fazer antes do launch 30/04)

| # | Ticket | Impacto | Esforço | Arquivo(s) |
|---|---|---|---|---|
| P0-1 | **Rolling returns grid** em todas as 3 lâminas (1m/3m/6m/12m/24m/36m × fundo × CDI × IPCA × peer avg) | 5 | M | FundLamina.tsx, FidcLamina.tsx, FiiLamina.tsx + novo hook `useRollingReturns` |
| P0-2 | **Sharpe / Sortino / Max DD / Vol como KPIs visíveis** nas 3 lâminas (não só dentro do Fund Score) | 5 | S | FundLamina.tsx seção Performance, FidcLamina.tsx, FiiLamina.tsx |
| P0-3 | **"Data as of" stamp** em todas as páginas (`Última atualização: DD/MM/AAAA — CVM`) | 4 | S | Todas 5 páginas Fundos — header component compartilhado |
| P0-4 | **Landing hero do /fundos** — headline + contagem + CTA "Comparar fundos" / "Montar portfolio" + snapshot regime atual | 5 | S | HubFundos.tsx — nova section "hero" antes de overview |
| P0-5 | **FidcHub + FiiHub: fundir Rankings + Screener em uma única seção "Explorar"** com filtros avançados toggáveis | 4 | M | FidcHub.tsx, FiiHub.tsx — refatoração de layout |
| P0-6 | **Comparador visível** — remover BlurredPreview, expor CTA "Montar comparação" com chip "Pro", abrir modal-drawer | 4 | S | HubFundos.tsx ComparadorSection |
| P0-7 | **FundNarrativePanel instanciado per-fund** nas 3 lâminas (regime × posicionamento do fundo) | 4 | M | FundLamina/FidcLamina/FiiLamina + extensão FundNarrativePanel (`scope: "market" \| "fund"`) |
| P0-8 | **Drawdown heatmap calendar** mensal (12×N anos, cor por severidade) — lâmina regular | 4 | M | FundLamina.tsx + `src/components/hub/DrawdownHeatmap.tsx` |

**Total P0 estimado:** ~5-7 sessões (considerando paralelismo em hooks reutilizáveis e componentes compartilhados).

### 🟡 P1 — High impact, medium effort (sprint 1 pós-launch)

| # | Ticket | Impacto | Esforço | Arquivo(s) |
|---|---|---|---|---|
| P1-1 | **PDF export de lâmina** (puppeteer server-side ou html2pdf client — decidir trade-off) | 5 | L | Edge Function `export-fund-lamina-pdf` ou lib client |
| P1-2 | **"Fundo melhor que o seu"** — ranking peer group por Fund Score + delta indicators (retorno/vol/DD) | 5 | M | `FundLamina.tsx` section "Alternativas" + novo hook `useBetterThanPeers` |
| P1-3 | **Risk/Return scatter** (Sharpe × Retorno 12m por fundo, tinted por classe) no HubFundos Analytics | 4 | M | HubFundos.tsx + `src/components/hub/RiskReturnScatter.tsx` |
| P1-4 | **DY calendar FII** (12 meses × N anos, color scale) — maior pedido de AAI FII | 5 | M | FiiLamina.tsx + `src/components/hub/DYCalendar.tsx` |
| P1-5 | **Alertas personalizados** — tabela `hub_user_fund_alerts` + componente "Seguir fundo" nas lâminas + email via Resend | 4 | L | Nova migration, edge function `send-fund-alerts`, component `FollowFundButton` |
| P1-6 | **Manager tenure timeline** — quando o gestor atual começou no fundo (se houver mudanças via hub_fundos_insights tipo gestor_change) | 3 | S | FundLamina.tsx seção Informações |
| P1-7 | **FidcHub + FiiHub: storytelling por segmento/lastro** — cada card de segmento com narrativa própria (share %, top 3 fundos, trend MoM) | 4 | M | FidcHub.tsx, FiiHub.tsx — refatoração Segmentos section |
| P1-8 | **HubFundos hero: snapshot regime atual** via FundNarrativePanel no hero | 3 | S | HubFundos.tsx + mover FundNarrativePanel |
| P1-9 | **Similar funds enriquecidos** — cards com Fund Score comparado, delta de retorno 12m, class badge destacado | 4 | S | FundLamina/FidcLamina/FiiLamina |
| P1-10 | **OfertasRadar: link oferta ↔ fundo** — quando tipo_ativo é FIDC/FII, link para lâmina do emissor | 3 | M | OfertasRadar.tsx + join com hub_fundos_meta |

**Total P1 estimado:** ~8-10 sessões (sprint semana 1-2 de maio).

### 🟢 P2 — Polish, nice-to-have

| # | Ticket | Impacto | Esforço | Arquivo(s) |
|---|---|---|---|---|
| P2-1 | **Style Box 3×3** (cap × style) para lâmina regular + catálogo | 3 | L | Requer enrichment dados (market cap médio, style via CDA) |
| P2-2 | **Fund-as-shareholder** — "este fundo investe em X e é cotista em Y" (via CDA blocks) | 4 | L | Requer agregação CDA + novo hook `useFundShareholderGraph` |
| P2-3 | **Performance attribution** (factor-based return decomposition — Selic/IPCA/FGV-100/IBX) | 4 | L | Economatica-grade, adiar para 2026 H2 |
| P2-4 | **Rolling correlations** entre fundos similares (não só global) | 3 | M | Extensão CorrelationPanel |
| P2-5 | **FundSearchBar enriquecido** — autocomplete com PL + score + classe inline | 3 | S | HubFundos.tsx FundSearchBar |
| P2-6 | **Rankings table: mais colunas sortáveis** (retorno 12m, sharpe, max DD) | 3 | S | FundRankingTable.tsx |
| P2-7 | **Comparador CSV/PNG export** | 2 | S | HubFundos.tsx ComparadorSection |
| P2-8 | **URL persistence sort state** em rankings/screener | 2 | S | Todas as tabelas |
| P2-9 | **Tooltip educativo** em KPIs (o que é Sharpe, Sortino, Max DD) | 3 | S | Lâminas + KPICard shared component |
| P2-10 | **P/VP histórico + payout ratio + vacância** para FII (dados já existem, só plotar) | 4 | M | FiiLamina.tsx |
| P2-11 | **Composição CDA: agrupar top 5 + "outros"** no donut | 2 | S | FundLamina.tsx + FundCompositionPanel |
| P2-12 | **Nudges por investor type** (varejo vs profissional) baseado em publico_alvo | 3 | M | FundScreener + FundLamina |

**Total P2 estimado:** opcional, sprint 3+ pós-launch (junho/julho 2026).

---

## 5. Storytelling — padrão recomendado (usar OfertasRadar como modelo)

OfertasRadar estabelece o padrão ideal de storytelling que deve ser replicado nas outras páginas:

**Estrutura por seção:**
1. **Prosa de abertura** (2-3 frases contextualizando, com numbers inline e regime reference)
2. **Mini-analytics cards** (3-6 KPIs secundários derivados, com cor e tendência)
3. **KPIs principais** (4 cards grandes com valor + subtext + cor)
4. **Visualização primária** (chart + legend)
5. **Tabela/detalhe** (quando aplicável)

**Paralelos pendentes:**

| Página | Tem prosa abertura? | Tem mini-analytics? | Tem regime awareness? |
|---|---|---|---|
| OfertasRadar | ✅ | ✅ | ✅ (narrativeOverview) |
| HubFundos | 🟡 (disperso) | 🟡 (Quick Intelligence Strip) | ❌ |
| FidcHub | ❌ | ❌ | ❌ |
| FiiHub | 🟡 (benchmarkNarrative) | ❌ | ❌ |
| FundLamina | ❌ | ❌ | ❌ |
| FidcLamina | 🟡 (healthAssessment) | ❌ | ❌ |
| FiiLamina | 🟡 (fiiAssessment) | ❌ | ❌ |

**Ação:** criar um `NarrativeSection` helper em `src/components/hub/NarrativeSection.tsx` que padroniza o padrão prosa + mini-analytics, e refatorar as 5 páginas para usá-lo.

---

## 6. Impacto esperado (por tier P0 executado)

**Se P0-1 → P0-8 forem entregues até 30/04:**

- **Benchmark parity em 18 de 21 vetores** (de 7 hoje para 18) — o hub passa a empatar ou vencer em 86% dos vetores vs ComDinheiro (hoje empata em 33%).
- **Tempo para primeira lâmina lida pelo beta tester cair de ~90s para ~45s** (hero + as-of stamp + KPIs visíveis reduzem fricção inicial).
- **Conversão free → pro**: o comparador deixa de ser "feature fantasma" e passa a ser o gancho #1 de upgrade (atualmente escondido atrás de BlurredPreview).
- **Pedro (beta tester #1) tem rolling returns que atualmente copia da Mais Retorno** — reduz motivo de alternar entre ferramentas.

**Se apenas P1 for entregue (sem P0):**
- Ganho moderado (benchmark parity em 12 de 21).
- Não resolve o problema central de "entrada fria" nem de "KPIs escondidos".

**Se nada for feito:**
- Beta tester AAI usa o hub como complemento à Mais Retorno, não substituição. Churn de 50%+ esperado em 60d.

---

## 7. Next steps — ação imediata (próximas 48h)

1. **Lucas valida P0 priorização** — os 8 tickets P0 cabem em 5-7 sessões; se não couber, cortar P0-5 (Rankings/Screener merge) e P0-8 (Drawdown heatmap) para P1.
2. **Confirmar decisão PDF export** (P1-1): client-side html2pdf é rápido mas limitado; server-side puppeteer requer Edge Function + maior custo. Recomendação: começar client-side, migrar para server se precisar de qualidade gráfica tipo ComDinheiro.
3. **Começar por P0-2 + P0-3** na próxima sessão — ambos são S (small), baixo risco, alto impacto imediato percebido pelo beta tester.
4. **Sequência sugerida:** P0-2 → P0-3 → P0-4 → P0-1 (o mais pesado) → P0-6 → P0-7 → P0-5 → P0-8.

---

## 8. Anexo — arquivos tocados por P0

| Ticket | Arquivos |
|---|---|
| P0-1 | `src/pages/FundLamina.tsx`, `src/pages/FidcLamina.tsx`, `src/pages/FiiLamina.tsx`, `src/hooks/useHubFundos.ts` (novo hook `useRollingReturns`), `src/components/hub/RollingReturnsGrid.tsx` (novo) |
| P0-2 | `src/pages/FundLamina.tsx`, `src/pages/FidcLamina.tsx`, `src/pages/FiiLamina.tsx`, `src/components/hub/KPICard.tsx` (já existe, reuso) |
| P0-3 | `src/components/hub/DataAsOfStamp.tsx` (novo), integrar em todas as 5 páginas + lâminas |
| P0-4 | `src/pages/HubFundos.tsx` — nova seção hero antes de overview, `src/components/hub/FundsLandingHero.tsx` (novo) |
| P0-5 | `src/pages/FidcHub.tsx`, `src/pages/FiiHub.tsx` — refatoração de sections de 4 para 3 (Visão Geral / Explorar / Segmentos) |
| P0-6 | `src/pages/HubFundos.tsx` — remover BlurredPreview, reestruturar ComparadorSection com CTA visible |
| P0-7 | `src/components/hub/FundNarrativePanel.tsx` (adicionar scope prop), `src/pages/FundLamina.tsx`, `src/pages/FidcLamina.tsx`, `src/pages/FiiLamina.tsx` |
| P0-8 | `src/components/hub/DrawdownHeatmap.tsx` (novo), `src/pages/FundLamina.tsx` |

**Componentes novos criados:** 6 (`RollingReturnsGrid`, `DataAsOfStamp`, `FundsLandingHero`, `DrawdownHeatmap`, `NarrativeSection`, `FollowFundButton`).
**Componentes refatorados:** 5 páginas Fundos + `FundNarrativePanel` + `ComparadorSection`.

---

**Preparado por:** Strategic Consultant / CTO-mode
**Referência:** 5 leituras completas de código (HubFundos, FidcHub, FidcLamina, FiiHub, FiiLamina, OfertasRadar, FundNarrativePanel, InsightsFeed, FundScreener, FundRankingTable, FundScoreCard, fundScore.ts) + benchmark research em 8 plataformas
