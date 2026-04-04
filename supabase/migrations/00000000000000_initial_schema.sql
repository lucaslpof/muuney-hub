-- Muuney Hub - Initial Database Schema Export
-- Exported from Supabase project: yheopprbuimsunqfaqbp
-- Export date: 2026-04-03
-- Tables: 54 total

-- Core Platform Tables
CREATE TABLE audit_log (id BIGINT NOT NULL DEFAULT nextval('audit_log_id_seq'::regclass), user_id UUID, user_email TEXT, action TEXT NOT NULL, details JSONB DEFAULT '{}'::jsonb, ip_address inet, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE audit_logs (id UUID NOT NULL DEFAULT gen_random_uuid(), user_id UUID, client_id TEXT, action TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general'::text, severity TEXT NOT NULL DEFAULT 'info'::text, details JSONB DEFAULT '{}'::jsonb, ip_address inet, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE audit_logs_archive (id UUID NOT NULL DEFAULT gen_random_uuid(), user_id UUID, client_id TEXT, action TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general'::text, severity TEXT NOT NULL DEFAULT 'info'::text, details JSONB DEFAULT '{}'::jsonb, ip_address inet, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Email & Marketing Tables
CREATE TABLE b2c_email_templates (id UUID NOT NULL DEFAULT gen_random_uuid(), sequence_step INTEGER NOT NULL, subject TEXT NOT NULL, preview_text TEXT, body_html TEXT NOT NULL, delay_hours INTEGER NOT NULL DEFAULT 0, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE blog_posts (id UUID NOT NULL DEFAULT gen_random_uuid(), slug TEXT NOT NULL, title TEXT NOT NULL, excerpt TEXT NOT NULL, content TEXT NOT NULL, cover_image_url TEXT, category TEXT NOT NULL DEFAULT 'Geral'::text, read_time_minutes INTEGER NOT NULL DEFAULT 5, is_published BOOLEAN NOT NULL DEFAULT false, published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE email_sequence (id UUID NOT NULL DEFAULT gen_random_uuid(), email TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'newsletter'::text, sequence_step INTEGER NOT NULL DEFAULT 0, last_sent_at TIMESTAMPTZ, next_send_at TIMESTAMPTZ DEFAULT (now() + '00:01:00'::interval), completed BOOLEAN DEFAULT false, unsubscribed BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE hub_email_templates (id UUID NOT NULL DEFAULT gen_random_uuid(), sequence_step INTEGER NOT NULL, subject TEXT NOT NULL, preview_text TEXT, body_html TEXT NOT NULL, delay_hours INTEGER NOT NULL DEFAULT 0, active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE newsletter_subscribers (id UUID NOT NULL DEFAULT gen_random_uuid(), email TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'newsletter'::text, name TEXT, created_at TIMESTAMPTZ DEFAULT now(), confirmed BOOLEAN DEFAULT false, unsubscribed BOOLEAN DEFAULT false);

-- Hub Leads & B2B Tables
CREATE TABLE hub_leads (id UUID NOT NULL DEFAULT gen_random_uuid(), name TEXT NOT NULL, email TEXT NOT NULL, company TEXT, role TEXT, source TEXT DEFAULT 'hub-landing'::text, status TEXT DEFAULT 'pending'::text, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), email_step INTEGER DEFAULT 0, last_email_at TIMESTAMPTZ, next_email_at TIMESTAMPTZ DEFAULT now(), email_completed BOOLEAN DEFAULT false, unsubscribed BOOLEAN DEFAULT false);

-- Hub Data Infrastructure (Macro API)
CREATE TABLE hub_credito_series (id BIGINT NOT NULL DEFAULT nextval('hub_credito_series_id_seq'::regclass), serie_code INTEGER NOT NULL, serie_name TEXT NOT NULL, category TEXT NOT NULL, date date NOT NULL, value NUMERIC NOT NULL, unit TEXT DEFAULT '%'::text, source TEXT DEFAULT 'BACEN_SGS'::text, fetched_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE hub_data_ingestion_log (id BIGINT NOT NULL DEFAULT nextval('hub_data_ingestion_log_id_seq'::regclass), module TEXT NOT NULL, serie_code INTEGER, status TEXT NOT NULL, records_inserted INTEGER DEFAULT 0, records_updated INTEGER DEFAULT 0, error_message TEXT, started_at TIMESTAMPTZ DEFAULT now(), completed_at TIMESTAMPTZ);

CREATE TABLE hub_macro_series (id BIGINT NOT NULL DEFAULT nextval('hub_macro_series_id_seq'::regclass), serie_code INTEGER NOT NULL, serie_name TEXT NOT NULL, category TEXT NOT NULL, date date NOT NULL, value NUMERIC NOT NULL, unit TEXT DEFAULT '%'::text, source TEXT DEFAULT 'BACEN_SGS'::text, fetched_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE hub_macro_series_meta (serie_code INTEGER NOT NULL, serie_name TEXT NOT NULL, category TEXT NOT NULL, unit TEXT NOT NULL, frequency TEXT NOT NULL, description TEXT, bacen_url TEXT, is_active BOOLEAN DEFAULT true, last_fetched_at TIMESTAMPTZ, last_value NUMERIC, last_date date);

-- Market Data Tables
CREATE TABLE market_rates (id UUID NOT NULL DEFAULT gen_random_uuid(), ref_date date NOT NULL, name TEXT NOT NULL, value NUMERIC NOT NULL, source TEXT DEFAULT 'bcb_api'::text, fetched_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE latest_metrics (metric_name TEXT, metric_value NUMERIC, recorded_at TIMESTAMPTZ);

CREATE TABLE system_metrics (id BIGINT NOT NULL, metric_name TEXT NOT NULL, metric_value NUMERIC, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- User & Profile Management
CREATE TABLE profiles (id UUID NOT NULL, role TEXT NOT NULL DEFAULT 'client'::text, client_id TEXT, full_name TEXT, email TEXT, cpf TEXT, phone TEXT, account_xp TEXT, account_btg TEXT, advisor TEXT, sub_advisor TEXT, profile_risk TEXT DEFAULT 'Não definido'::text, risk_score INTEGER DEFAULT 0, risk_score_max INTEGER DEFAULT 25, since_date TEXT, last_update TEXT, next_review TEXT, active BOOLEAN NOT NULL DEFAULT true, lgpd_consent BOOLEAN NOT NULL DEFAULT false, lgpd_consent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), onboarding_done BOOLEAN NOT NULL DEFAULT false, totp_enabled BOOLEAN NOT NULL DEFAULT false, totp_enforced BOOLEAN NOT NULL DEFAULT false, email_encrypted bytea, cpf_encrypted bytea, phone_encrypted bytea, email_hash TEXT);

CREATE TABLE clients_meta (client_id TEXT NOT NULL, code TEXT, advisor TEXT, sub_advisor TEXT, since TEXT, next_review TEXT, risk_pts INTEGER, risk_max INTEGER DEFAULT 25, conta_xp TEXT, conta_btg TEXT, conta_inter TEXT, conta_avenue TEXT, fee_anual NUMERIC DEFAULT 0.8, notes TEXT, updated_at TIMESTAMPTZ DEFAULT now(), simulacao_aposentadoria JSONB, nome TEXT, cpf_cnpj TEXT, email TEXT, status TEXT DEFAULT 'pre_registered'::text, stripe_customer_id TEXT);

CREATE TABLE consent_records (id UUID NOT NULL DEFAULT gen_random_uuid(), user_id UUID NOT NULL, consent_type TEXT NOT NULL DEFAULT 'lgpd'::text, granted BOOLEAN NOT NULL DEFAULT false, granted_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE totp_secrets (user_id UUID NOT NULL, encrypted_secret TEXT NOT NULL, verified BOOLEAN DEFAULT false, backup_codes _text DEFAULT '{}'::text[], enabled_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

-- Portfolio & Financial Data
CREATE TABLE snapshots (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, period TEXT NOT NULL, ref_date date NOT NULL, patrimonio_total NUMERIC NOT NULL, patrimonio_xp NUMERIC DEFAULT 0, patrimonio_btg NUMERIC DEFAULT 0, ret_month NUMERIC, ret_cdi_month NUMERIC, pct_cdi_month NUMERIC, ret_12m NUMERIC, ret_cdi_12m NUMERIC, pct_cdi_12m NUMERIC, ret_2025 NUMERIC, ret_2024 NUMERIC, acumulado NUMERIC, ganho_month NUMERIC, ganho_12m NUMERIC, volat_12m NUMERIC, allocation JSONB, monthly JSONB, cumulative JSONB, periods JSONB, assets_xp JSONB, assets_btg JSONB, brinson_jan JSONB, brinson_12m JSONB, source TEXT DEFAULT 'manual'::text, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), created_by UUID, assets_inter JSONB, positions_avenue JSONB, patrimonio_inter NUMERIC DEFAULT NULL::numeric, patrimonio_avenue_usd NUMERIC DEFAULT NULL::numeric, usd_brl_rate NUMERIC DEFAULT NULL::numeric, ret_inception NUMERIC DEFAULT NULL::numeric, liquidez JSONB, movimentacoes JSONB, benchmarks JSONB, updated_at TIMESTAMPTZ DEFAULT now(), assets_xp_enc bytea, assets_btg_enc bytea, assets_inter_enc bytea, positions_avenue_enc bytea);

CREATE TABLE latest_snapshots (id UUID, client_id TEXT, period TEXT, ref_date date, patrimonio_total NUMERIC, patrimonio_xp NUMERIC, patrimonio_btg NUMERIC, ret_month NUMERIC, ret_12m NUMERIC, pct_cdi_12m NUMERIC, acumulado NUMERIC, ganho_12m NUMERIC, source TEXT);

CREATE TABLE snapshots_archive (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, period TEXT NOT NULL, ref_date date NOT NULL, patrimonio_total NUMERIC NOT NULL, patrimonio_xp NUMERIC DEFAULT 0, patrimonio_btg NUMERIC DEFAULT 0, ret_month NUMERIC, ret_cdi_month NUMERIC, pct_cdi_month NUMERIC, ret_12m NUMERIC, ret_cdi_12m NUMERIC, pct_cdi_12m NUMERIC, ret_2025 NUMERIC, ret_2024 NUMERIC, acumulado NUMERIC, ganho_month NUMERIC, ganho_12m NUMERIC, volat_12m NUMERIC, allocation JSONB, monthly JSONB, cumulative JSONB, periods JSONB, assets_xp JSONB, assets_btg JSONB, brinson_jan JSONB, brinson_12m JSONB, source TEXT DEFAULT 'manual'::text, notes TEXT, created_at TIMESTAMPTZ DEFAULT now(), created_by UUID, assets_inter JSONB, positions_avenue JSONB, patrimonio_inter NUMERIC DEFAULT NULL::numeric, patrimonio_avenue_usd NUMERIC DEFAULT NULL::numeric, usd_brl_rate NUMERIC DEFAULT NULL::numeric, ret_inception NUMERIC DEFAULT NULL::numeric, liquidez JSONB, movimentacoes JSONB, benchmarks JSONB);

CREATE TABLE snapshots_all (id UUID, client_id TEXT, period TEXT, ref_date date, patrimonio_total NUMERIC, patrimonio_xp NUMERIC, patrimonio_btg NUMERIC, ret_month NUMERIC, ret_cdi_month NUMERIC, pct_cdi_month NUMERIC, ret_12m NUMERIC, ret_cdi_12m NUMERIC, pct_cdi_12m NUMERIC, ret_2025 NUMERIC, ret_2024 NUMERIC, acumulado NUMERIC, ganho_month NUMERIC, ganho_12m NUMERIC, volat_12m NUMERIC, allocation JSONB, monthly JSONB, cumulative JSONB, periods JSONB, assets_xp JSONB, assets_btg JSONB, brinson_jan JSONB, brinson_12m JSONB, source TEXT, notes TEXT, created_at TIMESTAMPTZ, created_by UUID, assets_inter JSONB, positions_avenue JSONB, patrimonio_inter NUMERIC, patrimonio_avenue_usd NUMERIC, usd_brl_rate NUMERIC, ret_inception NUMERIC, liquidez JSONB, movimentacoes JSONB, benchmarks JSONB, storage_tier TEXT);

CREATE TABLE snapshot_versions (id UUID NOT NULL DEFAULT gen_random_uuid(), snapshot_id UUID, client_id TEXT NOT NULL, period TEXT NOT NULL, version_number INTEGER NOT NULL DEFAULT 1, ref_date date, patrimonio_total NUMERIC, patrimonio_xp NUMERIC, patrimonio_btg NUMERIC, patrimonio_inter NUMERIC, patrimonio_avenue_usd NUMERIC, usd_brl_rate NUMERIC, ret_month NUMERIC, ret_cdi_month NUMERIC, pct_cdi_month NUMERIC, ret_12m NUMERIC, ret_cdi_12m NUMERIC, pct_cdi_12m NUMERIC, ret_2025 NUMERIC, ret_2024 NUMERIC, ret_inception NUMERIC, acumulado NUMERIC, ganho_month NUMERIC, ganho_12m NUMERIC, volat_12m NUMERIC, allocation JSONB, monthly JSONB, cumulative JSONB, periods JSONB, assets_xp JSONB, assets_btg JSONB, assets_inter JSONB, positions_avenue JSONB, liquidez JSONB, movimentacoes JSONB, benchmarks JSONB, brinson_jan JSONB, brinson_12m JSONB, source TEXT DEFAULT 'manual'::text, notes TEXT, file_path TEXT, file_name TEXT, created_by UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE financial_snapshots (id INTEGER NOT NULL DEFAULT nextval('financial_snapshots_id_seq'::regclass), client_id TEXT NOT NULL, period TEXT NOT NULL, broker TEXT NOT NULL, data JSONB NOT NULL DEFAULT '{}'::jsonb, file_name TEXT, uploaded_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), data_enc bytea);

CREATE TABLE document_imports (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, snapshot_version_id UUID, file_name TEXT NOT NULL, file_path TEXT NOT NULL, file_size BIGINT, file_type TEXT, broker TEXT, period TEXT, status TEXT DEFAULT 'completed'::text, imported_by UUID, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE patrimonio_extra (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, tipo TEXT NOT NULL, descricao TEXT NOT NULL DEFAULT ''::text, valor NUMERIC NOT NULL DEFAULT 0, data_aquisicao date, deleted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Billing & Payments
CREATE TABLE cobrancas (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, client_name TEXT, email TEXT, ref_mes TEXT NOT NULL, vencimento TEXT, patrimonio NUMERIC DEFAULT 0, fee_anual NUMERIC DEFAULT 0.8, status TEXT NOT NULL DEFAULT 'Pendente'::text, pago_em TIMESTAMPTZ, obs TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ, payment_method TEXT, payment_intent_id TEXT, payment_url TEXT, pix_qr_code TEXT, pix_copia_cola TEXT, receipt_url TEXT, valor NUMERIC DEFAULT 0, stripe_invoice_id TEXT, stripe_invoice_url TEXT, auto_charge BOOLEAN DEFAULT true);

CREATE TABLE payment_transactions (id UUID NOT NULL DEFAULT gen_random_uuid(), cobranca_id UUID, provider TEXT NOT NULL, external_id TEXT, amount_cents INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending'::text, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE fee_disclosures (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, ref_date date NOT NULL, year int2 NOT NULL, quarter int2 NOT NULL, fee_type TEXT NOT NULL, amount NUMERIC NOT NULL DEFAULT 0, source TEXT, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Reports & Analytics
CREATE TABLE tax_reports (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, broker TEXT NOT NULL DEFAULT 'xp'::text, report_type TEXT NOT NULL DEFAULT 'investimentos'::text, ano_referencia int2 NOT NULL, ano_exercicio int2 NOT NULL, fonte_cnpj TEXT, fonte_nome TEXT, rendimentos_isentos NUMERIC DEFAULT 0, tributacao_exclusiva NUMERIC DEFAULT 0, rendimentos_tributaveis NUMERIC DEFAULT 0, saldo_conta NUMERIC DEFAULT 0, creditos_transito NUMERIC DEFAULT 0, dividas_onus NUMERIC DEFAULT 0, saldo_vgbl NUMERIC DEFAULT 0, contribuicao_pgbl NUMERIC DEFAULT 0, rendimento_previdencia NUMERIC DEFAULT 0, ir_retido_previdencia NUMERIC DEFAULT 0, file_hash TEXT, storage_path TEXT, raw_text TEXT, parsed_at TIMESTAMPTZ DEFAULT now(), uploaded_by UUID, deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE tax_report_items (id UUID NOT NULL DEFAULT gen_random_uuid(), report_id UUID NOT NULL, client_id TEXT NOT NULL, secao TEXT NOT NULL, grupo_irpf TEXT, codigo_irpf TEXT, ativo_nome TEXT NOT NULL, emissor TEXT, cnpj_emissor TEXT, saldo_anterior NUMERIC DEFAULT 0, saldo_atual NUMERIC DEFAULT 0, rendimento NUMERIC DEFAULT 0, ir_retido NUMERIC DEFAULT 0, iof_retido NUMERIC DEFAULT 0, pagina_pdf int2, linha_raw TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE tax_report_totals (id UUID NOT NULL DEFAULT gen_random_uuid(), report_id UUID NOT NULL, client_id TEXT NOT NULL, secao TEXT NOT NULL, descricao TEXT, valor_total NUMERIC NOT NULL DEFAULT 0, ir_retido_total NUMERIC DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE report_schedules (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, report_type TEXT NOT NULL, frequency TEXT NOT NULL, sections JSONB NOT NULL DEFAULT '["resumo", "alocacao", "performance", "movimentacoes"]'::jsonb, delivery_method TEXT NOT NULL DEFAULT 'email'::text, delivery_email TEXT, day_of_month INTEGER, day_of_week INTEGER, preferred_time time DEFAULT '09:00:00'::time without time zone, timezone TEXT DEFAULT 'America/Sao_Paulo'::text, is_active BOOLEAN NOT NULL DEFAULT true, last_sent_at TIMESTAMPTZ, next_scheduled_at TIMESTAMPTZ, send_count INTEGER DEFAULT 0, last_error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE report_deliveries (id UUID NOT NULL DEFAULT gen_random_uuid(), schedule_id UUID NOT NULL, client_id TEXT NOT NULL, status TEXT NOT NULL, report_type TEXT NOT NULL, file_url TEXT, file_size_kb INTEGER, delivered_via TEXT, delivered_at TIMESTAMPTZ, opened_at TIMESTAMPTZ, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE portfolio_analytics (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, snapshot_id UUID, sector_exposure JSONB DEFAULT '{}'::jsonb, geo_exposure JSONB DEFAULT '{}'::jsonb, asset_returns JSONB DEFAULT '[]'::jsonb, correlation_matrix JSONB DEFAULT '{}'::jsonb, risk_metrics JSONB DEFAULT '{}'::jsonb, computed_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Rebalancing & Investment Management
CREATE TABLE rebalancing_history (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, executed_by UUID, status TEXT NOT NULL DEFAULT 'pending'::text, trades JSONB NOT NULL DEFAULT '[]'::jsonb, pre_allocation JSONB, post_allocation JSONB, patrimonio_at NUMERIC, health_before NUMERIC, health_after NUMERIC, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), executed_at TIMESTAMPTZ);

CREATE TABLE target_allocations (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, classe TEXT NOT NULL, target_pct NUMERIC NOT NULL, tolerance NUMERIC NOT NULL DEFAULT 5.00, updated_by UUID, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE suitability (id INTEGER NOT NULL DEFAULT nextval('suitability_id_seq'::regclass), client_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente'::text, data JSONB NOT NULL DEFAULT '{}'::jsonb, last_updated TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- CRM & Engagement
CREATE TABLE crm_pipeline (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, stage TEXT NOT NULL DEFAULT 'lead'::text, source TEXT DEFAULT 'indicacao'::text, assigned_to UUID, value_estimate NUMERIC, notes TEXT, last_contact TIMESTAMPTZ, next_action TEXT, next_action_date date, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE crm_events (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, tipo_evento TEXT NOT NULL, descricao TEXT NOT NULL, data_evento date NOT NULL DEFAULT CURRENT_DATE, criado_por TEXT, created_at TIMESTAMPTZ DEFAULT now());

-- Notifications & Activity
CREATE TABLE notifications (id UUID NOT NULL DEFAULT gen_random_uuid(), client_id TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'info'::text, title TEXT NOT NULL, message TEXT, read BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE portal_events (id UUID NOT NULL DEFAULT gen_random_uuid(), user_id UUID, event_type TEXT NOT NULL, event_category TEXT, metadata JSONB DEFAULT '{}'::jsonb, page TEXT, ip_address TEXT, user_agent TEXT, session_id TEXT, created_at TIMESTAMPTZ DEFAULT now());

CREATE TABLE push_subscriptions (id UUID NOT NULL DEFAULT gen_random_uuid(), user_id UUID NOT NULL, client_id TEXT, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth_key TEXT NOT NULL, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Configuration & System
CREATE TABLE company_settings (key TEXT NOT NULL, value JSONB NOT NULL DEFAULT '{}'::jsonb, description TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_by UUID);

CREATE TABLE pro_waitlist (id UUID NOT NULL DEFAULT gen_random_uuid(), email TEXT NOT NULL, name TEXT, is_notified BOOLEAN NOT NULL DEFAULT false, subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Rate Limiting & Security
CREATE TABLE rate_limits (id BIGINT NOT NULL DEFAULT nextval('rate_limits_id_seq'::regclass), key TEXT NOT NULL, endpoint TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, window_start TIMESTAMPTZ NOT NULL DEFAULT now(), window_ms INTEGER NOT NULL DEFAULT 3600000, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE webhook_events (id BIGINT NOT NULL, event_id TEXT NOT NULL, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT now());
