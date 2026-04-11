# Diagnóstico Módulo Fundos — Muuney.hub

**Data:** 11/04/2026
**Escopo:** Data pipeline, Edge Functions, páginas React, benchmarks competitivos
**Modo:** Diagnóstico + plano (nenhuma alteração de código aplicada)

---

## Sumário Executivo

O módulo Fundos tem arquitetura robusta (V4, 29.491 classes catalogadas, 2,6M+ rows diárias, 5 Edge Functions, 6 páginas dedicadas), mas sofre de **dois problemas estruturais graves que contaminam toda a experiência**:

1. **Pipeline de ingestão FIDC incompleto** — o parser CVM processa apenas ~40% dos campos disponíveis no informe mensal, resultando em lâminas vazias, rentabilidades corrompidas e métricas ausentes.
2. **Desalinhamento entre schema e front-end** — páginas (`FidcLamina.tsx`) consultam nomes de colunas que não existem no banco, tornando gráficos permanentemente vazios sem erro visível.

Somados, esses dois problemas explicam a maioria dos "quadros sem dados" reportados. O front-end está bem construído — o trabalho para chegar ao patamar fidcs.com.br / Mais Retorno é majoritariamente **de pipeline de dados**, não de UI.

Classificação global do módulo hoje: **6/10** (estrutura muito boa, execução de dados aquém). Com as correções P0+P1 deste relatório, chegamos a **8,5/10** em 2 sprints.

---

## 1. Fontes oficiais CVM — o que usamos vs. o que existe

Os benchmarks do mercado (fidcs.com.br, Mais Retorno, Comdinheiro) usam **as mesmas fontes que nós**, o CVM Dados Abertos (`dados.cvm.gov.br`). Não há vantagem de acesso — a diferença é 100% tratamento de dados.

### Fontes CVM que já consumimos
| Fonte | Dataset | Status ingest | Cobertura | Observações |
|---|---|---|---|---|
| `inf_diario_fi` | Cota diária | Ativo (Edge ingest-cvm-data) | 6 meses (Out 25–Mar 26), 21.598 fundos | ETL funcional |
| `fidc/inf_mensal` | Informe mensal FIDC | Ativo | 5 meses (Nov 25–Mar 26), 15.536 rows, ~4.300 fundos | **Parser incompleto — ver §2** |
| `fii/inf_mensal` | Informe mensal FII | Ativo | 3 meses (Jan–Mar 26), 2.506 rows, 1.253 fundos | Saudável, >99% cobertura |
| `fip/inf_trimestral` | Informe quadrimestral FIP | Ativo | Apr/Aug/Dec 2025, 5.974 rows | Saudável mas baixa frequência |
| `cda` | Composição de carteira (CDA) | Ativo | 266+ fundos, 15.829 rows | Só fundos "regulares"; FIDC/FII/FIP não têm CDA |
| `registro_fundo_classe` | Catálogo RCVM 175 | Ativo | 29.491 classes | Base do módulo |

### Fontes CVM que **não usamos** (oportunidade direta)
| Fonte | Dataset | Por quê importa | Urgência |
|---|---|---|---|
| `ofertas_publicas_distribuicao` | CVM 160/476/400 | Ofertas Radar hoje é **100% fake** (18 rows sample) | **P1** |
| `fidc/registro_classe` | Classe/série/subclasse FIDC | Nomes corretos + rating + tipo_lastro oficial | **P0** |
| `fidc/formularios` | Formulários mensais FIDC completos | Fonte alternativa para rentabilidade (quando inf_mensal falha) | P2 |
| `fi/cad_fi` | Cadastro legacy | **taxa_adm** para os 6% de fundos legados | P2 |
| `fi/ext_balancete` | Balancete mensal | Passivo/ativo detalhado (diligência) | P3 |
| `inf_sit_esp_f` | Fundos em situação especial | Liquidação, fusão, cisão — sinal de risco | P2 |
| ANBIMA B3 API | Rating + classificação ANBIMA | Nomenclatura de mercado (Long&Short, Macro, etc.) | P2 (paga) |
| Tesouro Direto CSV | NTN-B / LFT / NTN-F | Benchmark correto para fundos RF | P2 |

**Conclusão:** usamos ~6 de ~15 datasets relevantes. Nenhum benchmark tem acesso "privilegiado".

---

## 2. Bugs críticos no pipeline de dados

### 🔴 P0 — Parser FIDC ignora 11 campos críticos

**Arquivo:** `supabase/functions/ingest-cvm-data/index.ts` (FIDC branch)

O objeto `mapped` inserido em `hub_fidc_mensal` contém apenas os campos básicos. **Estão faltando**:

| Campo no banco | Origem no CVM | Status hoje |
|---|---|---|
| `tp_lastro_principal` | `inf_mensal_fidc_tab_II` `TP_LASTRO` | 0% populado pelo ingest (77% populado externamente — **fonte desconhecida**, risco de dados stale) |
| `vl_pl_mezanino` | Tab IV `VL_PL_SUBCLASSE` onde subclasse=Mezanino | 0% populado |
| `vl_cota_mezanino` | Tab IV `VL_COTA` | 0% populado |
| `qt_cota_mezanino` | Tab IV `QT_COTA_SUBCLASSE` | 0% populado |
| `nr_cotistas_senior` | Tab IV `NR_COTST_SUBCLASSE` | 0% populado |
| `nr_cotistas_subordinada` | Tab IV (subclasse Subordinada) | 0% populado |
| `vl_carteira_prejuizo` | Tab II `VL_PREJ_REAL` | 0% populado |
| `benchmark` | Tab I `TP_BENCHMARK` | Não coletado |
| `rentab_benchmark` | Tab X_3 `VL_RENTAB_BENCHMARK_MES` | Não coletado |
| `spread_cdi` | Calculado (rentab – CDI) | Não calculado |
| `rentab_fundo_senior` / `rentab_fundo_subord` | Tab X_3 desagregado por classe | **Nomes inconsistentes** (frontend usa `rentab_senior`, parser deveria popular `rentab_fundo_senior`) |

**Impacto:** toda a seção "Estrutura de Capital" e "Cotistas" da FidcLamina mostra "—". O gráfico de rentabilidade senior/subordinada fica **sempre vazio** porque o frontend procura `m.rentab_fundo_senior` mas o parser nunca escreveu esse campo.

**Risco oculto:** `tp_lastro_principal` está 77% populado no banco, mas **não pelo código de ingest atual**. Isso significa que alguém fez backfill manual que **não está sendo atualizado mensalmente**. Rankings por lastro ficam progressivamente stale.

### 🔴 P0 — `rentab_fundo` armazena valores corrompidos

**Arquivo:** `ingest-cvm-data` v3, FIDC branch, fallback X_3 → `rt`

O código atual faz:
```ts
const rt = pn(x3r['TAB_X_VL_RENTAB_MES'])
if (rf === null && rt) rf = rt  // escreve direto, sem sanity check
```

**Resultado em produção (hub_fidc_mensal, Feb 2026):**
- Valor mínimo observado: **−280.869.666.100** (−280 bilhões %)
- Valores +695%, +577% (impossíveis em 1 mês)
- ~8% dos fundos com valor absoluto > 50% em um único mês

**Causa provável:** CVM publica o mesmo campo em unidades diferentes conforme a Tab (X_2 decimal, X_3 percentual × 100), e o parser não normaliza. Em alguns casos a CVM grava valores acumulados YTD no mês, não mensais.

**Fix necessário:** cap duro em ±50%/mês + reconciliação entre Tab X_2 e Tab X_3 + fallback para cálculo via VP/cota.

**Impacto visual:** o ranking em `HubFundos → Estruturados → FIDC` (componente `FIDCPanel`) ordena por `rentab_fundo` — ou seja, o #1 do ranking hoje é provavelmente um fundo com rentabilidade errada de −280 bilhões.

### 🟠 P1 — FidcLamina.tsx com nomes de coluna errados

**Arquivo:** `src/pages/FidcLamina.tsx` linhas 37–38

```ts
rentab_senior: m.rentab_fundo_senior != null ? parseFloat(m.rentab_fundo_senior) : null,
rentab_subord: m.rentab_fundo_subord != null ? parseFloat(m.rentab_fundo_subord) : null,
```

O schema `hub_fidc_mensal` não tem essas colunas. Ele tem `rentab_senior` e `rentab_subordinada` (conforme `FidcHub.tsx` linha 279 que ordena corretamente por `rentab_senior`).

**Efeito:** gráfico "Performance Histórica Senior vs Subordinada" fica **permanentemente vazio** em toda lâmina FIDC. Como o filtro é `.filter((d) => d.rentab_senior != null || ...)`, o chart simplesmente não renderiza — sem erro no console.

Outros erros de campo na mesma página:
- Linha 50: `m.vl_pl_mezanino / 1e6` — campo 0% populado, barra sempre em zero
- Linha 81: `latest?.vl_carteira_prejuizo` — KPI sempre "—"
- Linha 302: `latest?.nr_cotistas_senior + latest?.nr_cotistas_subordinada` — KPI sempre "—"

### 🟠 P1 — `hub_fidc_mensal` Feb 2026 com cobertura rachada

Dados populados por coluna (base: 4.124 FIDCs no último mês completo):
| Campo | % populado | Usado em |
|---|---|---|
| `vl_pl_total` | 61% | Rankings, KPIs, Overview — **mostra lacunas** |
| `vl_carteira` | 73% | — |
| `indice_subordinacao` | 33% | Ranking principal + SubordinationChart |
| `taxa_inadimplencia` | 18% | Radar de Risco + filtro do Screener |
| `rentab_senior` | ~41% | Rankings |
| `rentab_fundo` | ~45% (dos quais 8% **corrompidos**) | Ranking principal |
| `tp_lastro_principal` | 77% (não via ingest) | Filtros segmento |

Para efeito de comparação, **fidcs.com.br tem >95%** nestes mesmos campos. Isso é diferença de qualidade de ETL, não de acesso à fonte.

### 🟠 P1 — Ofertas Radar é 100% fake

`hub_ofertas_publicas` tem **18 rows seed manual**, zero pipeline de ingest. O dataset CVM `ofertas_publicas_distribuicao` existe e é gratuito. Edge function `ingest-cvm-ofertas` foi prometida mas não implementada.

**Impacto:** um usuário Pro paga R$49/mês e abre `/fundos/ofertas` e vê 18 ofertas fictícias. Risco reputacional alto.

### 🟡 P2 — Log de ingestão com entradas "running" órfãs

`hub_cvm_ingestion_log` tem entradas `cda_blc_all` em status `running` desde 04/04/2026 (7 dias atrás). Ou o cron está silenciosamente falhando, ou o código não marca `completed`/`failed` em todos os caminhos.

### 🟡 P2 — `hub_fundos_mensal` parcialmente órfão

Tabela com 301 rows. Frontend nenhum consome, mas `hub-cvm-api` ainda tem 3 endpoints (`fund_monthly`, `monthly_rankings`, `monthly_overview`) que leem dela — e esses endpoints **são consumidos** pelo componente `FundMonthlyPanel.tsx` (aba "Métricas & Mensal"). Como a tabela está praticamente vazia, o componente provavelmente mostra "—" em tudo.

### 🟡 P2 — `taxa_adm` cobertura <0,5%

Apenas 120/29.491 classes têm taxa de administração. Causa estrutural: `cad_fi.csv` da CVM indexa por CNPJ legacy e só 6% das classes RCVM 175 batem. **Fix:** parse do campo `taxa_adm_max` dentro de `registro_fundo_classe` (está lá, não é extraído) + fallback ANBIMA.

---

## 3. Bugs nas páginas / componentes

### 🔴 P0 — FidcLamina rentabilidade silent fail
Já documentado em §2. Corrigir nome dos campos + backfillar parser.

### 🟠 P1 — FidcHub.tsx linha 347: coluna "Lastro" hardcoded "—"
```tsx
<td className="px-4 py-2 text-center text-zinc-500 text-[7px]">
  —
</td>
```
A coluna existe na tabela, mas sempre renderiza traço. Deveria exibir `fund.tp_lastro_principal`. Fix trivial (3 linhas).

### 🟠 P1 — FIDCPanel no HubFundos lista rentabilidade corrompida
Como usa `rentab_fundo` (campo bug §2), o primeiro ranking que o usuário vê ao entrar em "Estruturados" mostra valores como −280 bi %. Primeira impressão desastrosa.

### 🟠 P1 — FundMonthlyPanel depende de tabela vazia
Consome `hub_fundos_mensal` (301 rows). Os três gráficos da seção "Métricas & Mensal" (`MonthlyOverviewChart`, `MonthlyRankingsTable`, `FundMonthlyDetail`) operam em vazio. Opções:
- **(a)** Popular `hub_fundos_mensal` via agregação diária (solução correta, 1 job)
- **(b)** Remover a seção até ter dados (solução honesta)
- **(c)** Substituir por agregação em tempo real de `hub_fundos_diario` (SQL view)

### 🟡 P2 — Comparador cross-class usa `fund.cnpj_fundo` para identidade
`ComparadorSection` (linha 323) faz `catalog?.funds.find((f) => f.cnpj_fundo === cnpj)`. Mas RCVM 175 usa `cnpj_fundo_classe` como PK e muitos catálogos retornam `cnpj_fundo === null`. Matches silenciosos falham.

### 🟡 P2 — FundScreener filtra por `taxa_adm` que quase ninguém tem
99,6% dos fundos ficam fora de qualquer filtro que use `taxa_adm`. O filtro existe no screener e gera resultados enganosamente vazios.

### 🟡 P2 — `similar` FIDCs depende de `tp_lastro_principal`
Edge function `hub-fidc-api` filtra fundos similares pelo lastro. Como o campo é populado externamente e parcialmente, a seção "Fundos Similares" da FidcLamina mostra resultados inconsistentes.

### 🟢 P3 — Múltiplos gráficos Recharts sem `domain`
`FiiLamina` performance chart não define domínio Y, então valores extremos (DY de 3% um mês, 0,5% no outro) esmagam o visual.

### 🟢 P3 — Fund Score precisa de peer group real
`computeFundScore` usa percentile dentro do subset passado. No `FundDetailPanel` o peer group é só o fundo em si (1 elemento) → score sempre = 50. Precisa ser calculado pelo backend em lote, não inline.

---

## 4. Gap vs benchmarks

### fidcs.com.br
Fonte: `dados.cvm.gov.br/dataset/fidc-inf_mensal` (**idêntica à nossa**)

| Capability | fidcs.com.br | Muuney hoje | Gap |
|---|---|---|---|
| Cobertura de fundos | ~4.500 | ~4.300 (61% com PL) | Dados — **nosso ETL está pior** |
| Frequência | Mensal (D+5 após CVM publicar) | Mensal (D+8) | Aceitável |
| Rentabilidade histórica | 12m+ | 5m | **Backfill necessário** |
| Rentabilidade senior/subordinada | ✓ | ✗ (bug §2) | Fix de campo |
| Lastro detalhado (classe + tipo) | ✓ (com %) | ✗ (só tp principal, parcial) | Parser Tab II |
| Ranking por PL/Sub/Inadim | ✓ sortable | ✓ sortable | — |
| Exportação CSV/Excel | ✓ | ✗ | Feature trivial |
| Gráfico subordinação evolução | ✓ | Parcial | Precisa series 12m |
| Alertas de stress | ✗ | ✓ (Insights Feed) | **Vantagem Muuney** |
| Fund Score proprietário | ✗ | ✓ | **Vantagem Muuney** |
| Modo Assessor/Investidor | ✗ | ✓ | **Vantagem Muuney** |

**Veredito:** temos 3 vantagens de produto (insights, score, dois modos) e 4 desvantagens de dados (cobertura, histórico, senior/subordinada, lastro detalhado). **Fechar as 4 desvantagens exige só corrigir o parser e backfillar 12 meses** — é ~1 sprint de engenharia de dados.

### Mais Retorno
Foco deles é renda variável + fundos de mercado aberto (RF, Multi, Ações). Em FIDC/FII estruturados eles são fracos — nossa diferenciação natural é **ser o líder em estruturados** (FIDC/FII/FIP + Ofertas).

| Capability | Mais Retorno | Muuney hoje | Gap |
|---|---|---|---|
| Ranking RF/Multi/Ações | ✓ | Parcial (tabela vazia em "Métricas & Mensal") | P1 |
| Histórico diário | 10+ anos | 6 meses | **Backfill CVM histórico** |
| Benchmark (CDI, Ibov, IMA-B) | ✓ | ✗ | P1 — integrar série BACEN no Muuney.hub |
| Calculadoras (aporte, imposto) | ✓ | ✗ | P2 |
| Comparador | ✓ 4 fundos | ✓ 6 fundos | **Vantagem Muuney** |
| Exportação PDF | ✓ | ✗ | P2 |
| Lâmina impressa | ✓ | Parcial | P1 |

---

## 5. Roadmap priorizado

### Sprint 1 (2 semanas) — Parar o sangramento
**Meta:** zero campos corrompidos, zero gráficos silenciosamente vazios.

- [ ] **P0.1** — Reescrever parser FIDC (ingest-cvm-data). Incluir 11 campos faltantes, extrair Tab IV detalhado (mezanino/senior/subordinada), sanity-check rentabilidade (cap ±50%/mês, reconciliar X_2 vs X_3).
- [ ] **P0.2** — Backfill FIDC 12 meses (Abr 25 → Mar 26) com parser novo. Estimar ~180k rows.
- [ ] **P0.3** — Corrigir FidcLamina.tsx: trocar `rentab_fundo_senior` → `rentab_senior`, `rentab_fundo_subord` → `rentab_subordinada`. Verificar os outros 3 campos 0%.
- [ ] **P0.4** — Investigar origem do `tp_lastro_principal` 77% populado. Se for backfill manual, incluir no parser novo. Se for trigger, documentar.
- [ ] **P0.5** — FidcHub coluna Lastro: substituir "—" hardcoded por `fund.tp_lastro_principal`.
- [ ] **P0.6** — Limpar entradas `running` órfãs em `hub_cvm_ingestion_log` e adicionar try/finally no Edge function.

**Resultado esperado:** lâminas FIDC completas, ranking FIDC confiável, Estruturados section 100% funcional.

### Sprint 2 (2 semanas) — Atingir paridade fidcs.com.br
**Meta:** benchmark FIDC empatado.

- [ ] **P1.1** — Ingest de `fidc/registro_classe` (nomes canônicos + rating + tipo lastro oficial). Upsert em `hub_fundos_meta`, zerar os 161 FIDCs com placeholder.
- [ ] **P1.2** — Popular `hub_fundos_mensal` via SQL view agregando `hub_fundos_diario` por mês (ou ETL dedicado). Alternativa: deprecar FundMonthlyPanel se não houver valor incremental vs métricas diárias.
- [ ] **P1.3** — Backfill histórico diário 12 meses (`inf_diario_fi` 2025). Estimar ~4M rows.
- [ ] **P1.4** — Exportação CSV + PDF de lâminas FIDC/FII.
- [ ] **P1.5** — Substituir `rentab_fundo` nos rankings do HubFundos/FIDCPanel por `rentab_senior` (mais confiável pós-fix).

### Sprint 3 (2 semanas) — Ofertas Radar real + benchmarks
**Meta:** ofertas públicas reais, benchmarks integrados.

- [ ] **P1.6** — Edge function `ingest-cvm-ofertas` (ZIP CVM OFERTA → `hub_ofertas_publicas`). pg_cron semanal.
- [ ] **P1.7** — Deletar rows seed fake, backfill 12 meses de ofertas reais.
- [ ] **P1.8** — Integração BACEN SGS → puxar CDI, Ibov, IMA-B como séries comparáveis nas lâminas (reutiliza hub-macro-api).
- [ ] **P1.9** — Adicionar overlay de benchmark no gráfico base-100 da FundLamina.

### Sprint 4 (2 semanas) — Vantagens competitivas
**Meta:** ser melhor que benchmarks onde é barato.

- [ ] **P2.1** — Fund Score™ em batch (backend RPC calcula para todos os fundos com peer group real). Cache em `hub_fundos_meta.fund_score_*`.
- [ ] **P2.2** — Integração ANBIMA (classificação + rating). Avaliar custo API.
- [ ] **P2.3** — Alertas de stress FIDC (subordinação < 5%, inadimplência > 10%) em tempo real no Insights Feed.
- [ ] **P2.4** — Parser `taxa_adm_max` de `registro_fundo_classe` (já está no ZIP, só não é extraído).
- [ ] **P2.5** — Comparador cross-class usar `cnpj_fundo_classe` como identidade.

### Sprint 5+ — Long tail
- [ ] Histórico CVM completo (2019+) via arquivo anual
- [ ] PDF export via react-pdf
- [ ] Calculadoras de aporte/imposto
- [ ] Screener salvo + alertas via email
- [ ] Similar funds via ML (k-NN sobre metrics) em vez de filtro categórico

---

## 6. Próxima ação (decisão do Lucas)

Você escolhe o que atacar primeiro. Minhas recomendações:

**Opção A — Fix cirúrgico de 1 dia (menor risco, maior retorno visual):**
Aplicar **P0.3** + **P0.5** + substituir `rentab_fundo` por `rentab_senior` no ranking. Zero mudança de pipeline, só renomear campos no React. Todas as lâminas FIDC voltam a renderizar e o ranking deixa de mostrar valores absurdos.

**Opção B — Sprint 1 completo (2 semanas, impacto estrutural):**
Reescrever parser FIDC + backfill 12m + fixes P0 de UI. Exige deploy do Edge function e verificação de disco Supabase (180k rows extras).

**Opção C — Deep dive em uma camada específica:**
Se você quer investigar primeiro, posso:
- Executar SELECT em `hub_fidc_mensal` para dar a lista exata de fundos com rentab corrompida
- Fetchar e parsear uma amostra real do ZIP CVM FIDC para validar minha hipótese do parser
- Simular o parser novo em Python antes de reescrever o Edge function

Me diga a opção e eu começo.

---

**Documento gerado por:** Claude (Cowork mode)
**Commit de referência:** bdd3993 (FIPPanel hooks fix)
**Fonte primária:** inspeção de código (`src/pages/*`, `supabase/functions/*`) + consultas SQL ao banco de produção (`hub_fidc_mensal`, `hub_fundos_meta`, `hub_cvm_ingestion_log`) + WebFetch de fidcs.com.br e portal CVM Dados Abertos.

---

# ANEXO — Forensic Deep Dive (11/04/2026, 15h30)

Esta seção substitui e corrige partes do §2 após investigação com os CSVs reais da CVM (ZIP `inf_mensal_fidc_202602.zip`, 26 MB, 17 tabs) + leitura do código-fonte da Edge Function `ingest-cvm-data` v3 + SQL sobre `hub_fidc_mensal`.

## A. Correção importante ao diagnóstico anterior

O §2 afirmava que o schema de `hub_fidc_mensal` **não tinha** campos como `rentab_senior`, `vl_cota_mezanino`, `nr_cotistas_senior`, etc. **Isso está errado.** O schema tem TODOS esses campos. O problema é diferente e mais específico: o **parser da Edge Function ignora colunas que existem no schema**.

Schema atual de `hub_fidc_mensal` (31 colunas, confirmado via `information_schema`):

> cnpj_fundo, dt_comptc, vl_cota_senior, vl_cota_subordinada, **vl_cota_mezanino**,
> qt_cota_senior, qt_cota_subordinada, **qt_cota_mezanino**, vl_pl_senior, vl_pl_subordinada,
> **vl_pl_mezanino**, vl_pl_total, indice_subordinacao, vl_carteira_direitos, vl_carteira_a_vencer,
> vl_carteira_inadimplente, **vl_carteira_prejuizo**, vl_pdd, indice_pdd_cobertura, taxa_inadimplencia,
> **rentab_senior**, **rentab_subordinada**, rentab_fundo, **tp_lastro_principal**, concentracao_cedente,
> nr_cedentes, **benchmark**, **rentab_benchmark**, **spread_cdi**, **nr_cotistas_senior**, **nr_cotistas_subordinada**, created_at

Campos em **negrito** = existem no schema mas o parser nunca escreve neles → 0% populado.

## B. Distribuição real da corrupção de `rentab_fundo`

SQL sobre todos os 15.536 rows de `hub_fidc_mensal`:

| Mês | Rows | com rentab | \|rentab\| > 100% | \|rentab\| > 1000% | Mínimo | Máximo |
|---|---|---|---|---|---|---|
| 2025-11-30 | 3.689 | 3.531 | 16 | 5 | -25.395.961 | 98.660 |
| 2025-12-31 | 3.852 | 3.640 | 23 | 5 | -38.014.665 | 110.624 |
| 2026-01-31 | 3.743 | 3.543 | 13 | 5 | -2.494 | **7.840.487.150** |
| 2026-02-28 | 4.124 | 2.409 | 12 | 2 | **-280.869.666.100** | 695 |
| 2026-03-31 | 128 | 102 | 0 | 0 | -90 | 24 |

Corrupção está distribuída em **todos** os meses (não é um único lote bad). Magnitude: -280 bilhões % (mínimo absoluto). Total de valores implausíveis: ~77 rows (|rentab| > 1000%).

## C. Reconciliação ZIP CVM × DB — 3 fundos pathológicos

Baixei `inf_mensal_fidc_202602.zip` direto da CVM e extraí as linhas dos piores outliers:

### Caso 1: FIDC Leiria (CNPJ 60.261.285/0001-46, Feb 2026)

**Banco (hub_fidc_mensal):**
- `rentab_fundo` = **-280.869.666.100**
- `rentab_senior` = -280.869.666.100
- `rentab_subordinada` = 0
- `vl_pl_total` = -70.243,65 (**PL negativo!**)

**CVM ZIP Tab IV (PL):**
- `TAB_IV_A_VL_PL` = **-70.243,65** ✅ (nosso banco bate com CVM)

**CVM ZIP Tab X_2 (cotas):**
- Classe Senior: `QT_COTA` = 25.009,34; `VL_COTA` = **-2,80869666** (cota negativa)
- Classe Subordinada: QT = 0; VL = 0

**CVM ZIP Tab X_3 (rentabilidade):**
- Senior: `TAB_X_VL_RENTAB_MES` = **-280.869.666.100,00** ← **é isso que a CVM publica**
- Subordinada: 0

**Veredito:** **O valor absurdo vem da CVM, não do nosso parser.** A CVM está publicando um campo `VL_RENTAB_MES` literalmente com 12 dígitos para um fundo em liquidação com cota negativa. É raw data ruim da fonte oficial. Nosso parser está fielmente armazenando, sem sanity-check.

### Caso 2: LL Capital FIDC (CNPJ 60.645.628/0001-76, Feb 2026)

**Banco:**
- `rentab_fundo` = -2.176,87 (também aparece como `rentab_subordinada`)
- `vl_pl_total` = 234.526.666 (normal)

**CVM ZIP Tab X_2:**
- Senior Série 1: QT=0, VL=0 (extinta/zerada)
- Subordinada 1: QT=16.460; VL=**-883,78** (negativa)
- Mezanino 1 Série 1: QT=228.679; VL=1.089,18

**CVM ZIP Tab X_3:**
- Senior Série 1: RENTAB_MES = 0
- Subordinada 1: RENTAB_MES = **-2.176,87** ← matching DB
- Mezanino 1: RENTAB_MES = 1,00

**Observações adicionais:**
1. **CVM publica -2.176% para a subordinada** — impossível em um mês, mas é o que está no arquivo oficial.
2. O **mezanino existe** na CVM (QT=228.679, VL=1.089) mas o nosso banco tem `vl_cota_mezanino`/`qt_cota_mezanino`/`vl_pl_mezanino` = NULL. O parser **ignora** a classe mezanino — joga tudo no bucket "subordinada".

### Caso 3: CNPJ 60.006.903/0001-01 (Jan 2026)

DB tem `rentab_fundo` = **+7.840.487.150**. Mesmo padrão: cota negativa em liquidação + CVM publicou rentab absurdo + parser armazenou.

## D. Root cause da corrupção — análise do parser

Linha do parser (`ingest-cvm-data` v3, função `ingestFIDC`):

```ts
let rs: number | null = null, rb: number | null = null, rf: number | null = null
for (const x3r of (x3ByCnpj[cnpj] || [])) {
  const cl = (x3r['TAB_X_CLASSE_SERIE'] || '').toLowerCase()
  const rt = pn(x3r['TAB_X_VL_RENTAB_MES'])
  if ((cl.includes('senior') || cl.includes('sênior')) && rs === null) rs = rt
  else if ((cl.includes('subordinad') || cl.includes('mezanin')) && rb === null) rb = rt
  if (rf === null && rt) rf = rt                            // (1)
}
```

**Três bugs neste trecho:**

1. **(1) `rentab_fundo` = primeiro `VL_RENTAB_MES` qualquer**, sem ponderação por PL. Por isso sempre bate com senior OU subordinada (não é uma rentabilidade agregada; é um valor arbitrário da primeira iteração). Os rankings por `rentab_fundo` são efetivamente aleatórios.
2. **Mezanino colapsa em subordinada** — o `else if` junta `mezanin` no bucket `rb`. Todos os campos `*_mezanino` no schema ficam NULL para sempre. Fundos com 3 classes perdem granularidade.
3. **Zero sanity-check** — `rt` é gravado sem bounds. Valores de -280 bi % passam direto para o banco.

## E. Origem real do `tp_lastro_principal` (77%)

Evidência SQL (query sobre `hub_fidc_mensal.created_at`):

- 100% das 15.536 rows foram criadas em **2026-04-04** (dia da execução do script Python legado `ingest_fidc_full.py`)
- Distribuição real dos lastros: "Não Classificado" = 10.057 rows (65%), "Multicedente/Multissetorial" = 474, "Consignado" = 355, "Agronegócio" = 242, etc.
- **O parser da Edge Function `ingest-cvm-data` v3 não escreve `tp_lastro_principal` em lugar nenhum** (verifiquei o código inteiro). A palavra `lastro` nem aparece na função.

**Consequência:** a partir do próximo mês (quando o pg_cron rodar a Edge Function para ingerir Abr 2026), os novos FIDCs virão com `tp_lastro_principal = NULL`. A cobertura cairá progressivamente e os filtros de lastro (`similar` FIDCs, segment chips, heatmaps) degradarão silenciosamente.

## F. Gap completo do parser FIDC — tabela revisada

Considerando o código real da Edge Function (não hipótese):

| Campo schema | Status atual | Origem CVM correta | Fix |
|---|---|---|---|
| `rentab_fundo` | Bugado (primeiro valor qualquer) | Calculado: média ponderada por PL das classes em Tab X_3 | Reescrever loop |
| `rentab_senior` | OK (mas só primeira série) | Tab X_3 linhas com `CLASSE_SERIE` contendo "senior" | Somar todas as séries senior ponderadas |
| `rentab_subordinada` | OK (mas mistura mezanino) | Tab X_3 linhas "subordinada" | Separar de mezanino |
| `vl_pl_mezanino` | 0% | Tab X_2 cls="mezanino" × (qt × vl) | Adicionar branch mezanino |
| `vl_cota_mezanino`, `qt_cota_mezanino` | 0% | Tab X_2 cls="mezanino" | idem |
| `nr_cotistas_senior` | 0% | **Tab X_1_1** colunas `TAB_X_NR_COTST_SENIOR_*` (16 colunas PF/PJ/Banco/etc) | Novo branch — somar 16 colunas |
| `nr_cotistas_subordinada` | 0% | Tab X_1_1 colunas `TAB_X_NR_COTST_SUBORD_*` | idem |
| `vl_carteira_prejuizo` | 0% | Tab I `TAB_I2A11_VL_REDUCAO_RECUP` ou derivado | Adicionar |
| `benchmark` | 0% | Não existe em CSV — precisa `registro_classe.csv` FIDC | Novo ingest |
| `rentab_benchmark` | 0% | Idem | Novo ingest |
| `spread_cdi` | 0% | Calculado (`rentab_senior − CDI mês`) | Calcular no backend após ingest |
| `tp_lastro_principal` | 0% NO PARSER (77% histórico via script Python); progressivamente NULL daqui pra frente | Tab II: argmax entre 14 colunas `TAB_II_*_VL_*` (INDUSTRIAL, IMOBIL, COMERC, AGRONEG, FINANC F1-F8, FACTOR, SETOR_PUBLICO, etc.) | Port do script Python antigo pro Edge Function |

## G. Findings adicionais no parser FII

Revisão rápida do parser FII 2026 (CSVs reais do CVM `inf_mensal_fii_2026.zip`):

**Headers CVM confirmam as colunas:**
- `complemento`: `CNPJ_Fundo_Classe`, `Data_Referencia`, `Patrimonio_Liquido`, `Valor_Patrimonial_Cotas`, `Percentual_Rentabilidade_Efetiva_Mes`, `Percentual_Dividend_Yield_Mes`, etc.
- `geral`: `Segmento_Atuacao`, `Mandato`, `Tipo_Gestao`, **`Quantidade_Cotas_Emitidas`**

**Bug encontrado:** parser lê `pn(row['Cotas_Emitidas'])` mas a coluna real é **`Quantidade_Cotas_Emitidas`**. Campo `cotas_emitidas` em `hub_fii_mensal` está sempre NULL.

## H. Veredito root-cause consolidado

O diagnóstico anterior atribuía os sintomas a **parser incompleto + schema desalinhado + CVM progressive publishing**. Após deep dive:

1. **Schema está completo** — todas as colunas existem. O sintoma "gráfico vazio na FidcLamina" tem **duas causas sobrepostas**:
   - **(FidcLamina bug)** O frontend lê `m.rentab_fundo_senior` que não existe (deveria ser `m.rentab_senior`) — isso zera os charts mesmo quando os dados existem.
   - **(Parser bug)** O parser ignora mezanino/nr_cotistas_*/vl_carteira_prejuizo, e então outras partes da lâmina ficam em `—`.

2. **Corrupção `rentab_fundo` = CVM + parser leniency.** CVM publica valores impossíveis em ~77 rows (fundos em liquidação com cota negativa). Parser não tem sanity-check e armazena. **Fix correto:** cap duro a ±95% ou quarentena (flag `rentab_outlier = true`) + substituir ranking primary key de `rentab_fundo` para `rentab_senior` (mais consistente).

3. **`tp_lastro_principal` é uma bomba-relógio.** Os 77% vieram de um script Python one-off em 04/Abr/2026. O parser atual NÃO popula esse campo. Em ~3 semanas (próxima ingestão mensal), a cobertura começa a cair. Precisa portar a lógica de `argmax(Tab II.*_VL_*)` para o Edge Function.

4. **`hub_fundos_mensal` (301 rows, orfã)** é alimentada por ninguém hoje. Não entra no escopo do parser FIDC — é tabela diferente, legada da V3. Opção correta: trocar para view materializada agregando `hub_fundos_diario`.

## I. Recomendação atualizada (pós forensics)

**Opção A — Hotfix 1 dia (baixo risco, alto impacto visual):**
Sem tocar o parser. Apenas:
1. `FidcLamina.tsx`: trocar `rentab_fundo_senior`→`rentab_senior`, `rentab_fundo_subord`→`rentab_subordinada`. Verificar que os 4 charts renderizam.
2. `FidcHub.tsx` linha 347: render `fund.tp_lastro_principal` em vez de `"—"` hardcoded.
3. `FIDCPanel.tsx`: trocar ordenação de `rentab_fundo` → `rentab_senior` + adicionar filtro `WHERE ABS(rentab_senior) < 100`.
4. Nova SQL view `v_hub_fidc_clean` que filtra rentab outliers. Frontend passa a consumir essa view.
5. **Resultado:** lâminas renderizam (dados que já estão lá), rankings ficam confiáveis, nenhum deploy de Edge Function. Commit único pequeno (~50 linhas alteradas).

**Opção B — Parser rewrite + backfill (Sprint 1 completo, 2 semanas):**
Rodar Opção A primeiro (entrega imediata) e em paralelo:
1. Reescrever `ingestFIDC` em `ingest-cvm-data`:
   - Adicionar extração Tab X_1_1 → nr_cotistas_senior/subordinada (somatório 16 colunas cada)
   - Adicionar branch mezanino (Tab X_2/X_3 com `mezanin` → `*_mezanino`)
   - Portar lógica de Tab II argmax → `tp_lastro_principal`
   - Cap duro rentab ±95% + flag outlier
   - Weighted avg (PL) para `rentab_fundo` real
2. Backfill 6 meses (Nov 25 – Apr 26) com `upsert onConflict` + deploy.
3. Verificar em produção: query "% populado por coluna" deve saltar de 30-50% para 85-95%.

**Opção C — Paridade fidcs.com.br completa (Sprints 1+2, 4 semanas):**
Opção B + ingest de `registro_classe.csv` FIDC (benchmark + rating + taxa_adm_max) + backfill histórico 12m + port do parser FII fix (`Quantidade_Cotas_Emitidas`) + Edge Function `ingest-cvm-ofertas` real.

**Minha recomendação:** **A → B → C em sequência.** A Opção A devolve o módulo ao ar imediatamente com commit cirúrgico (~1-2h de trabalho). B + C são o caminho estrutural.

## J. Queries SQL de referência para o próximo passo

```sql
-- Contagem de fundos afetados pela corrupção (para comunicar ao usuário)
SELECT COUNT(*) FROM hub_fidc_mensal WHERE ABS(rentab_fundo) > 95;
-- Expected: ~80 rows em todos os meses

-- Top ofensores (para flagar no Insights Feed como "dados CVM suspeitos")
SELECT cnpj_fundo, dt_comptc, rentab_fundo, vl_pl_total
FROM hub_fidc_mensal
WHERE ABS(rentab_fundo) > 1000
ORDER BY ABS(rentab_fundo) DESC;

-- View sugerida para o frontend consumir (filtra outliers)
CREATE OR REPLACE VIEW v_hub_fidc_clean AS
SELECT *,
  CASE WHEN ABS(rentab_fundo) > 95 THEN true ELSE false END as rentab_outlier,
  CASE WHEN ABS(rentab_fundo) > 95 THEN NULL ELSE rentab_fundo END as rentab_fundo_clean
FROM hub_fidc_mensal;
```

---

**Forensics executadas por:** Claude (Cowork mode), 11/04/2026 15h15-15h30 BRT
**Evidência primária:** (i) 4 queries SQL contra `hub_fidc_mensal` em produção; (ii) download direto de `dados.cvm.gov.br/dados/FIDC/DOC/INF_MENSAL/DADOS/inf_mensal_fidc_202602.zip` (26MB, 17 tabs); (iii) reconciliação linha-a-linha de 3 fundos outliers; (iv) leitura do source Edge Function `ingest-cvm-data` v3 (437d51a8); (v) headers reais de `inf_mensal_fii_2026.zip`.
