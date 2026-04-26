# SPEC — FII LLM Extraction (Anexo 14-V Inf Trimestral)

Status: scaffolding. Implementação produtiva diferida pós-launch (30/04/2026).
Sprint owner: Lucas (após beta lançado).

## 1. Problema

O Inf Mensal FII da CVM publica **apenas 3 CSVs** (complemento, ativo_passivo, geral). Esses CSVs cobrem PL, cotas, DY, valor patrimonial — mas **não trazem** os campos analíticos críticos para AAIs:

- **Vacância física** (% área locável vaga) e **vacância financeira** (% receita perdida)
- **Receita de locação** vs **receita financeira** (mix do fluxo de caixa)
- **Despesa imobiliária** (manutenção, IPTU, condomínio) vs **despesa administrativa**
- **Top 5 inquilinos** (% receita por locatário — concentração contraparte)
- **ABL** (área bruta locável total, m²)
- **Nº de imóveis** geradores de renda
- **Prazo médio dos contratos** + tipos (típico/atípico)

Esses dados existem no **Anexo 14-V do Inf Trimestral FII** ("Relatório Gerencial") — PDF estruturado obrigatório por instrução CVM. O Anexo é ~10-30 páginas por fundo, ~430 FIIs com PL > R$ 10M, atualizado trimestralmente. Custo de leitura humana: ~6 horas/fundo × 430 fundos × 4 trimestres = inviável.

Solução: extração via LLM (Claude Sonnet 4.5 ou similar) com schema JSON validado.

## 2. Escopo MVP (pós-launch)

Foco inicial: **vacância + receitas/despesas + top 5 inquilinos + ABL** (4 grupos críticos para tese). Diferir prazo de contratos e tipos atípicos para v2.

Filtro: FIIs com **PL > R$ 100M** + **mandato Tijolo** (segmentos Logística, Lajes Corporativas, Shopping, Renda Urbana, Hospitalar, Educacional, Hotelaria, Híbrido). Exclui FIIs de Papel (CRI/LCI) que não têm imóveis.

Cobertura estimada: ~150-200 FIIs no MVP.

## 3. Arquitetura

### 3.1 Pipeline geral

```
1. Discovery       → CVM RAD endpoint lista PDFs Anexo 14-V por fundo+trimestre
2. Download        → Edge Function baixa PDF (~500KB-3MB cada)
3. PDF→Text        → pdf-parse ou similar (Deno-compatible)
4. LLM extract     → Claude Sonnet 4.5 com schema JSON estruturado
5. Validate        → Zod parse + sanity checks (vacância 0-100%, soma 100%, etc.)
6. Persist         → hub_fii_trimestral + hub_fii_inquilinos (top 5)
7. Audit           → hub_fii_extraction_log (custo, tokens, retry)
```

### 3.2 Tabelas a criar

```sql
-- Trimestral consolidated metrics
CREATE TABLE hub_fii_trimestral (
  cnpj_fundo text NOT NULL,
  dt_referencia date NOT NULL, -- last day of quarter (e.g., 2026-03-31)
  trimestre text NOT NULL,     -- '1T26', '4T25', etc.
  -- Vacância
  vacancia_fisica_pct numeric(5,2),
  vacancia_financeira_pct numeric(5,2),
  abl_total_m2 numeric(12,2),
  abl_locada_m2 numeric(12,2),
  abl_vaga_m2 numeric(12,2),
  -- Receitas (R$)
  receita_locacao_trim numeric(15,2),
  receita_financeira_trim numeric(15,2),
  receita_outras_trim numeric(15,2),
  receita_total_trim numeric(15,2),
  -- Despesas (R$)
  despesa_imobiliaria_trim numeric(15,2),
  despesa_administrativa_trim numeric(15,2),
  despesa_total_trim numeric(15,2),
  -- Imóveis
  nr_imoveis_renda integer,
  nr_inquilinos_total integer,
  -- Audit
  fonte_url text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  extraction_model text,
  extraction_cost_usd numeric(8,4),
  PRIMARY KEY (cnpj_fundo, dt_referencia)
);

-- Top 5 inquilinos per fund per quarter
CREATE TABLE hub_fii_inquilinos (
  cnpj_fundo text NOT NULL,
  dt_referencia date NOT NULL,
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 5),
  nome_inquilino text,            -- pode ser anonimizado pelo fundo ("Locatário A")
  segmento text,                  -- Logística, Saúde, Educação, etc.
  pct_receita numeric(5,2),       -- % da receita total do trimestre
  prazo_remanescente_meses integer,
  PRIMARY KEY (cnpj_fundo, dt_referencia, rank)
);

-- Extraction log (custo, retry, falhas)
CREATE TABLE hub_fii_extraction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj_fundo text NOT NULL,
  trimestre text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','running','success','partial','failed')),
  pdf_url text,
  pdf_bytes integer,
  pdf_pages integer,
  llm_model text,
  llm_input_tokens integer,
  llm_output_tokens integer,
  llm_cost_usd numeric(8,4),
  fields_extracted integer,    -- 0-N campos validados
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
```

RLS: public read em `hub_fii_trimestral` + `hub_fii_inquilinos` (mesmo padrão hub_fii_mensal). `hub_fii_extraction_log` é service role only.

### 3.3 Edge Function `extract-fii-anexo14v`

```
POST /functions/v1/extract-fii-anexo14v
Body: { cnpj_fundo: string, trimestre: '1T26' | '2T26' | ..., dry_run?: boolean }

Headers: Authorization: Bearer <admin JWT>

Fluxo:
1. Validate admin tier (hub_user_tiers.tier = 'admin')
2. Discover PDF URL via CVM RAD API:
   GET https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx?...
   (procurar endpoint estruturado; fallback: parse HTML)
3. Download PDF (max 10MB, timeout 60s)
4. Extract text via pdf-parse (deno_pdf or similar Deno-compat lib)
5. Build prompt for Claude Sonnet 4.5:
   - System: "Você é um extrator estruturado de relatórios FII brasileiros..."
   - User: "<Anexo 14-V completo>"
   - Tool/JSON schema com 24 campos do hub_fii_trimestral + array top 5 inquilinos
6. Call Anthropic API com tool_use forçado para JSON schema
7. Parse + Zod validate response
8. Sanity checks:
   - vacancia_fisica_pct ∈ [0, 100]
   - vacancia_financeira_pct ∈ [0, 100]
   - abl_locada + abl_vaga ≈ abl_total (tolerance 5%)
   - sum(top_5.pct_receita) ≤ 100
   - receita_total ≈ receita_locacao + receita_financeira + receita_outras (tolerance 2%)
9. Upsert hub_fii_trimestral + hub_fii_inquilinos (transactional)
10. Insert hub_fii_extraction_log (status=success/partial/failed + cost)

Custo estimado por fundo: ~$0.10-0.30 (Sonnet 4.5 ~30k input + 2k output tokens)
Custo MVP 200 fundos × 4 trimestres = ~$160-240/ano
```

### 3.4 Frontend hooks (FII V2)

```typescript
// src/hooks/useHubFundos.ts (extend)
export interface FiiTrimestralItem {
  cnpj_fundo: string;
  dt_referencia: string;
  trimestre: string;
  vacancia_fisica_pct: number | null;
  vacancia_financeira_pct: number | null;
  abl_total_m2: number | null;
  receita_locacao_trim: number | null;
  receita_financeira_trim: number | null;
  despesa_imobiliaria_trim: number | null;
  despesa_administrativa_trim: number | null;
  nr_imoveis_renda: number | null;
  // ... full schema
}

export interface FiiInquilinoItem {
  rank: number;
  nome_inquilino: string | null;
  segmento: string | null;
  pct_receita: number;
  prazo_remanescente_meses: number | null;
}

export function useFiiTrimestral(cnpj: string, quarters?: number)
export function useFiiInquilinos(cnpj: string, dtReferencia: string)
```

UI: novo painel `FiiCarteiraDepthPanel` em FiiLamina (mirror do FidcCarteiraDepthPanel V5):
- KPIs vacância (física + financeira)
- Mix receitas (donut: locação vs financeira vs outras)
- Mix despesas (donut: imobiliária vs administrativa)
- Top 5 inquilinos (tabela horizontal bars com pct_receita + segmento + prazo)
- ABL trend (chart trimestral área locada vs vaga)

## 4. Riscos & Mitigações

| Risco                             | Mitigação                                                 |
|----------------------------------|-----------------------------------------------------------|
| Anexo 14-V PDF tem layout heterogêneo entre admins | Schema flexível + few-shot examples + retry com prompt mais explícito |
| Inquilinos anonimizados ("Locatário A")  | Aceitar `nome_inquilino: null` quando confidencial; segmento ainda é útil |
| Custo LLM escala com volume      | Filtro PL > R$ 100M (~200 FIIs) + cache trimestral (1× por trimestre por fundo) |
| LLM hallucina campos inexistentes | Sanity checks + Zod validate + audit log com `fields_extracted` count |
| CVM RAD API rate limit           | pg_cron job semanal espalhado + circuit breaker em case 429 |
| Mudança no schema CVM            | Versionamento `extraction_model` + dry_run mode antes de produção |

## 5. Roadmap implementação (pós-launch)

| Fase | Owner | Esforço | Quando         |
|------|-------|---------|----------------|
| F0 — Migrations + RLS | Lucas | 1h | Semana 1 maio |
| F1 — Edge Function scaffold | Lucas | 4h | Semana 1 maio |
| F2 — PDF discovery (RAD endpoint) | Lucas | 4h | Semana 2 maio |
| F3 — Prompt engineering + 5 fundos pilot | Lucas | 6h | Semana 2 maio |
| F4 — Sanity checks + Zod validation | Lucas | 3h | Semana 2 maio |
| F5 — Frontend hook + FiiCarteiraDepthPanel | Lucas | 6h | Semana 3 maio |
| F6 — Backfill 4T25 + 1T26 (200 fundos × 2 = ~$120) | Lucas | 8h (mostly aguardando) | Semana 3 maio |
| F7 — pg_cron job trimestral (dia 25 do mês seguinte ao trimestre) | Lucas | 2h | Semana 4 maio |
| F8 — Validation manual sample (5 fundos vs PDF original) | Lucas | 4h | Semana 4 maio |

Total: ~38h de implementação ao longo de 3-4 semanas pós-launch.

## 6. Métricas de sucesso

- **Cobertura**: ≥ 90% dos FIIs PL > R$ 100M com `vacancia_fisica_pct` populado por trimestre
- **Precisão**: ≥ 95% match com leitura manual em sample de 10 fundos (vacância, receitas, top 5)
- **Custo**: < $50/trimestre (200 fundos × $0.20 médio)
- **Latência**: < 15min para extrair lote completo (paralelismo 5 chamadas concurrent)
- **UX**: AAIs reportam que `FiiCarteiraDepthPanel` é o painel mais usado em FII lâminas (medido via FeedbackWidget + analytics)

## 7. Dependências externas

- **Anthropic API key** (já tem para outros usos? confirmar) + `ANTHROPIC_API_KEY` em Supabase secrets
- **CVM RAD endpoint** estável — alternativa: scraping HTML de https://www.rad.cvm.gov.br/ENET/ se não houver API JSON
- **Lib pdf-parse Deno-compat** — opções: `https://deno.land/x/pdf_parse`, ou subprocess Python via Edge Function (mais lento), ou pré-processar via worker batch
- **Zod runtime validation** — já em uso

## 8. Edge Function scaffold (placeholder esquelético)

Arquivo: `supabase/functions/extract-fii-anexo14v/index.ts`

Esqueleto que precisa ser completado:
- ✅ Auth check (admin only)
- ✅ Input validation (cnpj_fundo, trimestre)
- ⏳ PDF discovery via RAD (TODO: investigar endpoint)
- ⏳ PDF download + parse (TODO: escolher lib)
- ⏳ Anthropic API call com tool_use schema (TODO: API key + prompt)
- ⏳ Zod validate + sanity checks (TODO: schema completo)
- ⏳ Upsert + audit log (TODO: implementar)

Ver `supabase/functions/extract-fii-anexo14v/index.ts` para o código scaffold inicial.

---

**Status documento**: V1 — 26/04/2026. Aprovação Lucas pendente para iniciar F0-F1 pós-launch.
