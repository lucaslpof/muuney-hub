# SPEC — Fundos V5: Reformulação Pré-Beta

**Criado**: 22/04/2026
**Owner**: Lucas
**Deadline**: 30/04/2026 (launch público)
**Sprint**: 8 dias (22-30/04)
**Benchmark**: https://fidcs.com.br/

---

## Brief

Reformular o módulo /fundos de muuney.hub para competir head-to-head com fidcs.com.br no recorte FIDC + Ofertas Públicas, mantendo o diferencial de multi-classe (FII/FIP/regulares seguem existindo mas não recebem esforço neste sprint).

**Posicionamento-alvo**: profissionais (gestores, analistas, institucionais, due-diligence teams). Tom mais denso, com conteúdo regulatório de apoio e export-first UX.

**Escopo deste sprint**: FIDC em profundidade + Ofertas Públicas com histórico/radar completo.
**Fora de escopo**: FII Deep Module, FIP Deep Module, regulares (lâminas/screener já existentes ficam como estão).

---

## 1. Benchmark vs Estado Atual

### 1.1 fidcs.com.br — diferenciais observados

| Feature | fidcs.com.br | muuney.hub hoje |
|---|---|---|
| Nicho FIDC puro | Core | 1 das 4 classes (profundidade OK em FIDC, mas UX genérica) |
| Paywall | Freemium R$50/mês Premium | Gate Pro R$49/mês (paridade) |
| FIC-FIDCs transparência | Core — mostra carteira investida | Ausente |
| Dashboard customizável | Core — colunas/filtros persistidos | Parcial (URL state já existe, sem preset salvo) |
| Lâminas em lote (PDF) | Premium feature | Ausente — existe export individual via @media print |
| Excel export estruturado | Premium multi-sheet | Ausente — só CSV por tabela |
| Rankings granulares | Gestoras, admins, coordenadores, custodiantes | Parcial (gestoras + admins; falta coordenadores/custodiantes) |
| Radar histórico ofertas | Completo (série longa) | OfertasRadar existe mas backlog legacy CVM 400/476 com field-alignment bug |
| Conteúdo regulatório | Resoluções CVM 175/160 inline | Ausente (links externos apenas) |

### 1.2 Estado atual muuney.hub (relevante para o sprint)

**FIDC**:
- FidcHub (/fundos/fidc) — 4 sections, rankings sortable, screener, segmentos
- FidcLamina (/fundos/fidc/:slug) — 6 sections (Resumo, Estrutura Capital, Carteira, Performance, Info, Similares)
- hub-fidc-api v3 (6 endpoints: detail, monthly, rankings, overview, search, segments)
- v_hub_fidc_clean VIEW (filtra outliers |rentab|>95%)
- hub_fidc_mensal: ~21K rows, Out25→Mar26, 5 meses

**Ofertas**:
- OfertasRadar (/ofertas) — 4 sections (Visão Geral, Timeline, Pipeline, Explorer)
- hub-ofertas-api v1 (5 endpoints)
- hub_ofertas_publicas: 31K+ ofertas CVM 160/400/476
- Legacy 400/476 congelado (Python pipeline antigo); CVM 160 refresh semanal via pg_cron #20

**Infra reutilizável**:
- @media print CSS (A4, Tech-Noir flip)
- ExportPdfButton + PrintFooter
- csvExport helper pt-BR (separator `;` + BOM UTF-8)
- SheetJS já listado como lib disponível em artifacts (mas não em runtime — precisa npm install)

---

## 2. Features Priorizadas (3 pilares)

### 2.1 Excel Export Estruturado — PROPOSTA

**Onde**: FidcLamina + FidcHub + OfertasRadar

**Implementação**: client-side com SheetJS (`xlsx` package npm install) — **dynamic import on-click** (lazy-load), evita peso no bundle inicial, user baixa em <2s.

**Formatação pt-BR (decisão #6 travada)**:
- Vírgula decimal (via `numFmt: '#.##0,00'`)
- Formato de célula BRL para colunas financeiras: `numFmt: '"R$" #.##0,00'`
- Datas em `dd/mm/yyyy`
- Sheet names em português

**Estrutura XLSX por FIDC (FidcLamina export)**:
- **Sheet 1 — Cadastrais**: CNPJ, denominação, classe, subclasse, gestor, administrador, custodiante, auditor, tipo_condom, público_alvo, tributação, aplicação_min, prazo_resgate, taxa_adm, taxa_perfm, slug, situação
- **Sheet 2 — Carteira Histórica**: dt_comptc × métricas (PL, PL mezanino, PL subordinada, rentab senior/mezanino/subord/fundo, subordinação %, inadimplência %, nr_cotistas senior/subord, vl_carteira, vl_carteira_prejuízo) — todos meses disponíveis
- **Sheet 3 — Indicadores de Risco**: PDD/cobertura, inadimplência 15-90d, inadimplência >90d, prazo médio carteira, concentração top-10 devedores (se disponível via CDA), índice cedentes
- **Sheet 4 — Composição Carteira (CDA)**: bloco × ativo × valor_merc_pos_final (último mês) — tabela longa com todos os blocos
- **Sheet 5 — Peer Benchmark**: top 20 FIDCs do mesmo lastro (rentab, PL, subord, inadim, gestor, admin)

**Estrutura XLSX para FidcHub (rankings batch export)**:
- **Sheet 1 — Rankings completo**: todos os ~4K FIDCs com filtros aplicados (não paginado), colunas sortable exportadas
- **Sheet 2 — Agregados por lastro**: tabela by_lastro (count, PL total, DY médio, rentab média, inadim média, subord média)
- **Sheet 3 — Agregados por gestora**: top 50 gestoras (count fundos, PL agregado, rentab ponderada)

**Estrutura XLSX para Ofertas**:
- **Sheet 1 — Ofertas (filtros aplicados)**: todas as colunas de hub_ofertas_publicas
- **Sheet 2 — Breakdown por tipo_ativo**
- **Sheet 3 — Timeline mensal**

**CTA UI**: botão "Excel" ao lado do "PDF" no header de cada página, variante outlined green com ícone FileSpreadsheet (lucide).

**Esforço**: 1.5 dia (setup SheetJS + 3 páginas + testes).

---

### 2.2 Lâminas em Lote (PDF Batch) — PROPOSTA

**Use case**: analista seleciona N FIDCs via rankings/screener e gera um arquivo .pdf com todas as lâminas concatenadas (1 lâmina por FIDC, cada uma começando em página nova).

**Opções avaliadas**:

| Abordagem | Prós | Contras | Decisão |
|---|---|---|---|
| Client-side iframe + window.print() sequencial | Zero backend | Browser gera N PDFs separados (não concatena), UX ruim | ❌ |
| html2pdf.js / jsPDF + html2canvas | Bundle OK, concatena client-side | Charts SVG quebram, 500KB+ bundle | ❌ |
| Edge Function + Puppeteer headless | PDF perfeito, concatena server-side | Deno não tem Puppeteer estável, Supabase Edge Runtime não suporta Chromium | ❌ |
| **Edge Function + pdf-lib + fetch HTML → renderizar server-side** | Funciona no Deno, tamanho OK | Complexidade alta, charts precisam ser re-renderizados server-side | ⚠️ |
| **Client-side: iframe hidden + @media print + CSS page-break-after: always entre lâminas + single window.print()** | PDF único nativo do browser, charts SVG funcionam, zero nova dep | Precisa orquestrar state de multi-slug loading | ✅ **Escolhida** |

**Fluxo técnico**:
1. Rota nova: `/fundos/fidc/batch-print?slugs=fundo-a,fundo-b,fundo-c` (accepts até 20 slugs via query param)
2. Página renderiza `<BatchPrintLayout>` que faz N paralelos useFidcDetail + useFidcV4Monthly
3. Enquanto carrega: spinner full-screen com "Carregando N lâminas..."
4. Quando todas resolvem: render `<FidcLaminaPrintView>` para cada slug, separadas por `<div className="page-break-after" />`
5. useEffect dispara `window.print()` automaticamente quando tudo carregou + renderizou
6. Browser abre dialog "Salvar como PDF" → usuário escolhe destino

**CTA UI**: na FidcHub (Rankings section), adicionar checkboxes multi-select por linha + botão "Gerar lâminas em lote (PDF)" no footer da tabela. Abre nova aba com rota batch-print + slugs selecionados.

**Limite**: max 20 slugs por batch (evita tab freeze; tabs >20 reportam erro explícito).

**Esforço**: 2 dias (rota nova + BatchPrintLayout + FidcLaminaPrintView simplificado + multi-select UI + testes com 5/10/20 slugs).

---

### 2.3 FIC-FIDCs Transparência — DECISÃO D1: PATH B

**Validação D1 (22/04) concluída via Supabase MCP**:

| Check | Resultado |
|---|---|
| `hub_fundos_cda` tem `bloco = 'cota_fi'`? | Sim — 923 rows |
| `ds_ativo` / `emissor` populados? | NÃO — ambos NULL (parser não capturou `CNPJ_FUNDO_COTA`) |
| FIDCs aparecem como holder em CDA? | ZERO — CDA cobre só ICVM 555 (Renda Fixa/Multi/Ações/ETF/FIP) |
| `cd_ativo = cota_fi_XXXX` resolvível para CNPJ? | Não — código CVM interno sem bridge ingerido |
| `hub_fidc_mensal` tem breakdown de cotas de FIDC? | Não — só `tp_lastro_principal`, `concentracao_cedente`, `nr_cedentes` |

**Conclusão**: Path A inviável em 8 dias (exigiria 2 backfills: parser CDA + Tab_IX FIDC Informe Trimestral).

**Path B implementação** (esforço: 0.5 dia):
1. Badge "FIC-FIDC" em FidcLamina quando `denom_social` ILIKE '%FIC%FIDC%' OU `subclasse_rcvm175` indicar
2. Card placeholder section "Carteira Investida (FIDCs)" com mensagem: "Transparência de FIC-FIDC está em desenvolvimento. Requer ingestão do CVM Informe Trimestral FIDC Tab_IX (carteira detalhada) + fix do parser CDA para capturar CNPJ_FUNDO_COTA. Previsão: sprint pós-beta (maio/26)."
3. Adicionar task backlog concreto em CLAUDE.md

**Path A backlog pós-beta (documentado)**:
- Backfill 1: fix ingest-cvm-data CDA parser para capturar `CNPJ_FUNDO_COTA` (bloco cota_fi) → re-ingerir CDA histórico 2024-2026
- Backfill 2: adicionar ingestão Tab_IX FIDC Informe Trimestral (carteira detalhada por cedente/devedor)
- Cross-reference: quando FIDC-X aparece como target em cota_fi do holder Y, renderizar linkagem bidirecional
- Estimativa pós-beta: 3-4 dias

**Libera 1.5 dia no D6** → absorvido por CVM 175/160 inline (decisão #4).

**Contexto regulatório**: FIC-FIDC (Fundo de Investimento em Cotas de FIDC) é um fund-of-funds que aloca parte ou todo seu PL em outros FIDCs. A transparência disso — ver QUAIS FIDCs o FIC investe e em QUE proporção — é valiosa para due diligence porque expõe concentração indireta.

**Dado disponível**: hub_fundos_cda contém a composição por bloco. Para FIC-FIDCs, o bloco relevante é `cotas_fidc` (se existir) ou `investimento_fidc` — precisa confirmar via SQL query.

**Se dado disponível (Path A — preferido)**:
1. Detectar no FidcLamina se o fundo é FIC (query SELECT para blocos de cotas de FIDC)
2. Se for FIC: nova section "Carteira Investida (FIDCs)" entre Composição e Informações
3. Renderizar tabela: FIDC investido (nome + slug linkado para sua lâmina), valor alocado R$, % do PL, classe/lastro do FIDC investido
4. Adicionar KPI: concentração top-3 FIDCs, gestora dominante na carteira investida

**Se dado NÃO disponível (Path B — fallback)**:
1. Adicionar badge "FIC-FIDC" na lâmina quando tipo_fundo_classe indica (hub_fundos_meta.subclasse_rcvm175)
2. Placeholder card: "Transparência de FIC-FIDC em desenvolvimento — carteira investida será exibida após próximo ciclo de ingestão CDA (mai/26)"
3. Adiar implementação completa para sprint pós-beta

**Validação necessária (D-1 do sprint)**:
```sql
SELECT DISTINCT bloco FROM hub_fundos_cda WHERE bloco ILIKE '%fidc%' OR bloco ILIKE '%cota%';
SELECT COUNT(*) FROM hub_fundos_cda
WHERE cnpj_fundo IN (SELECT cnpj_fundo_classe FROM hub_fundos_meta WHERE subclasse_rcvm175 ILIKE '%FIC%' OR denom_social ILIKE '%FIC-FIDC%' OR denom_social ILIKE '%FIC FIDC%');
```

**Esforço se Path A**: 2 dias (SQL validation + hook + component + integração + cross-link).
**Esforço se Path B**: 0.5 dia (badge + placeholder).

---

## 3. Extras "Ampliar para Profissionais" (se sobrar tempo)

Posicionamento profissional exige conteúdo regulatório inline. Candidatos prioritizados:

| Feature | Esforço | Fit no sprint? |
|---|---|---|
| Glossário FIDC collapsível (subordinação, PDD, cedentes, cotas sênior/mezanino/subord) acessível via HintIcon enriched | 0.5 dia | ✅ se sobrar |
| Rankings de coordenadores (Ofertas) + custodiantes (FIDC) | 0.5 dia | ✅ se sobrar |
| Nota metodológica sobre cleaning v_hub_fidc_clean (|rentab|>95% threshold) visível em DataAsOfStamp tooltip | 0.2 dia | ✅ likely |
| Resolução CVM 175 + 160 resumo inline (1 card por seção) | 1 dia | ⚠️ stretch goal |
| Alertas personalizados (email digest FIDC monitorados) | 2 dias | ❌ defer pós-beta (requer backend novo) |

---

## 4. Sprint Plan (8 dias · 22-30/04)

**Hoje** = Quarta 22/04. Launch **30/04 (Quinta)**. Sprint útil: Qua→Qua (22-29) com 30 de buffer+polish+smoke.

| Dia | Data | Foco | Entregáveis |
|---|---|---|---|
| D1 | Qua 22/04 | Setup + validação dados | (a) spec aprovado (este doc); (b) SQL validation FIC-FIDC (Path A vs B); (c) `npm install xlsx --save`; (d) commit base setup |
| D2 | Qui 23/04 | Excel export #1 — FidcLamina | (a) helper `src/lib/xlsxExport.ts` com `exportFidcLamina(meta, monthly, cda)`; (b) botão "Excel" na FidcLamina header; (c) sheets 1-5 conforme §2.1; (d) testar com 3 FIDCs reais |
| D3 | Sex 24/04 | Excel export #2 — FidcHub + OfertasRadar | (a) `exportFidcRankings(filters)` server-paginated export (fetch all, não paginar); (b) `exportOfertas(filters)`; (c) botões "Excel" nos headers; (d) testar batch >1000 rows |
| D4 | Sab 25/04 | Lâminas em lote (PDF) — scaffolding | (a) rota `/fundos/fidc/batch-print`; (b) `<BatchPrintLayout>` orquestrador; (c) `<FidcLaminaPrintView>` versão enxuta da lâmina (sem interatividade); (d) multi-select checkboxes em FidcHub Rankings |
| D5 | Dom 26/04 | Lâminas em lote (PDF) — polish | (a) auto-trigger `window.print()` após load; (b) limite 20 slugs + mensagem; (c) page-break CSS; (d) testar 5/10/20 slugs em Chrome/Safari; (e) PrintFooter por lâmina |
| D6 | Seg 27/04 | FIC-FIDCs transparência | Se Path A: (a) endpoint novo `hub-fidc-api?action=fidc_investidos&cnpj=...`; (b) hook `useFicInvestments`; (c) section `<FicFidcTransparencyPanel>`; (d) cross-link para FIDC investido. Se Path B: badge + placeholder + defer. |
| D7 | Ter 28/04 | Extras + Posicionamento | (a) rankings coordenadores/custodiantes; (b) glossário collapsível; (c) nota metodológica v_hub_fidc_clean; (d) CLAUDE.md atualizado |
| D8 | Qua 29/04 | QA + Polish | (a) smoke E2E todas as features; (b) build clean; (c) commit tudo; (d) push origin/main; (e) deploy Vercel verificação |
| D+1 | Qui 30/04 | LAUNCH + buffer | Beta testers (Pedro + 9 novos) ativados; monitoramento 4h; hotfix se necessário |

---

## 4b. Nota de Segurança — xlsx@0.18.5

`npm audit` reporta 2 advisories em xlsx@0.18.5 (prototype pollution + ReDoS). Ambos são **parse-time** — ativam quando o app LÊ XLSX malicioso de usuário.

**Nosso uso é write-only**: `SheetJS.utils.aoa_to_sheet` + `SheetJS.writeFile` — geramos arquivos a partir de arrays tipados nossos (nada vem de input do usuário). Superfície de ataque = zero.

Decisão: pin em 0.18.5 (última versão npm Community Edition — SheetJS 0.19+ só via CDN após dispute de licenciamento). Documentado aqui para auditoria futura. Se surgir necessidade de PARSEAR XLSX (ex. upload de carteira), revisitar e trocar por exceljs ou mover para CDN oficial.

---

## 5. Risk Register

| Risco | Probabilidade | Impacto | Mitigação / Fallback |
|---|---|---|---|
| SheetJS (xlsx) bundle grande | Média | Chunk ~300KB | Lazy-load dynamic import apenas on-click do botão Excel |
| FIC-FIDC dado CDA não existe ou sparse | Alta | Kills feature 2.3 | Path B fallback (badge + placeholder, defer) |
| Batch print trava browser com 20 slugs | Baixa | UX ruim | Reduzir limite para 10, mostrar progress bar |
| Charts SVG não renderizam em batch-print | Média | PDF incompleto | Fallback: render só KPIs + tabelas no PrintView, charts apenas na lâmina individual |
| pg_cron ingestão mensal dia 8 traz dados parciais Abr/26 | Média | Backends mostram números errados | DataAsOfStamp já trata (staleness red), mas comunicar em changelog |
| Sprint slip > 1 dia | Média | Feature #3 corta | Corte já definido: FIC-FIDC → Path B se D6 não fechar |

---

## 6. Build / Deploy Checklist

- [ ] `npm install xlsx` limpo
- [ ] `npx tsc --noEmit` = 0 erros
- [ ] `npx vite build` success, chunks sem surpresa
- [ ] Lighthouse Hub /fundos/fidc > 80 perf
- [ ] Smoke E2E: Excel download OK (abrir no LibreOffice + Google Sheets)
- [ ] Smoke E2E: Batch PDF funciona em Chrome + Safari + Firefox
- [ ] Git push + Vercel auto-deploy OK
- [ ] DataAsOfStamp reflete última ingestão CVM
- [ ] CLAUDE.md atualizado com V5 concluído

---

## 7. Decisões (travadas 22/04)

1. ✅ **SheetJS client com lazy-load** — dynamic import on-click.
2. ✅ **Batch PDF limit 20 slugs**.
3. ✅ **FIC-FIDC Path A preferido** — decisão final depende de SQL validation D1.
4. ✅ **Resolução CVM 175/160 inline** — COMMIT, não stretch. Entra no D7.
5. ✅ **Rankings coordenadores/custodiantes** — só FIDC+Ofertas neste sprint.
6. ✅ **SheetJS pt-BR** — vírgula decimal + formato de célula BRL onde aplicável.

**Impacto da decisão #4**: D7 fica com ~2.2 dias de trabalho (rankings coord/custod + glossário + nota metodológica + CVM 175/160). Mitigação: se FIC-FIDC cair em Path B no D6 (0.5d vs 2d), sobra 1.5 dia que absorve o CVM conteúdo. Se Path A rolar, então glossário pode virar HintIcon leve (compressão de 0.5d para 0.2d).

---

## 8. Próximo Passo Imediato

Assim que você aprovar este spec:

1. **D1 começa agora**: validação SQL FIC-FIDC via MCP Supabase + `npm install xlsx` + commit base.
2. Em paralelo: responde as 6 decisões pendentes (§7) para desbloquear implementação.

Se quiser ajustar escopo/prazo/prioridades, agora é o momento antes de escrever código.
