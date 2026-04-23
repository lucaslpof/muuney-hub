-- Hub Alternativos Module — V0 schema (6 tables + RLS + storage bucket)
-- Vitrine PRO-only de oportunidades alternativas para AAIs da muuney.hub
-- Postura regulatória: híbrida (vitrine + lead-gen, SEM distribuição por muuney)
-- Applied: 2026-04-22
--
-- Tabelas:
--   hub_alt_partners          — gestoras cadastradas (origem de oportunidades)
--   hub_alt_opportunities     — oportunidades em si (cards do módulo)
--   hub_alt_materials         — materiais anexos (teaser público, deck gated, DD room gated)
--   hub_alt_access_logs       — audit trail de views, downloads, acks, material requests
--   hub_alt_interests         — leads (AAI → gestora) com dados anonimizados do cliente
--   hub_alt_user_suitability  — aceite do gate de suitability por usuário (termo versionado)
--
-- Storage:
--   bucket alt-materials (private, signed URLs TTL 5min via Edge Function)
--
-- Regulatório:
--   - LGPD: cliente anonimizado (first_name + faixa_patrimonio, nunca CPF/endereço)
--   - CVM 178 / 35: muuney não distribui, apenas lista e encaminha lead
--   - Suitability: gate default em qualquer oportunidade + log de ack

-- =====================================================================
-- 1. hub_alt_partners — Gestoras parceiras (emissores das oportunidades)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  cnpj text,
  descricao text,
  website text,
  contato_nome text,
  contato_email text,
  contato_telefone text,
  tipo_gestora text CHECK (tipo_gestora IN ('cvm_registrada', 'family_office', 'boutique', 'offshore', 'outro')),
  ativa boolean NOT NULL DEFAULT true,
  observacoes_internas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hub_alt_partners IS
  'Gestoras/emissores parceiros que submetem (ou Lucas cadastra) oportunidades alternativas para o hub.';

COMMENT ON COLUMN public.hub_alt_partners.tipo_gestora IS
  'cvm_registrada: registrada na CVM (CAT 178). family_office: single/multi family. boutique: asset small. offshore: jurisdição estrangeira.';

CREATE INDEX IF NOT EXISTS idx_hub_alt_partners_slug ON public.hub_alt_partners (slug);
CREATE INDEX IF NOT EXISTS idx_hub_alt_partners_ativa ON public.hub_alt_partners (ativa) WHERE ativa = true;

-- =====================================================================
-- 2. hub_alt_opportunities — Oportunidades (os cards do módulo)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  partner_id uuid NOT NULL REFERENCES public.hub_alt_partners(id) ON DELETE RESTRICT,
  titulo text NOT NULL,
  subtitulo text,
  resumo text,
  descricao_longa text,
  classe text NOT NULL CHECK (classe IN (
    'private_credit',
    'private_equity',
    'real_estate',
    'ofertas_restritas',
    'club_deals',
    'offshore',
    'alt_liquidos'
  )),
  subclasse text,
  ticket_minimo numeric(18, 2),
  ticket_maximo numeric(18, 2),
  moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL', 'USD', 'EUR', 'OUTRO')),
  horizonte_meses integer,
  perfil_risco text CHECK (perfil_risco IN ('conservador', 'moderado', 'arrojado')),
  publico_alvo text NOT NULL CHECK (publico_alvo IN ('qualificado', 'profissional', 'varejo')),
  rentabilidade_alvo text,
  volume_captacao numeric(18, 2),
  estrategia text,
  setor text,
  geografia text,
  tags text[] DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'em_breve' CHECK (status IN ('em_breve', 'captando', 'encerrada', 'pausada')),
  data_abertura date,
  data_encerramento date,
  publicado boolean NOT NULL DEFAULT false,
  destaque boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.hub_alt_opportunities IS
  'Oportunidades alternativas listadas na vitrine do hub. Exibidas apenas se publicado=true e suitability ack.';

COMMENT ON COLUMN public.hub_alt_opportunities.classe IS
  '7 classes cobertas: private_credit, private_equity, real_estate, ofertas_restritas, club_deals, offshore, alt_liquidos.';

COMMENT ON COLUMN public.hub_alt_opportunities.publico_alvo IS
  'qualificado: >R$1M. profissional: >R$10M. varejo: sem restrição CVM (raro em alt).';

COMMENT ON COLUMN public.hub_alt_opportunities.publicado IS
  'False: draft (apenas admin vê). True: visível para AAIs PRO.';

CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_slug ON public.hub_alt_opportunities (slug);
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_partner ON public.hub_alt_opportunities (partner_id);
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_classe ON public.hub_alt_opportunities (classe);
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_status ON public.hub_alt_opportunities (status);
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_publicado ON public.hub_alt_opportunities (publicado) WHERE publicado = true;
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_destaque ON public.hub_alt_opportunities (destaque) WHERE destaque = true;
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_publico_alvo ON public.hub_alt_opportunities (publico_alvo);
CREATE INDEX IF NOT EXISTS idx_hub_alt_opp_tags ON public.hub_alt_opportunities USING gin (tags);

-- =====================================================================
-- 3. hub_alt_materials — Anexos (teaser público, deck gated, DD room gated)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.hub_alt_opportunities(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('teaser', 'deck', 'term_sheet', 'dd_document', 'regulamento', 'outro')),
  titulo text NOT NULL,
  descricao text,
  storage_path text NOT NULL,
  mime_type text,
  file_size_bytes bigint,
  tier_acesso text NOT NULL CHECK (tier_acesso IN ('publico', 'pro', 'interesse_registrado')),
  watermark_enabled boolean NOT NULL DEFAULT false,
  versao integer NOT NULL DEFAULT 1,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hub_alt_materials IS
  'Materiais anexos por oportunidade. 3 tiers: publico (teaser ungated), pro (deck/term_sheet gated), interesse_registrado (DD room após preencher form).';

COMMENT ON COLUMN public.hub_alt_materials.tier_acesso IS
  'publico: download livre. pro: requer tier pro+suitability ack+log. interesse_registrado: requer interest form submitted.';

COMMENT ON COLUMN public.hub_alt_materials.watermark_enabled IS
  'Se true, Edge Function aplica watermark dinâmico (nome+email+timestamp) antes de gerar signed URL. V1 feature, V0 apenas log.';

CREATE INDEX IF NOT EXISTS idx_hub_alt_mat_opp ON public.hub_alt_materials (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_hub_alt_mat_tier ON public.hub_alt_materials (tier_acesso);
CREATE INDEX IF NOT EXISTS idx_hub_alt_mat_ativo ON public.hub_alt_materials (ativo) WHERE ativo = true;

-- =====================================================================
-- 4. hub_alt_access_logs — Audit trail (views, downloads, acks)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.hub_alt_opportunities(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.hub_alt_materials(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view', 'download', 'material_request', 'suitability_ack', 'interest_submitted')),
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hub_alt_access_logs IS
  'Audit trail imutável: toda view, download, ack e submissão de interesse é logada. Base para compliance + watermark audit.';

COMMENT ON COLUMN public.hub_alt_access_logs.action IS
  'view: visualizou detail page. download: baixou material. material_request: pediu acesso a material gated. suitability_ack: aceitou termo. interest_submitted: preencheu form de interesse.';

CREATE INDEX IF NOT EXISTS idx_hub_alt_logs_user ON public.hub_alt_access_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alt_logs_opp ON public.hub_alt_access_logs (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alt_logs_material ON public.hub_alt_access_logs (material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alt_logs_action ON public.hub_alt_access_logs (action);

-- =====================================================================
-- 5. hub_alt_interests — Leads (AAI → gestora), cliente anonimizado
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  opportunity_id uuid NOT NULL REFERENCES public.hub_alt_opportunities(id) ON DELETE RESTRICT,
  -- Dados do AAI (auto-prefill do profile)
  aai_nome text NOT NULL,
  aai_email text NOT NULL,
  aai_telefone text,
  aai_escritorio text,
  -- Dados do cliente (anonimizado até fechamento)
  cliente_primeiro_nome text NOT NULL,
  cliente_faixa_patrimonio text NOT NULL CHECK (cliente_faixa_patrimonio IN ('ate_1m', '1m_5m', '5m_10m', '10m_plus')),
  cliente_perfil_suitability text CHECK (cliente_perfil_suitability IN ('conservador', 'moderado', 'arrojado', 'qualificado', 'profissional')),
  ticket_pretendido numeric(18, 2),
  observacoes text,
  -- Status do lead (gestão pelo admin/gestora)
  status text NOT NULL DEFAULT 'novo' CHECK (status IN (
    'novo',
    'enviado_gestora',
    'em_contato',
    'em_analise',
    'fechado',
    'recusado',
    'desistiu'
  )),
  status_notes text,
  enviado_gestora_em timestamptz,
  fechado_em timestamptz,
  valor_fechado numeric(18, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hub_alt_interests IS
  'Leads qualificados: AAI manifesta interesse na oportunidade em nome de um cliente (anonimizado). Origem do revenue share.';

COMMENT ON COLUMN public.hub_alt_interests.cliente_primeiro_nome IS
  'LGPD: apenas primeiro nome até lead virar fechamento. CPF/endereço só após AAI+gestora confirmarem contato direto.';

COMMENT ON COLUMN public.hub_alt_interests.cliente_faixa_patrimonio IS
  'Faixas agregadas para suitability + matching sem expor dado exato: ate_1m, 1m_5m, 5m_10m, 10m_plus.';

COMMENT ON COLUMN public.hub_alt_interests.status IS
  'Pipeline: novo → enviado_gestora → em_contato → em_analise → fechado|recusado|desistiu.';

CREATE INDEX IF NOT EXISTS idx_hub_alt_int_user ON public.hub_alt_interests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alt_int_opp ON public.hub_alt_interests (opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_alt_int_status ON public.hub_alt_interests (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_alt_int_unique_user_opp_cliente
  ON public.hub_alt_interests (user_id, opportunity_id, cliente_primeiro_nome);

-- =====================================================================
-- 6. hub_alt_user_suitability — Aceite versionado do gate de suitability
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.hub_alt_user_suitability (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  declared_profile text CHECK (declared_profile IN ('qualificado', 'profissional', 'varejo_ciente')),
  declared_escritorio text,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hub_alt_user_suitability IS
  'Aceite versionado do gate de suitability. Se terms_version mudar, re-prompt obrigatório.';

COMMENT ON COLUMN public.hub_alt_user_suitability.declared_profile IS
  'Autodeclaração do AAI ao aceitar o termo. qualificado: >R$1M clientes. profissional: >R$10M. varejo_ciente: aceita navegar mesmo sem clientes qualificados.';

-- =====================================================================
-- RLS Policies
-- =====================================================================

ALTER TABLE public.hub_alt_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alt_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alt_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alt_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alt_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_alt_user_suitability ENABLE ROW LEVEL SECURITY;

-- Helper: verifica se user é pro+
CREATE OR REPLACE FUNCTION public.hub_alt_user_is_pro(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hub_user_tiers
    WHERE user_id = uid AND tier IN ('pro', 'admin')
  );
$$;

-- Helper: verifica se user é admin
CREATE OR REPLACE FUNCTION public.hub_alt_user_is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hub_user_tiers
    WHERE user_id = uid AND tier = 'admin'
  );
$$;

-- Partners: admin full, pro read ativa
DROP POLICY IF EXISTS hub_alt_partners_admin_all ON public.hub_alt_partners;
CREATE POLICY hub_alt_partners_admin_all ON public.hub_alt_partners
  FOR ALL TO authenticated
  USING (public.hub_alt_user_is_admin(auth.uid()))
  WITH CHECK (public.hub_alt_user_is_admin(auth.uid()));

DROP POLICY IF EXISTS hub_alt_partners_pro_read ON public.hub_alt_partners;
CREATE POLICY hub_alt_partners_pro_read ON public.hub_alt_partners
  FOR SELECT TO authenticated
  USING (ativa = true AND public.hub_alt_user_is_pro(auth.uid()));

-- Opportunities: admin full, pro read publicado
DROP POLICY IF EXISTS hub_alt_opp_admin_all ON public.hub_alt_opportunities;
CREATE POLICY hub_alt_opp_admin_all ON public.hub_alt_opportunities
  FOR ALL TO authenticated
  USING (public.hub_alt_user_is_admin(auth.uid()))
  WITH CHECK (public.hub_alt_user_is_admin(auth.uid()));

DROP POLICY IF EXISTS hub_alt_opp_pro_read ON public.hub_alt_opportunities;
CREATE POLICY hub_alt_opp_pro_read ON public.hub_alt_opportunities
  FOR SELECT TO authenticated
  USING (publicado = true AND public.hub_alt_user_is_pro(auth.uid()));

-- Materials: admin full, pro read ativo + oportunidade publicada
DROP POLICY IF EXISTS hub_alt_mat_admin_all ON public.hub_alt_materials;
CREATE POLICY hub_alt_mat_admin_all ON public.hub_alt_materials
  FOR ALL TO authenticated
  USING (public.hub_alt_user_is_admin(auth.uid()))
  WITH CHECK (public.hub_alt_user_is_admin(auth.uid()));

DROP POLICY IF EXISTS hub_alt_mat_pro_read ON public.hub_alt_materials;
CREATE POLICY hub_alt_mat_pro_read ON public.hub_alt_materials
  FOR SELECT TO authenticated
  USING (
    ativo = true
    AND public.hub_alt_user_is_pro(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.hub_alt_opportunities o
      WHERE o.id = opportunity_id AND o.publicado = true
    )
  );

-- Access logs: user insere próprio, admin lê tudo, user lê próprio
DROP POLICY IF EXISTS hub_alt_logs_insert_own ON public.hub_alt_access_logs;
CREATE POLICY hub_alt_logs_insert_own ON public.hub_alt_access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS hub_alt_logs_select_own_or_admin ON public.hub_alt_access_logs;
CREATE POLICY hub_alt_logs_select_own_or_admin ON public.hub_alt_access_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.hub_alt_user_is_admin(auth.uid()));

-- Interests: user insert/update próprio (enquanto status='novo'), admin full, user read próprio
DROP POLICY IF EXISTS hub_alt_int_insert_own ON public.hub_alt_interests;
CREATE POLICY hub_alt_int_insert_own ON public.hub_alt_interests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.hub_alt_user_is_pro(auth.uid()));

DROP POLICY IF EXISTS hub_alt_int_select_own_or_admin ON public.hub_alt_interests;
CREATE POLICY hub_alt_int_select_own_or_admin ON public.hub_alt_interests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.hub_alt_user_is_admin(auth.uid()));

DROP POLICY IF EXISTS hub_alt_int_update_own_draft ON public.hub_alt_interests;
CREATE POLICY hub_alt_int_update_own_draft ON public.hub_alt_interests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'novo')
  WITH CHECK (user_id = auth.uid() AND status = 'novo');

DROP POLICY IF EXISTS hub_alt_int_admin_update ON public.hub_alt_interests;
CREATE POLICY hub_alt_int_admin_update ON public.hub_alt_interests
  FOR UPDATE TO authenticated
  USING (public.hub_alt_user_is_admin(auth.uid()))
  WITH CHECK (public.hub_alt_user_is_admin(auth.uid()));

-- Suitability: user insere/atualiza próprio, admin lê tudo
DROP POLICY IF EXISTS hub_alt_suit_upsert_own ON public.hub_alt_user_suitability;
CREATE POLICY hub_alt_suit_upsert_own ON public.hub_alt_user_suitability
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.hub_alt_user_is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.hub_alt_user_is_admin(auth.uid()));

-- =====================================================================
-- Triggers: updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION public.hub_alt_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hub_alt_partners_upd ON public.hub_alt_partners;
CREATE TRIGGER trg_hub_alt_partners_upd
  BEFORE UPDATE ON public.hub_alt_partners
  FOR EACH ROW EXECUTE FUNCTION public.hub_alt_set_updated_at();

DROP TRIGGER IF EXISTS trg_hub_alt_opp_upd ON public.hub_alt_opportunities;
CREATE TRIGGER trg_hub_alt_opp_upd
  BEFORE UPDATE ON public.hub_alt_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.hub_alt_set_updated_at();

DROP TRIGGER IF EXISTS trg_hub_alt_mat_upd ON public.hub_alt_materials;
CREATE TRIGGER trg_hub_alt_mat_upd
  BEFORE UPDATE ON public.hub_alt_materials
  FOR EACH ROW EXECUTE FUNCTION public.hub_alt_set_updated_at();

DROP TRIGGER IF EXISTS trg_hub_alt_int_upd ON public.hub_alt_interests;
CREATE TRIGGER trg_hub_alt_int_upd
  BEFORE UPDATE ON public.hub_alt_interests
  FOR EACH ROW EXECUTE FUNCTION public.hub_alt_set_updated_at();

DROP TRIGGER IF EXISTS trg_hub_alt_suit_upd ON public.hub_alt_user_suitability;
CREATE TRIGGER trg_hub_alt_suit_upd
  BEFORE UPDATE ON public.hub_alt_user_suitability
  FOR EACH ROW EXECUTE FUNCTION public.hub_alt_set_updated_at();

-- =====================================================================
-- Storage bucket: alt-materials (private, Edge Function gera signed URLs)
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alt-materials',
  'alt-materials',
  false,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'image/png',
    'image/jpeg'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies: admin upload/delete, downloads via signed URL only (Edge Function com service role)
DROP POLICY IF EXISTS hub_alt_storage_admin_all ON storage.objects;
CREATE POLICY hub_alt_storage_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'alt-materials'
    AND public.hub_alt_user_is_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'alt-materials'
    AND public.hub_alt_user_is_admin(auth.uid())
  );
