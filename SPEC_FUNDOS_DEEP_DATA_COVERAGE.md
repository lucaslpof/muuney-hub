# SPEC — Fundos Deep Data Coverage (post-launch backlog)

Status: aprovação pendente (Lucas).
Criado: 26/04/2026.
Owner: Lucas.
Sprints: 7 (S1 → S7), ~10 semanas calendar (maio 1ª sem → julho 4ª sem 2026).
Total deliverables: 16 features × 3 classes (algumas só aplicam a 1 classe) + 4 transversais = **23 entregáveis técnicos** + UI/UX/docs.

Premissa pré-launch: **Sprint 0 NÃO adiciona features novas**. Janela 27-30/04 fica para QA + smoke + push de backlog (incluindo `fae05b5` FIP V2). Risco de quebrar build pré-30/04 com nova ETL não compensa o ganho.

---

## §0 TL;DR — sprint-by-sprint

| Sprint | Janela | Deliverable principal | Esforço | Custo externo |
|---|---|---|---|---|
| S1 | 01-08/05 | Eventos Relevantes (transversal) + FIDC Tabs X_4/X_5/X_7 | 4-5d | $0 |
| S2 | 09-15/05 | Sanções CVM + Distribuições/amortizações declaradas | 5d | $0 |
| S3 | 16-22/05 | B3 daily quotes FII completo (preço, volume, P/VP absoluto) | 5d | $0-50 (B3 dados públicos via UP2DATA) |
| S4 | 23-29/05 | Atas de assembleia metadados + FIDC Inf Trimestral DRE + Cancelamentos histórico | 5d | $0 |
| S5 | 30/05-12/06 | LLM extraction: Anexo 14-V FII + Anexo 14-VII FIP | 10d | ~$200-300 backfill (Sonnet 4.5) |
| S6 | 13-26/06 | DFs anuais auditadas (XBRL FIDC/FIP) + DFs semestrais FII + Composição IFIX | 10d | $0-100 (LLM notas explicativas) |
| S7+ | jul-set | Prospectos+Regulamentos LLM + ANBIMA cross-ref + Receita CNPJ situação | 15d | ~$500-800 (full prospectos) |

Custo externo total ano: **<$1.500** se backfill agressivo, ~$400 se conservador.

---

## §1 Backlog matrix — 16 features × classe × tier

| # | Feature | FIDC | FII | FIP | Transv | Tier | Sprint |
|---|---|---|---|---|---|---|---|
| 1 | FIDC Tabs faltantes (III/VII/IX/X_4-7) | ✓ | — | — | — | T1 | S1 |
| 2 | **Eventos Relevantes / Comunicados** | ✓ | ✓ | ✓ | ✓ | T1 | S1 |
| 3 | **Sanções CVM gestor/admin** (PAS, TLT) | ✓ | ✓ | ✓ | ✓ | T2 | S2 |
| 4 | **Distribuições/Amortizações declaradas** | ✓ | ✓ | ✓ | ✓ | T2 | S2 |
| 5 | B3 daily quotes FII (preço/volume/P-VP) | — | ✓ | — | — | T2 | S3 |
| 6 | **Atas de assembleia metadados** | ✓ | ✓ | ✓ | ✓ | T2 | S4 |
| 7 | FIDC Inf Trimestral DRE | ✓ | — | — | — | T2 | S4 |
| 8 | Concessões/Cancelamentos histórico | ✓ | ✓ | ✓ | — | T2 | S4 |
| 9 | Anexo 14-V FII LLM (vacância+inquilinos) | — | ✓ | — | — | T3 | S5 |
| 10 | Anexo 14-VII FIP LLM (carteira investida) | — | — | ✓ | — | T3 | S5 |
| 11 | DFs anuais auditadas (XBRL/XML) | ✓ | ✓ | ✓ | — | T3 | S6 |
| 12 | DFs semestrais FII | — | ✓ | — | — | T3 | S6 |
| 13 | Composição IFIX | — | ✓ | — | — | T3 | S6 |
| 14 | Prospectos + Regulamentos LLM | ✓ | ✓ | ✓ | — | T4 | S7 |
| 15 | ANBIMA classification + índices | ✓ | ✓ | ✓ | — | T4 | S7 |
| 16 | Receita CNPJ situação cadastral | ✓ | ✓ | ✓ | — | T4 | S7 |

**Bold** = transversais (4 que listamos como mais valiosos).

---

## §2 Sprint detail

### Sprint 1 (01-08/05) — Eventos Relevantes + FIDC tabs

**S1-1: FIDC Tabs X_4 / X_5 / X_7** (1d)
- Tabs pequenas (~1 row/fundo), reativar no parser sem quebrar 256MB budget
- X_4 (datas distribuição), X_5 (amortizações programadas), X_7 (limites aplicação)
- Migration: `hub_fidc_mensal` +9 cols (dt_distrib_proxima, dt_amortiz_proxima, vl_amortiz_programada, pct_amortiz_pl, limit_max_cedente_pct, limit_max_sacado_pct, limit_max_setor_pct, limit_concentracao_externo_pct, limit_alavancagem_pct)
- ingest-cvm-data v7: adicionar X_4/X_5/X_7 ao `isRelevantTab` filter + parser branches
- Re-ingest 6 meses (Out25→Mar26)
- UI: KPIs em FidcLamina seção Carteira ("Próxima amortização: 15/05/2026 · R$ 2,3M")

Tabs III/VII/IX **diferidas** para S6 (precisam de mais memory budget; espera-se Edge Functions Supabase liberarem 512MB pós-launch — em revisão).

**S1-2: Eventos Relevantes / Comunicados** (3d) ⭐ alta prioridade
- Investigar endpoint: candidatos `https://www.rad.cvm.gov.br/ENET/...`, RSS feed CVM, ou portal-dados-abertos
- Tabela `hub_fundos_eventos`:
  ```sql
  CREATE TABLE hub_fundos_eventos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cnpj_fundo text NOT NULL,
    cnpj_fundo_classe text,
    dt_publicacao timestamptz NOT NULL,
    tipo text CHECK (tipo IN ('fato_relevante','comunicado_mercado','aviso_cotistas','outros')),
    titulo text NOT NULL,
    full_text_snippet text,                  -- primeiros 500 chars
    url_documento text,
    severidade text CHECK (severidade IN ('info','attention','critical')) DEFAULT 'info',
    keywords_detected text[],
    ingested_at timestamptz DEFAULT now()
  );
  ```
- Edge Function `ingest-cvm-eventos` (daily 03:00 UTC, paginated, dedup por url_documento)
- Severidade detection (regex/LLM-light): default, suspensão_resgate, mudança_gestor, evento_avaliação → critical; aquisição, distribuição_extraordinária → attention
- pg_cron job `ingest-cvm-eventos-daily`
- UI:
  - Banner "⚠️ 2 eventos relevantes nos últimos 7d" no topo de FidcLamina/FiiLamina/FipLamina
  - Página `/fundos/:slug/eventos` (timeline completa)
  - Integração com `hub_fundos_insights`: novos tipos `fund_event_critical`, `fund_event_attention`
- Hook `useFundEvents(cnpj, days)` em `useHubFundos.ts`

**S1-3: build + commit + push + smoke** (0.5d)

---

### Sprint 2 (09-15/05) — Sanções CVM + Distribuições

**S2-1: Sanções CVM gestor/administrador** (3d)
- Fonte: `https://www.gov.br/cvm/pt-br/assuntos/regulados/comissao-de-valores-mobiliarios/processos-administrativos-sancionadores` (HTML, scraping necessário) OR portal aberto se houver feed estruturado
- Tabela `hub_cvm_sancoes`:
  ```sql
  CREATE TABLE hub_cvm_sancoes (
    id uuid PRIMARY KEY,
    cnpj_pessoa text NOT NULL,
    tipo_pessoa text CHECK (tipo_pessoa IN ('PF','PJ')),
    nome_pessoa text,
    nr_processo text NOT NULL,
    data_julgamento date,
    data_publicacao date,
    status text CHECK (status IN ('em_curso','julgado','arquivado','tlt_assinado')),
    tipo_sancao text,
    descricao text,
    valor_multa numeric(15,2),
    url_decisao text
  );
  ```
- ETL: Edge Function `ingest-cvm-sancoes` (weekly, scraping with retry/circuit-breaker)
- Cross-ref: `hub_fundos_meta.cnpj_gestor` / `cnpj_admin` → match em hub_cvm_sancoes
- View `v_fundo_risco_regulatorio` agregando contagem de processos por CNPJ
- UI: badge "Gestor com 3 processos sancionadores (1 crítico)" em FidcLamina/FiiLamina/FipLamina header

**S2-2: Distribuições/Amortizações declaradas** (2d)
- Fontes:
  - FII: B3 dividend events (avisos.b3.com.br) ou CVM "Aviso aos Cotistas" via Eventos Relevantes (S1-2)
  - FIDC: extrair de Tab X_5 (já em S1-1)
  - FIP: chamadas de capital via Eventos Relevantes (S1-2)
- Tabela `hub_fundos_eventos_caixa`:
  ```sql
  CREATE TABLE hub_fundos_eventos_caixa (
    id uuid PRIMARY KEY,
    cnpj_fundo text NOT NULL,
    data_ex date NOT NULL,
    data_pagamento date,
    tipo text CHECK (tipo IN ('dividendo','amortizacao','chamada_capital','distribuicao')),
    valor_por_cota numeric(15,4),
    valor_total numeric(15,2),
    classe_cota text,                   -- senior/subord/mezanino para FIDC
    fonte text                          -- 'b3'|'cvm_aviso'|'cvm_evento'|'cvm_inf_mensal'
  );
  ```
- Reusa `useFundEvents` + filtro tipo
- UI: timeline na lâmina ("Próximo dividendo: R$ 1,12/cota · ex 30/05") + alert system

---

### Sprint 3 (16-22/05) — B3 daily quotes FII

**S3-1: ETL B3** (3d)
- Investigar fonte (em ordem de preferência):
  1. UP2DATA negociação histórica (gratuito mas precisa cadastro)
  2. bvmf-data.com.br (terceiros, scraping leve)
  3. brapi.dev (proxy gratuito B3)
- Tabela `hub_fii_b3_diario`:
  ```sql
  CREATE TABLE hub_fii_b3_diario (
    cnpj_fundo text NOT NULL,
    ticker text NOT NULL,
    dt date NOT NULL,
    open numeric(15,2),
    high numeric(15,2),
    low numeric(15,2),
    close numeric(15,2),
    volume_quantidade bigint,
    volume_financeiro numeric(15,2),
    qtd_negocios integer,
    market_cap numeric(15,2),
    PRIMARY KEY (cnpj_fundo, dt)
  );
  ```
- Edge Function `ingest-b3-fii-quotes` daily 7h UTC
- Backfill 24m (~500d × 250 FIIs líquidos = 125k rows)
- Incluir composição IFIX (S6 mas pode adiantar)

**S3-2: UI integration** (2d)
- `FiiB3Panel`: chart preço×VP/cota (linhas overlapping), ágio/deságio P/VP absoluto histórico, comparação com IFIX
- KPIs: market cap atual, volume médio diário 30d, ágio/deságio % atual + percentil 1y
- Hooks `useFiiB3Quotes(cnpj, days)` + `useFiiB3Latest(cnpj)`
- Integrar em FiiLamina entre Resumo e Performance

---

### Sprint 4 (23-29/05) — Atas + FIDC Trimestral + Cancelamentos

**S4-1: Atas de assembleia metadados** (2d)
- Fonte: RAD CVM "Convocação de Assembleia" + "Ata"
- Tabela `hub_fundos_atas`:
  ```sql
  CREATE TABLE hub_fundos_atas (
    id uuid PRIMARY KEY,
    cnpj_fundo text NOT NULL,
    dt_assembleia date NOT NULL,
    tipo text CHECK (tipo IN ('AGO','AGE','OAGE')),
    pauta_titulo text,
    deliberacao_resumo text,
    quorum_pct numeric(5,2),
    url_ata text,
    url_convocacao text,
    status text CHECK (status IN ('convocada','realizada','suspensa'))
  );
  ```
- ETL diário (mesmo pipeline de Eventos)
- UI: section "Assembleias" na lâmina (timeline próximas + últimas 6 meses)

**S4-2: FIDC Inf Trimestral** (2d)
- URL: `/dados/FIDC/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fidc_YYYYMM.csv` (verificar existência)
- Fields: DRE granular (receita_op_credito, despesa_op_credito, resultado_carteira, despesas_PDD, despesa_taxa_adm, lucro_liquido_trim)
- Tabela `hub_fidc_trimestral`
- Edge Function `ingest-cvm-fidc-trimestral` (quarterly)
- UI: painel DRE em FidcLamina (BarChart com receitas vs despesas)

**S4-3: Concessões/Cancelamentos** (1d)
- Fonte: registro CVM (status do fundo)
- Já temos `hub_fundos_meta.sit` parcialmente — completar com histórico de mudanças
- Tabela `hub_fundos_cancelamentos`
- Métrica: % de fundos cancelados por gestor nos últimos 24m → sinal de risco no GestoraRanking

---

### Sprint 5 (30/05-12/06) — LLM extraction (Anexo 14-V/14-VII)

**S5-1: Anexo 14-V FII** (5d)
- Activate scaffold `extract-fii-anexo14v` (já tem em supabase/functions/)
- Apply migration `PENDING_fii_trimestral_anexo14v.sql` (já escrito)
- Pipeline:
  1. Discovery RAD (HTML scrape ou API se houver)
  2. Download PDF
  3. pdf-parse Deno-compat (escolher lib: `deno-pdf-parse` ou pdf.js-extract)
  4. Anthropic Claude Sonnet 4.5 com tool_use schema (24 campos + array top 5 inquilinos)
  5. Zod validate + sanity checks (vacância 0-100%, soma top5 ≤ 100, ABL_locada+vaga ≈ ABL_total ±5%)
  6. Upsert hub_fii_trimestral + hub_fii_inquilinos transactional
  7. Audit log hub_fii_extraction_log
- Filtro PL > R$100M Tijolo (~200 FIIs) × 1 trimestre primeiro = ~$60 (~30k input + 2k output × $3 input + $15 output Sonnet 4.5)
- Backfill 4 trimestres = ~$240
- UI: `FiiCarteiraDepthPanel` (vacância KPIs, mix receitas donut, top 5 inquilinos table)

**S5-2: Anexo 14-VII FIP** (5d)
- Spec análogo: SPEC_FIP_LLM_EXTRACTION.md (a criar mirror do FII)
- Migration `hub_fip_investidas` + `hub_fip_extraction_log`:
  ```sql
  CREATE TABLE hub_fip_investidas (
    cnpj_fundo text NOT NULL,
    dt_referencia date NOT NULL,
    cnpj_investida text NOT NULL,
    nome_investida text,
    setor_cnae_principal text,
    setor_descricao text,
    vl_investido numeric(15,2),
    pct_pl numeric(5,2),
    estagio text CHECK (estagio IN ('venture','growth','buyout','distressed','outros')),
    dt_aquisicao_inicial date,
    PRIMARY KEY (cnpj_fundo, dt_referencia, cnpj_investida)
  );
  ```
- Edge Function `extract-fip-anexo14vii`
- Pipeline idêntico ao FII com schema diferente
- Filtro PL > R$500M (~150 FIPs) × 1 quadrimestre = ~$45
- Backfill 3 quadrimestres = ~$135
- UI: `FipCarteiraInvestidaPanel` (top 10 investidas + breakdown setor donut)

---

### Sprint 6 (13-26/06) — DFs auditadas + IFIX

**S6-1: DFs anuais auditadas (FIDC/FIP)** (5d)
- Fonte: CVM DFP/ITR sistema EMP
- Formato: XBRL ou XML estruturado (CVM tem padrão)
- Tabela `hub_fundos_dfs_anuais`:
  ```sql
  CREATE TABLE hub_fundos_dfs_anuais (
    cnpj_fundo text NOT NULL,
    ano integer NOT NULL,
    tipo_doc text CHECK (tipo_doc IN ('DF_anual_auditada','ITR_trimestral')),
    bp_ativo_total numeric(15,2),
    bp_passivo_total numeric(15,2),
    bp_pl numeric(15,2),
    dre_receita_op numeric(15,2),
    dre_despesa_op numeric(15,2),
    dre_resultado_periodo numeric(15,2),
    dfc_caixa_op numeric(15,2),
    auditor_nome text,
    auditor_cnpj text,
    parecer_ressalvas boolean,
    parecer_descricao text,
    url_pdf_completo text,
    PRIMARY KEY (cnpj_fundo, ano, tipo_doc)
  );
  ```
- Parser XBRL Python (Edge Function pode ser pesada — considerar GitHub Actions ou Supabase Worker)
- UI: section "Demonstrações" na lâmina + KPIs estruturados

**S6-2: DFs semestrais FII** (3d)
- Mesmo modelo + extra: reavaliações de imóveis + transações partes relacionadas (LLM extract via notas explicativas)

**S6-3: Composição IFIX** (2d)
- Feed B3 (composição diária)
- Tabela `hub_indices_composicao`:
  ```sql
  CREATE TABLE hub_indices_composicao (
    indice text NOT NULL,                    -- 'IFIX', 'IBOV', 'IDA-DI', etc.
    dt date NOT NULL,
    ticker text NOT NULL,
    cnpj_fundo text,
    peso_pct numeric(7,4),
    PRIMARY KEY (indice, dt, ticker)
  );
  ```
- UI: badge "IFIX (peso 2.34%)" na FiiLamina + chart de evolução do peso

---

### Sprint 7+ (Q3 2026) — Profundidade qualitativa

**S7-1: Prospectos + Regulamentos LLM** (10d, ~$500-800)
- Maior valor qualitativo: política de investimento, max alavancagem, restrições, política de liquidação, política de distribuição, taxa de performance fórmula
- Backfill ~3000 fundos relevantes (PL>R$50M)
- Custo: ~$0.15-0.30/fundo × 3000 = $450-900

**S7-2: ANBIMA cross-ref** (5d)
- Classificação ANBIMA mais granular que CVM (sub-classes de FIDC, FII Tijolo/Papel/Híbrido com sub-categorias)
- Índices benchmark: IDA-DI, IDA-IPCA, IRF-M, IMA-Geral
- Requer partnership ANBIMA (gratuito para informação pública)
- Cross-ref via CNPJ

**S7-3: Receita CNPJ situação** (3d)
- API Receita Federal pública (ou serviços tipo brapi)
- Daily check de status do gestor (ativo/baixado/inapto/suspenso)
- Sinal de risco crítico se gestor inativo
- Rate limit: 100 req/dia gratuito → batched check semanal

---

## §3 Per-feature schemas (resumo)

Tabelas novas a criar (10):
1. `hub_fundos_eventos` — S1
2. `hub_cvm_sancoes` — S2
3. `hub_fundos_eventos_caixa` — S2
4. `hub_fii_b3_diario` — S3
5. `hub_fundos_atas` — S4
6. `hub_fidc_trimestral` — S4
7. `hub_fundos_cancelamentos` — S4
8. `hub_fii_trimestral` + `hub_fii_inquilinos` + `hub_fii_extraction_log` — S5 (já PENDING)
9. `hub_fip_investidas` + `hub_fip_extraction_log` — S5
10. `hub_fundos_dfs_anuais`, `hub_indices_composicao` — S6

Edge Functions novas (8):
- `ingest-cvm-eventos` (S1)
- `ingest-cvm-sancoes` (S2)
- `ingest-b3-fii-quotes` (S3)
- `ingest-cvm-atas` (S4)
- `ingest-cvm-fidc-trimestral` (S4)
- `extract-fii-anexo14v` (S5 — scaffold pronto)
- `extract-fip-anexo14vii` (S5)
- `ingest-cvm-dfs-xbrl` (S6)

pg_cron jobs novos (5):
- daily 03:00: ingest-cvm-eventos
- weekly Mon 04:00: ingest-cvm-sancoes
- daily 07:00: ingest-b3-fii-quotes
- daily 03:30: ingest-cvm-atas
- quarterly day-15 06:00: ingest-cvm-fidc-trimestral

Frontend componentes novos (12):
- `FundEventsBanner` (S1) + `/fundos/:slug/eventos` page
- `GestorRiskBadge` (S2)
- `EventosCaixaTimeline` (S2)
- `FiiB3Panel` (S3)
- `FundAssembleiasPanel` (S4)
- `FidcDREPanel` (S4)
- `FundCancelamentosBadge` (S4)
- `FiiCarteiraDepthPanel` (S5 — vacância+inquilinos)
- `FipCarteiraInvestidaPanel` (S5 — top investidas+setor)
- `FundDFsPanel` (S6)
- `FiiIfixBadge` (S6)
- `FundProspectoSummary` (S7)

---

## §4 Dependencies graph

```
S1 (paralelo): FIDC tabs + Eventos
   ↓
S2 (paralelo): Sanções + Distribuições (depende de Eventos para distribuições)
   ↓
S3: B3 quotes (independente)
   ↓
S4 (paralelo): Atas + FIDC trim + Cancelamentos (Atas depende de pipeline Eventos)
   ↓
S5 (paralelo): Anexo 14-V FII + Anexo 14-VII FIP (independentes mas LLM cost compartilhado)
   ↓
S6 (paralelo): DFs auditadas + IFIX (independentes)
   ↓
S7+: profundidade qualitativa
```

Crítico: **S1 Eventos é dependência de S2 Distribuições e S4 Atas** — não pode atrasar S1 sem comprometer S2/S4.

---

## §5 Risks & mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Endpoint CVM Eventos não documentado | High | S1 começa com 1d de investigação (RAD HTML/RSS/portal-dados-abertos). Plano B: scraping CVM site direto com cache. |
| FIDC tabs (X_4/X_5/X_7) estouram 256MB Edge memory | Medium | Adicionar uma de cada vez, monitorar logs. Plano B: split em duas chamadas (small tabs + big tabs). |
| B3 sem API gratuita | Medium | UP2DATA com login + brapi.dev como fallback. Plano C: scraping bvmfbovespa.com.br conservador (1 req/sec). |
| LLM cost escalando (S5+S7) | Medium | Filtros de PL agressivos + cache trimestral + backfill incremental (1 trimestre × validação manual antes de full backfill). |
| Sanções CVM PAS sem feed estruturado | High | Scraping HTML + parsing manual primeiro pull. Iteração 1 pode ter cobertura parcial. |
| XBRL DFs CVM complexo | Medium | Começar com 5 fundos (3 FIDC + 2 FIP), expandir gradualmente. Lib `python-xbrl` ou `arelle`. |
| pg_cron memory creep | Low | Stagger jobs em horários distintos (03:00, 03:30, 04:00, 07:00). |

---

## §6 Success metrics

**Cobertura:**
- ✅ Eventos Relevantes: ≥95% dos fundos PL>R$10M com pipeline ativo daily
- ✅ B3 quotes FII: ≥250 FIIs líquidos com 24m histórico
- ✅ LLM extraction: ≥90% match com leitura manual em sample 10 fundos por classe
- ✅ DFs anuais: ≥1000 fundos PL>R$50M com último ano disponível parsed

**Engajamento (medir 30d pós-launch de cada feature):**
- ≥60% dos beta AAIs visitam `/fundos/:slug/eventos` ao menos 1×/semana
- ≥40% dos beta AAIs reportam que viram alerta crítico que mudou decisão de alocação
- ≥80% das lâminas FII abertas exibem painel B3 (uso passivo, mas indica integração visual ok)

**Custo:**
- LLM total ano <$1.500
- Storage Supabase <2GB para todas as novas tabelas (estimativa: eventos 100k rows, B3 125k, atas 50k, sanções 5k, DFs 20k)

---

## §7 Open questions (decisões a tomar antes de cada sprint)

**Pré-S1:**
- Endpoint CVM Eventos: portal-dados-abertos tem feed JSON ou só HTML scraping?
- FIDC Tabs III/VII/IX: deferimos para S6 ou tentamos juntar em S1 com filter mais inteligente?

**Pré-S2:**
- Sanções: aceita-se cobertura parcial inicial (só PAS julgados, sem em curso) para acelerar?
- Distribuições FIP: chamadas via Eventos OU via pull direto do portal CVM "convocações"?

**Pré-S3:**
- B3: paga UP2DATA (~R$200/mês mas oficial) ou usa brapi.dev gratuito?
- Backfill 24m ou 36m? Storage marginal mas habilita análises de ciclo completo.

**Pré-S5:**
- Filtro PL FII: $100M (200 FIIs, $240/ano) ou $50M (350 FIIs, $420/ano)?
- Filtro PL FIP: $500M (150 FIPs, $135/ano) ou $200M (300 FIPs, $270/ano)?

**Pré-S6:**
- XBRL: built-in Edge Function (Deno) ou GitHub Actions cron com Python?

**Pré-S7:**
- Prospectos: backfill todos ~3000 ou priorizar só Pro tier (~600)?
- ANBIMA: tentar partnership formal ou começar com dados públicos site?

---

## §8 Cronograma launch-aligned

```
Pré-launch (27-30/04): smoke test + push backlog (FIP V2 fae05b5)
                       ZERO features novas
                ↓
Launch 30/04 ──────────────────────────
                ↓
Maio 1-8 (S1):   Eventos Relevantes [TIER 1 BIG WIN] + FIDC tabs
Maio 9-15 (S2):  Sanções + Distribuições
Maio 16-22 (S3): B3 quotes FII
Maio 23-29 (S4): Atas + FIDC trim + Cancelamentos
                ↓
Junho 1-15 (S5): LLM Anexo 14-V FII + 14-VII FIP
Junho 16-26 (S6): DFs + IFIX
                ↓
Julho-Setembro (S7+): Prospectos + ANBIMA + Receita CNPJ
```

Beta AAI feedback collected ao longo de S1-S4 vai pivotar prioridade S5-S7.

---

## §9 Próximas ações imediatas (esta semana, antes de S1)

1. **Aprovação SPEC**: Lucas review este doc, comentar §7 (open questions)
2. **Investigação Eventos CVM** (1-2h): identificar endpoint preferido (RSS/JSON/HTML scraping). Resultado define complexidade S1-2.
3. **Provisionar Anthropic API key** em Supabase secrets (`ANTHROPIC_API_KEY`) para preparar S5
4. **Decidir B3 source** (UP2DATA vs brapi vs scraping) — define S3-1
5. Atualizar **CLAUDE.md** com referência a este SPEC (linha em "Pendente — Código / Backend")

---

**Status doc**: V1 — 26/04/2026. Aprovação Lucas pendente para iniciar S1 (01/05).

---

## §10 Diagnóstico endpoints CVM (investigação 26/04)

Investigação de 30min via `dados.cvm.gov.br/dados/` revelou **mais fontes estruturadas em CSV do que assumido**, eliminando 2 dos 3 sprints LLM e adicionando 3 novas fontes não-mapeadas. Custo total LLM cai de ~$1.500/ano → ~$300/ano.

### §10.1 Endpoints confirmados (CSV/ZIP estruturado)

| Endpoint | Cobertura | Periodicidade | Tamanho/ano | Achado |
|---|---|---|---|---|
| `/dados/FI/DOC/EVENTUAL/DADOS/eventual_fi_YYYY.csv` | FI + FIDC + FII + FIP + FIAGRO + classes | Daily ingestão | ~10MB CSV/ano (~100k entries) | ⭐ Eventos Relevantes (Fato Relev / Aviso Mercado / AGO/AED / Rel. Rating / Regulamento) — **TIER 1 confirmado** |
| `/dados/FI/DOC/LAMINA/DADOS/lamina_fi_YYYYMM.zip` | FI + FIDC + FII + FIP | Monthly | ~700KB/mês × 12 = 8MB/ano | ⭐⭐ Lâminas **estruturadas em CSV**: OBJETIVO, POLIT_INVEST, RESTR_INVEST, TAXA_ADM/PERFM/ENTR/SAIDA, INVEST_MIN, PR_PL_ALAVANC, CLASSE_RISCO. Elimina LLM prospecto p/ campos básicos. |
| `/dados/FI/DOC/BALANCETE/DADOS/balancete_fi_YYYYMM.zip` | FI + FIDC + FII + FIP | Monthly | ~150MB CSV descompactado/mês | ⭐⭐ **BP+DRE mensal estruturado** (long format COSIF: CD_CONTA_BALCTE, VL_SALDO). Mensal, todos os fundos. |
| `/dados/FI/DOC/PERFIL_MENSAL/DADOS/perfil_mensal_fi_YYYYMM.csv` | FI + FIDC + FII + FIP | Monthly | ~14MB/mês | ⭐⭐ **Cotistas detalhados por categoria mensal** (NR_COTST_PF_PB, _PF_VAREJO, _EFPC, _EAPC, _RPPS, etc.) + PR_PL_* + cenários estresse FPR + voto em assembleia |
| `/dados/FII/DOC/INF_TRIMESTRAL/DADOS/inf_trimestral_fii_YYYY.zip` | FII | Quarterly | ~5-20MB/ano (11 CSVs) | ⭐⭐⭐ **Anexo 14-V já em CSV** — `imovel` (vacância, locado %, área, endereço), `imovel_renda_acabado_inquilino` (top inquilinos por imóvel + % receita + setor), `resultado_contabil_financeiro` (~95 cols DRE), `aquisicao_imovel`, `geral`, etc. **Elimina Sprint 5 LLM FII inteiro.** |
| `/dados/FII/DOC/INF_ANUAL/DADOS/inf_anual_fii_YYYY.zip` | FII | Annual | similar trim | ⭐ DFs anuais FII estruturadas (similar trimestral mas ano completo) |
| `/dados/FII/DOC/DFIN/DADOS/dfin_fii_YYYY.csv` | FII | Annual | ~250KB/ano | ⭐ Metadata + Link_Download + **Parecer_Auditor** ("Sem ressalva e sem ênfase" / "Com ressalva" / etc) — sinal direto de qualidade |
| `/dados/PROCESSO/SANCIONADOR/DADOS/processo_sancionador.zip` | Pessoas físicas e jurídicas | Updated regularly | ~100KB | Sanções CVM: NUP + Objeto + Ementa + Data_Abertura + Fase_Atual + acusados (Nome + Situacao). **Limitação: sem CNPJ — fuzzy match com gestor_nome/admin_nome.** |
| `/dados/CIA_ABERTA/DOC/IPE/DADOS/ipe_cia_aberta_YYYY.zip` | CIA_ABERTA (FIIs listados em bolsa entram aqui) | Daily | ~6.5MB CSV/ano | ⭐ IPE — Informação Periódica e Eventual (Fato Relevante, Comunicado, Assembleia, etc). Cobertura **complementar** ao EVENTUAL para FIIs negociados em bolsa. |
| `/dados/ADM_FII/CAD/`, `/dados/ADM_CART/CAD/`, `/dados/COORD_OFERTA/CAD/` | Administradoras / Gestores / Coordenadores | Annual | varia | Cadastros enriquecidos (vs hub_fundos_meta atual) |

### §10.2 Endpoints buscados que NÃO EXISTEM (ou inacessíveis)

- ❌ Carteira investida FIP (CNPJ_INVESTIDA + setor + % PL): só PDF Anexo 14-VII
- ❌ DFs FIDC/FIP estruturadas: apenas via PDF
- ❌ Eventos por CNPJ_FUNDO em endpoint REST com filtro

### §10.3 Replan de sprints — V3 FREE-ONLY (aprovado 26/04)

**Decisão Lucas (26/04):** todos os items LLM-dependentes diferidos. Foco exclusivo em fontes CSV/ZIP gratuitas. Replan §10.3 V2 → V3.

| Sprint | Janela | Escopo V3 (free-only) | Δ vs V2 |
|---|---|---|---|
| **S1** | 01-08/05 | **Eventos Relevantes** (`eventual_fi`) + **LAMINA** (OBJETIVO/POLIT_INVEST/taxas/alavanc/classe_risco) + FIDC Tabs X_4/X_5/X_7 | unchanged |
| **S2** | 09-15/05 | **Sanções CVM** (fuzzy match Nome_Acusado → gestor_nome/admin_nome) + **Distribuições/Amortizações** (B3 dividends + FIDC X_5 + Eventos chamadas FIP) + **PERFIL_MENSAL** (17 categorias cotistas + FPR estresse) | unchanged |
| **S3** | 16-22/05 | **B3 daily quotes FII** (preço/volume/P-VP absoluto) | unchanged |
| **S4** | 23-29/05 | **Anexo 14-V FII via CSV** (`inf_trimestral_fii_imovel/inquilino/resultado_contabil`) + **Atas** (de Eventos) + **FIDC Tabs III/VI/IX** (memória ok agora) + **Cancelamentos** | unchanged — LLM FII removido em V2 |
| **S5** | 30/05-06/06 | **BALANCETE mensal** (BP+DRE estruturado COSIF, todos os fundos) + **Concessões histórico completo** (status changes timeline) | ~~LLM Anexo 14-VII FIP DEFERIDO~~ |
| **S6** | 07-13/06 | **DFs FII estruturadas** (INF_ANUAL CSV + DFIN Parecer_Auditor) + **Composição IFIX** | ~~LLM DFs FIDC/FIP notas DEFERIDAS~~ |
| **S7** | 14-27/06 | **ANBIMA cross-ref** (classificação + índices benchmark) + **Receita CNPJ situação cadastral** (gestor ativo/baixado/inapto) + **LAMINA histórica** (HIST/ retroativo 6 anos para baseline) + **Dashboards integrados** (events feed cross-class, gestor scorecard, sanções alerts) | ~~LLM prospectos FIP DEFERIDO~~, ~~LLM atas full-text DEFERIDO~~ |

**Total V3:** 7 sprints, 8 semanas calendar (01/05 → 27/06), custo externo **<$100/ano** (só B3 quotes opcional). Custo LLM **$0**.

### §10.4 Custo externo consolidado V3

| Sprint | Item | Custo |
|---|---|---|
| S3 | B3 daily quotes FII (UP2DATA opcional R$200/mês = R$2.400/ano OU brapi.dev free) | $0-500 |
| S7 | ANBIMA partnership (gratuito para info pública) | $0 |
| S7 | Receita CNPJ (rate limit gratuito 100 req/dia) | $0 |
| **Total V3** | | **$0-500/ano** |

vs V1 ($1.500) → **redução 67-100%** dependendo de B3 source.

### §10.5 Novos entregáveis V2 (5 features adicionais)

1. **LAMINA estruturada mensal** (S1) — `hub_fundos_lamina` com OBJETIVO, POLIT_INVEST, taxas, alavancagem, classe risco
2. **PERFIL mensal cotistas** (S2) — `hub_fundos_perfil_mensal` com 17 categorias × 2 (NR + PR_PL) + cenários estresse FPR
3. **BALANCETE BP+DRE mensal** (S5) — `hub_fundos_balancete` long format COSIF
4. **DFs FII estruturadas** (S6) — `hub_fii_dfs_anuais` com Parecer_Auditor + DRE/BP via INF_ANUAL CSV
5. **Anexo 14-V CSV ETL** (S4) — substitui LLM extraction por parser direto: `hub_fii_imoveis`, `hub_fii_inquilinos`, `hub_fii_resultado_contabil`

Total tabelas novas V2: 10 (V1) + 5 = **15 tabelas**.

### §10.6 Riscos NOVOS detectados

| Risk | Mit |
|---|---|
| BALANCETE 150MB/mês descompactado pode estourar Edge Function memory | Filter early no parser (só linhas FIDC/FII/FIP — descartar FI common); pular plano de contas detalhado, agregar em ~20 categorias COSIF importantes |
| LAMINA tem texto livre em OBJETIVO/POLIT_INVEST (~5kb cada × 30k fundos = 150MB) | Truncar para 2kb por campo no upsert; LLM extraction opcional para extrair atributos estruturados (target_return, max_alavancagem, etc.) |
| PERFIL mensal 14MB/mês × 12 meses = 168MB/ano em PostgreSQL | Aceitável — partition by year se passar de 1GB |
| Sanções fuzzy match Nome_Acusado → gestor_nome com falsos positivos | Restringir match exato + deixar match parcial em badge "amber" para revisão manual |

### §10.7 Próximas ações imediatas (revisado pós-investigação)

1. ✅ **Investigação CVM endpoints concluída** (este §10)
2. **Lucas review** §10.3 (replan sprints) e §10.4 (custo LLM)
3. **Decisão BALANCETE depth**: parser todas as 200+ contas COSIF ou agregar em 20 categorias importantes (DRE simplificado)?
4. **Decisão LAMINA texto livre**: armazenar full + LLM extract atributos OU já extrair estruturado em parser?
5. **Provisionar Anthropic API key** (sem mudança — ainda preciso para FIP 14-VII + DFs notas)

Status §10: V3 — 26/04/2026 (decisão Lucas: free-only).

---

## §11 Items DIFERIDOS — LLM-dependent (post-Q3 2026 ou nunca)

Aprovação Lucas (26/04): defer todas as features que dependem de LLM PDF extraction. Foco em fontes CSV/ZIP estruturadas. Items abaixo ficam em backlog **sem prazo até justificativa de ROI explícita**.

| Feature | Por que LLM | Custo estimado | Quando reconsiderar |
|---|---|---|---|
| **FIP carteira investida** (Anexo 14-VII PDF) | CVM não publica CNPJ_INVESTIDA + setor + % PL em CSV — só PDF Anexo 14-VII | ~$180 backfill 3 quadr × 150 FIPs | Se beta AAI HNW reportar que "saber em qual empresa o FIP investe" é gap crítico para fechar deal. Senão, defer indefinido. |
| **DFs FIDC/FIP notas explicativas auditor** | Demonstrações têm parecer estruturado mas notas qualitativas (eventos subsequentes, partes relacionadas, política contábil) só em PDF | ~$80/ano top 200 fundos | Se XBRL CVM ficar disponível para FIDC/FIP, vira free. Caso contrário, defer Q4 ou indefinido. |
| **Prospectos FIP fundos fechados** | LAMINA cobre fundos abertos — fundos fechados (FIP qualif/profis) não publicam lâmina. Prospecto vem em PDF | ~$60 backfill 300 fundos | Se Pro tier de AAI explicitamente pedir filtros tipo "fundos com cláusula de exit em 5 anos" via política. |
| **Atas full-text deliberation extract** | S2 captura metadados (data/tipo/título) — full text com deliberações específicas só em PDF | ~$30/ano | Nunca essencial — metadados + alertas suficientes. Diferido sine die. |
| **Eventos Relevantes severidade detection avançada via LLM** | S1 fará detection via regex/keywords (default, suspensão, mudança_gestor). LLM pode classificar contextualmente melhor | ~$100/ano | Se beta AAI reportar que muitos falsos positivos/negativos no detector regex. |

**Total LLM diferido**: ~$450/ano economia direta. Mais importante: complexidade pipeline (PDF download, lib pdf-parse Deno-compat, Anthropic API integration, retry/audit, validation) eliminada → 5+ dias de engenharia salvos.

### §11.1 Re-ativação trigger

Se algum item for reconsiderado pós-Q3, processo:

1. **Justificativa de ROI**: feedback explícito de ≥3 beta AAIs ou cliente Pro pagante
2. **Validação técnica**: 1d POC para confirmar que LLM extraction tem precisão ≥90% em sample 5 fundos
3. **Custo benchmark**: confirmar que custo extrapolado fica <$500/ano (a maioria já está)
4. **Sprint dedicado**: 1 sprint inteiro (5d) por feature, não fragmentado em backlog

### §11.2 Substitutos free-only entregues no V3

Para cada item LLM diferido, há substituto free-only no plano V3:

| Item LLM diferido | Substituto V3 (free) | Cobertura |
|---|---|---|
| Prospectos LLM | LAMINA mensal (S1) | OBJETIVO + POLIT_INVEST + RESTR_INVEST + taxas + alavancagem | 100% fundos abertos |
| Anexo 14-V FII LLM | INF_TRIMESTRAL FII CSV (S4) | Vacância + inquilinos + DRE + imóveis | 100% FIIs trimestrais |
| DFs FII notas LLM | DFIN + INF_ANUAL FII (S6) | Parecer_Auditor + DRE/BP estruturado | 100% FIIs anuais |
| Atas full-text LLM | EVENTUAL TP_DOC=AGO/AED + LINK_ARQ (S4) | Metadata: data, tipo, edital, link PDF (cliente baixa se quiser) | 100% atas |
| Severidade Eventos LLM | Regex keywords (S1) — default, suspensão, dissolução, liquidação, mudança_gestor, evento_avaliação | ~80% precisão estimada |

**Diferido SEM substituto** (gap aceito):
- Carteira investida FIP (CNPJ_INVESTIDA por empresa) — single feature realmente única ao Anexo 14-VII PDF. Aceitar gap até demanda explícita.

---

## §12 Cronograma V3 launch-aligned

```
Pré-launch (27-30/04): smoke test + push backlog (FIP V2 fae05b5)
                       ZERO features novas
                ↓
Launch 30/04 ──────────────────────────
                ↓
Maio 1-8 (S1):   Eventos + LAMINA + FIDC tabs                     [4 entregáveis]
Maio 9-15 (S2):  Sanções + Distribuições + PERFIL_MENSAL          [3 entregáveis]
Maio 16-22 (S3): B3 daily quotes FII                              [1 entregável]
Maio 23-29 (S4): Anexo 14-V FII + Atas + FIDC III/VI/IX + Cancel  [4 entregáveis]
                ↓
Junho 1-6 (S5):  BALANCETE mensal + Concessões histórico          [2 entregáveis]
Junho 7-13 (S6): DFs FII estruturadas + Composição IFIX           [2 entregáveis]
Junho 14-27 (S7): ANBIMA + Receita CNPJ + LAMINA HIST + Dashboards [4 entregáveis]
                ↓
[FIM Q2 — 20 entregáveis novos delivered, $0-500 custo externo]
                ↓
Q3+: review beta feedback → re-priorizar items §11 diferidos sob demanda real
```

---

## §13 Próximos passos imediatos

1. **Lucas review este SPEC V3** — go/no-go por sprint
2. **Investigação BALANCETE memory** (1h pré-S5): 150MB descompactado pode estourar Edge Function. Decisão sobre filtro early ou Python via GitHub Actions.
3. **Decisão B3 source** (pré-S3): UP2DATA pago vs brapi.dev free vs scraping
4. **Decisão LAMINA texto livre** (pré-S1): armazenar OBJETIVO/POLIT_INVEST como TEXT full ou truncar 2kb? Sem LLM extract, prefer full TEXT.
5. **Iniciar S1** — Lucas decide se quer começar imediato (mesmo pré-launch como Sprint 0 spillover dos quick wins) ou aguardar 01/05.

Status §11-§13: V3 — 26/04/2026.
