-- PENDING migration — FII Trimestral Anexo 14-V (LLM extraction)
-- Status: NÃO APLICADA. Aplicar via mcp__apply_migration ou supabase db push pós-launch.
-- Spec: SPEC_FII_LLM_EXTRACTION.md
-- Owner: Lucas (semana 1 maio 2026, F0 do roadmap)
--
-- Para aplicar:
--   1. Renomear remove o prefixo PENDING_ → ex: 20260501_fii_trimestral_anexo14v.sql
--   2. mcp__apply_migration name=fii_trimestral_anexo14v
--   3. Validar: \d hub_fii_trimestral, \d hub_fii_inquilinos, \d hub_fii_extraction_log
--   4. Smoke: INSERT 1 row dummy + SELECT (testar RLS)

-- ===== Tabela 1: hub_fii_trimestral =====
CREATE TABLE IF NOT EXISTS public.hub_fii_trimestral (
  cnpj_fundo text NOT NULL,
  dt_referencia date NOT NULL,           -- last day of quarter
  trimestre text NOT NULL,               -- '1T26', '2T26', '3T26', '4T26'

  -- Vacância
  vacancia_fisica_pct numeric(5,2),
  vacancia_financeira_pct numeric(5,2),
  abl_total_m2 numeric(12,2),
  abl_locada_m2 numeric(12,2),
  abl_vaga_m2 numeric(12,2),

  -- Receitas trimestrais (R$)
  receita_locacao_trim numeric(15,2),
  receita_financeira_trim numeric(15,2),
  receita_outras_trim numeric(15,2),
  receita_total_trim numeric(15,2),

  -- Despesas trimestrais (R$)
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

CREATE INDEX IF NOT EXISTS idx_fii_trim_dt ON public.hub_fii_trimestral (dt_referencia DESC);
CREATE INDEX IF NOT EXISTS idx_fii_trim_cnpj ON public.hub_fii_trimestral (cnpj_fundo);

ALTER TABLE public.hub_fii_trimestral ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fii_trim_public_read" ON public.hub_fii_trimestral FOR SELECT TO authenticated USING (true);
CREATE POLICY "fii_trim_anon_read" ON public.hub_fii_trimestral FOR SELECT TO anon USING (true);
CREATE POLICY "fii_trim_service_write" ON public.hub_fii_trimestral FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== Tabela 2: hub_fii_inquilinos =====
CREATE TABLE IF NOT EXISTS public.hub_fii_inquilinos (
  cnpj_fundo text NOT NULL,
  dt_referencia date NOT NULL,
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 5),
  nome_inquilino text,                   -- pode ser anonimizado pelo fundo
  segmento text,
  pct_receita numeric(5,2),              -- % receita total trimestre
  prazo_remanescente_meses integer,
  PRIMARY KEY (cnpj_fundo, dt_referencia, rank),
  FOREIGN KEY (cnpj_fundo, dt_referencia) REFERENCES public.hub_fii_trimestral (cnpj_fundo, dt_referencia) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fii_inq_dt ON public.hub_fii_inquilinos (dt_referencia DESC);

ALTER TABLE public.hub_fii_inquilinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fii_inq_public_read" ON public.hub_fii_inquilinos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fii_inq_anon_read" ON public.hub_fii_inquilinos FOR SELECT TO anon USING (true);
CREATE POLICY "fii_inq_service_write" ON public.hub_fii_inquilinos FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== Tabela 3: hub_fii_extraction_log (service-only) =====
CREATE TABLE IF NOT EXISTS public.hub_fii_extraction_log (
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
  fields_extracted integer,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_fii_extlog_started ON public.hub_fii_extraction_log (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_fii_extlog_cnpj_trim ON public.hub_fii_extraction_log (cnpj_fundo, trimestre);

ALTER TABLE public.hub_fii_extraction_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fii_extlog_service_only" ON public.hub_fii_extraction_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ===== Comments para documentação inline =====
COMMENT ON TABLE public.hub_fii_trimestral IS 'FII Inf Trimestral Anexo 14-V — campos extraídos via LLM (Sonnet 4.5). Vacância, receitas/despesas, ABL. Cobertura: FIIs PL > R$ 100M mandato Tijolo.';
COMMENT ON TABLE public.hub_fii_inquilinos IS 'Top 5 inquilinos por FII por trimestre. Nome pode ser null quando anonimizado pelo fundo (segmento ainda útil).';
COMMENT ON TABLE public.hub_fii_extraction_log IS 'Audit log da extração LLM — custo, tokens, retry. Service role only.';
