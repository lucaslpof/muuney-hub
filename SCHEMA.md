# Muuney Hub - Database Schema Documentation

**Project ID**: yheopprbuimsunqfaqbp  
**Export Date**: 2026-04-03  
**Total Tables**: 54  
**Migrations**: 46  

---

## Core Platform Tables

### profiles
User account profiles with LGPD compliance and PII encryption.

**Key Fields**:
- `id` (UUID) - Primary key, refs to auth.users
- `role` (text) - client | admin | advisor
- `client_id` (text) - Unique client identifier
- `full_name`, `email`, `cpf`, `phone` - PII fields (encrypted)
- `email_encrypted`, `cpf_encrypted`, `phone_encrypted` (bytea)
- `account_xp`, `account_btg`, `account_inter`, `account_avenue` (text) - Broker account IDs
- `advisor`, `sub_advisor` (text)
- `profile_risk`, `risk_score`, `risk_score_max`
- `lgpd_consent`, `lgpd_consent_at` - GDPR/LGPD compliance
- `onboarding_done`, `totp_enabled`, `totp_enforced`

**Indexes**: RLS enabled, email_hash for lookups

---

### clients_meta
Extended client metadata separate from auth.

**Key Fields**:
- `client_id` (text, PK) - Links to profiles.client_id
- `code`, `advisor`, `sub_advisor`
- `conta_xp`, `conta_btg`, `conta_inter`, `conta_avenue`
- `fee_anual` (numeric, default 0.8%) - Annual management fee
- `nome`, `cpf_cnpj`, `email` (plaintext copy for query purposes)
- `status` - pre_registered | active | dormant
- `stripe_customer_id` (text)
- `simulacao_aposentadoria` (jsonb) - Retirement simulation data
- `notes` (text)

**Usage**: Denormalized for performance; audit log changes

---

### consent_records
LGPD consent tracking with granular control.

**Key Fields**:
- `id` (UUID)
- `user_id` (UUID, FK to profiles.id)
- `consent_type` - lgpd | marketing | analytics
- `granted` (boolean)
- `granted_at`, `revoked_at` (timestamptz)
- `ip_address`, `user_agent` - Audit trail

---

### totp_secrets
Two-factor authentication TOTP secrets.

**Key Fields**:
- `user_id` (UUID, PK, FK to profiles.id)
- `encrypted_secret` (text) - Encrypted TOTP key
- `verified` (boolean)
- `backup_codes` (text[]) - Recovery codes
- `enabled_at`, `created_at`, `updated_at`

---

## Portfolio & Financial Data

### snapshots
Primary financial snapshot table (hot data).

**Key Fields**:
- `id`, `client_id`, `period`, `ref_date` (date)
- `patrimonio_total`, `patrimonio_xp`, `patrimonio_btg`, `patrimonio_inter`, `patrimonio_avenue_usd`
- `usd_brl_rate` (numeric)
- Performance metrics: `ret_month`, `ret_12m`, `ret_inception`, `acumulado`, `ganho_12m`
- `pct_cdi_month`, `pct_cdi_12m` - CDI comparison
- `volat_12m` - Volatility
- `allocation` (jsonb) - Asset allocation
- `assets_xp`, `assets_btg`, `assets_inter`, `positions_avenue` (jsonb) - Position details
- `sector_exposure`, `geo_exposure` (jsonb)
- `liquidez`, `movimentacoes`, `benchmarks` (jsonb)
- `source` - manual | auto | import
- `created_by` (UUID, FK to profiles.id)

**Encryption**: 
- `assets_xp_enc`, `assets_btg_enc`, `assets_inter_enc`, `positions_avenue_enc` (bytea)

**Strategy**: Hot snapshots updated frequently; older moved to archive

---

### snapshot_versions
Immutable versioned snapshots for audit trail.

**Key Fields**:
- `id`, `snapshot_id` (FK to snapshots.id), `client_id`
- `version_number` - Incremental version
- Same financial fields as snapshots
- `file_path`, `file_name` - Source document reference
- `created_by` (UUID)

**Usage**: Audit trail; enables "revert to version" workflows

---

### snapshots_archive
Historical snapshots older than 12 months (archive tier).

**Key Fields**: Same as snapshots; moved via pg_partman

**Partitioning Strategy**:
- Time-range partitions by year/quarter
- Auto-archive after 365 days
- Query via `snapshots_all` unified view

---

### latest_snapshots
Materialized view of most recent snapshot per client.

**Indexes**: On `client_id`, `created_at` for fast lookups

---

### financial_snapshots
Raw broker data import (encrypted).

**Key Fields**:
- `id`, `client_id`, `period`, `broker` (xp | btg | inter | avenue)
- `data` (jsonb) - Raw broker extract
- `data_enc` (bytea) - Encrypted copy
- `file_name`, `uploaded_by`

---

### portfolio_analytics
Computed analytics (sector, geo, correlation, risk).

**Key Fields**:
- `id`, `client_id`, `snapshot_id`
- `sector_exposure` (jsonb) - {sector: %, ...}
- `geo_exposure` (jsonb) - {country: %, ...}
- `asset_returns` (jsonb[]) - Per-asset returns
- `correlation_matrix` (jsonb) - Asset correlations
- `risk_metrics` (jsonb) - VaR, sharpe, other
- `computed_at` (timestamptz)

**Usage**: Dashboard, analytics API

---

### suitability
Investment suitability questionnaire & profile.

**Key Fields**:
- `id`, `client_id`
- `status` - pendente | em_progresso | aprovado | reprovado
- `data` (jsonb) - Questionnaire responses
- `last_updated`, `created_at`

**Regulation**: CVM requirement for investment advice

---

### target_allocations
Target portfolio allocation per asset class.

**Key Fields**:
- `id`, `client_id`, `classe` (text) - renda_fixa | renda_variavel | etc.
- `target_pct` (numeric) - Target percentage
- `tolerance` (numeric, default 5.0) - Rebalance threshold
- `updated_by` (UUID)

---

### patrimonio_extra
Extra assets outside broker accounts (real estate, crypto, etc.).

**Key Fields**:
- `id`, `client_id`
- `tipo` - imovel | crypto | ouro | etc.
- `descricao`, `valor`, `data_aquisicao`
- `deleted` (boolean)

---

### rebalancing_history
Executed rebalancing trades & analytics.

**Key Fields**:
- `id`, `client_id`, `executed_by` (UUID)
- `status` - pending | executed | canceled
- `trades` (jsonb[]) - Trade list
- `pre_allocation`, `post_allocation` (jsonb)
- `health_before`, `health_after` (numeric)
- `patrimonio_at` (numeric) - Portfolio value at time
- `executed_at` (timestamptz)

---

## Billing & Payments

### cobrancas
Monthly fee invoices with Stripe integration.

**Key Fields**:
- `id`, `client_id`, `client_name`, `email`
- `ref_mes` (text) - YYYY-MM
- `patrimonio`, `fee_anual` - Fee calculation
- `valor` (numeric, default 0) - Invoice amount
- `status` - Pendente | Pago | Cancelado | Vencido
- `vencimento` (text) - Due date
- Payment: `payment_method`, `payment_intent_id`, `pix_qr_code`, `pix_copia_cola`
- Stripe: `stripe_customer_id`, `stripe_invoice_id`, `stripe_invoice_url`, `payment_url`
- `receipt_url` (text) - Generated receipt
- `auto_charge` (boolean, default true)
- `pago_em`, `deleted_at` (timestamptz)

**Workflow**:
1. Generated monthly (cron)
2. Charged via Stripe (PIX or card)
3. Receipt emailed to client
4. Tracked for reconciliation

---

### payment_transactions
Stripe payment attempt log.

**Key Fields**:
- `id`, `cobranca_id` (FK)
- `provider` - stripe | pix
- `external_id` - Stripe intent ID
- `amount_cents`
- `status` - pending | succeeded | failed | canceled
- `metadata` (jsonb)

---

### fee_disclosures
Quarterly fee transparency (CVM requirement).

**Key Fields**:
- `id`, `client_id`, `ref_date` (date)
- `year` (int2), `quarter` (int2)
- `fee_type` - management | performance | other
- `amount` (numeric)
- `source` - cobranca | calculated
- `notes` (text)

---

## Reports & Analytics

### tax_reports
Tax reporting documents (IR, VGBL, etc.).

**Key Fields**:
- `id`, `client_id`, `broker` (default xp)
- `report_type` - investimentos | previdencia
- `ano_referencia`, `ano_exercicio` (int2)
- `fonte_cnpj`, `fonte_nome` - Broker details
- Financial summary fields: `rendimentos_isentos`, `tributacao_exclusiva`, `rendimentos_tributaveis`
- Account balances: `saldo_conta`, `saldo_vgbl`
- Previdencia: `saldo_vgbl`, `contribuicao_pgbl`, `rendimento_previdencia`, `ir_retido_previdencia`
- `file_hash`, `storage_path`, `raw_text` (encrypted)
- `uploaded_by`, `deleted_at`

---

### tax_report_items
Line-item details from tax reports.

**Key Fields**:
- `id`, `report_id` (FK), `client_id`, `secao`
- `grupo_irpf`, `codigo_irpf` - IR codes
- `ativo_nome`, `emissor`, `cnpj_emissor`
- `saldo_anterior`, `saldo_atual`, `rendimento`
- `ir_retido`, `iof_retido`
- `pagina_pdf` (int2), `linha_raw` (text)

---

### tax_report_totals
Aggregated tax report sections.

**Key Fields**:
- `id`, `report_id`, `client_id`, `secao`
- `descricao`, `valor_total`, `ir_retido_total`

---

### report_schedules
Automated report generation & delivery.

**Key Fields**:
- `id`, `client_id`, `report_type` - performance | tax | tax_advance
- `frequency` - weekly | monthly | quarterly
- `sections` (jsonb) - [resumo, alocacao, performance, movimentacoes]
- `delivery_method` - email | portal | both
- `delivery_email`, `preferred_time` (time), `timezone`
- `is_active`, `send_count`, `last_sent_at`, `next_scheduled_at`
- `last_error` (text)

---

### report_deliveries
Delivery record for each scheduled report.

**Key Fields**:
- `id`, `schedule_id` (FK), `client_id`, `report_type`
- `status` - pending | delivered | failed | opened
- `file_url`, `file_size_kb`
- `delivered_via`, `delivered_at`, `opened_at`
- `error_message` (text)

---

## Marketing & Content

### blog_posts
Blog articles with SEO optimization.

**Key Fields**:
- `id`, `slug` (unique), `title`, `excerpt`, `content` (text)
- `cover_image_url`
- `category` (default Geral)
- `read_time_minutes`, `is_published`
- `published_at`, `created_at`, `updated_at`

**Usage**: CMS for muuney.app blog, SEO landing pages

---

### newsletter_subscribers
Email newsletter subscription list.

**Key Fields**:
- `id`, `email` (unique), `name`
- `source` - newsletter | hub_landing | waitlist
- `confirmed`, `unsubscribed` (boolean)
- `created_at`

---

### email_sequence
Legacy email automation tracking.

**Key Fields**:
- `id`, `email`, `source` (newsletter | hub)
- `sequence_step` (int) - Email number in sequence
- `last_sent_at`, `next_send_at`
- `completed`, `unsubscribed`
- `created_at`

**Migration**: Use `hub_email_templates` + `hub_leads` for new sequences

---

### b2c_email_templates
B2C email template library.

**Key Fields**:
- `id`, `sequence_step` (int)
- `subject`, `preview_text`, `body_html`
- `delay_hours` (int) - Wait time from previous email
- `active` (boolean)
- `created_at`

---

## Hub Infrastructure (New B2B Module)

### hub_leads
B2B lead capture for macro API.

**Key Fields**:
- `id`, `name`, `email`, `company`, `role`
- `source` - hub-landing | partner | manual
- `status` - pending | contacted | qualified | converted | rejected
- `email_step` (int) - Current step in nurture sequence
- `email_completed`, `unsubscribed` (boolean)
- `last_email_at`, `next_email_at`
- `created_at`, `updated_at`

---

### hub_email_templates
B2B email sequence templates.

**Key Fields**:
- `id`, `sequence_step` (int)
- `subject`, `preview_text`, `body_html`
- `delay_hours`, `active`

**Usage**: Multi-step nurture for hub_leads

---

### hub_macro_series
Macro economic time series (BACEN SGS API).

**Key Fields**:
- `id`, `serie_code` (int) - BACEN series code
- `serie_name`, `category`
- `date` (date), `value` (numeric), `unit` (%, absolute, etc.)
- `source` - BACEN_SGS, WORLDBANK, etc.
- `fetched_at` (timestamptz)

**Examples**:
- 432: CDI (% annual)
- 1: SELIC (% annual)
- 11 IPCA inflation
- 21087: BCB CAGED employment

---

### hub_credito_series
Credit market data (complementary to hub_macro_series).

**Key Fields**: Same structure as hub_macro_series; category = credito

---

### hub_macro_series_meta
Metadata for macro series (lookup, descriptions).

**Key Fields**:
- `serie_code` (int, PK)
- `serie_name`, `category`, `unit`, `frequency`
- `description`, `bacen_url`
- `is_active`, `last_fetched_at`, `last_value`, `last_date`

**Usage**: Feed Hub API; power data ingestion job

---

### hub_data_ingestion_log
Audit log for macro data imports.

**Key Fields**:
- `id`, `module` - macro | credito | assets | etc.
- `serie_code` (int, optional)
- `status` - success | partial | failed
- `records_inserted`, `records_updated`
- `error_message`, `started_at`, `completed_at`

---

## CRM & Engagement

### crm_pipeline
Sales pipeline tracking.

**Key Fields**:
- `id`, `client_id`, `stage` - lead | prospect | engaged | negotiating | won | lost
- `source` - indicacao | hub | inbound | etc.
- `assigned_to` (UUID, FK to profiles.id)
- `value_estimate` (numeric)
- `last_contact`, `next_action`, `next_action_date`
- `notes`

---

### crm_events
Event log for client interactions.

**Key Fields**:
- `id`, `client_id`, `tipo_evento`
- `descricao`, `data_evento` (date)
- `criado_por` (text - user email/name)

---

### notifications
User notification center.

**Key Fields**:
- `id`, `client_id`, `type` - info | warning | alert
- `title`, `message`, `read`
- `created_at`

---

### portal_events
Activity tracking for analytics & debugging.

**Key Fields**:
- `id`, `user_id`, `event_type` - login | view_portfolio | download_report | etc.
- `event_category`, `page` (URI)
- `metadata` (jsonb)
- `ip_address`, `user_agent`, `session_id`
- `created_at`

---

### push_subscriptions
Web push notification subscriptions.

**Key Fields**:
- `id`, `user_id` (FK to profiles.id), `client_id`
- `endpoint` (text) - Push service endpoint
- `p256dh`, `auth_key` (text) - VAPID keys
- `user_agent`
- `created_at`

**Usage**: Browser push notifications for portal alerts

---

## System & Configuration

### company_settings
Global application settings (key-value).

**Key Fields**:
- `key` (text, PK) - setting_name
- `value` (jsonb) - Setting value
- `description`, `updated_at`, `updated_by` (UUID)

**Examples**:
- `fee_structure` - Fee tiers
- `portfolio_allocations` - Default templates
- `feature_flags` - Feature toggles

---

### pro_waitlist
Waitlist for Muuney Pro tier.

**Key Fields**:
- `id`, `email`, `name`
- `is_notified` (boolean)
- `subscribed_at`

---

## Security & Audit

### audit_log (Legacy)
Original audit log table (single-field design).

**Key Fields**:
- `id` (BIGINT), `user_id`, `user_email`
- `action`, `details` (jsonb), `ip_address`
- `created_at`

**Status**: Superseded by `audit_logs` v2

---

### audit_logs (Current)
Enhanced audit log with RLS and retention.

**Key Fields**:
- `id` (UUID), `user_id`, `client_id`
- `action`, `category`, `severity` - info | warning | error | critical
- `details` (jsonb), `ip_address`, `user_agent`
- `created_at`

**Security**: RLS enabled; filtered by user role

**Retention**: Auto-archived after 90 days via `audit_logs_archive`

---

### audit_logs_archive
Archived audit logs (90+ days old).

**Key Fields**: Same as audit_logs

**Partitioning**: Time-range partitions (monthly)

---

### rate_limits
API rate limiting tracking.

**Key Fields**:
- `id`, `key` (text) - user_id | ip_address
- `endpoint` (text) - API endpoint
- `count` (int)
- `window_start` (timestamptz), `window_ms` (int)
- `created_at`

**Usage**: Sliding window rate limiting; cleanup cron deletes old entries

---

## Data Lifecycle & Archival

### Snapshots Strategy
1. **Hot** (snapshots): Current + last 12 months
2. **Archive** (snapshots_archive): 12+ months old
3. **Unified View** (snapshots_all): Query both, application handles tier
4. **Cleanup**: pg_partman auto-moves via cron

### Audit Log Strategy
1. **Current** (audit_logs): Active logs (RLS-enabled)
2. **Archive** (audit_logs_archive): 90+ days old
3. **Retention**: 2+ years on archive
4. **Cron**: Daily archival job at 2 AM

### PII Encryption
- Encrypted fields: `email_encrypted`, `cpf_encrypted`, `phone_encrypted` in profiles
- Plaintext fields: Searchable copies in clients_meta (indexed)
- Audit: All PII access logged to audit_logs

---

## Indexing Strategy

**Key Indexes**:
- `profiles(client_id)` - Client lookups
- `profiles(email_hash)` - Secure email search
- `snapshots(client_id, ref_date)` - Portfolio queries
- `cobrancas(client_id, ref_mes)` - Billing history
- `hub_macro_series(serie_code, date)` - Time series queries
- `audit_logs(user_id, created_at)` - Activity history
- `newsletter_subscribers(email)` - Subscription checks

---

## Foreign Keys & Relationships

```
auth.users
  ↓ 1:1
profiles
  ├─ 1:many → snapshots (client_id)
  ├─ 1:many → cobrancas (client_id)
  ├─ 1:many → crm_pipeline (client_id)
  └─ 1:many → tax_reports (client_id)

profiles
  ├─ 1:1 → totp_secrets (user_id)
  ├─ 1:many → push_subscriptions (user_id)
  ├─ 1:many → portal_events (user_id)
  └─ 1:many → audit_logs (user_id)

snapshots
  ├─ 1:many → snapshot_versions (snapshot_id)
  ├─ 1:many → document_imports (client_id)
  └─ 1:1 → portfolio_analytics (snapshot_id)

cobrancas
  └─ 1:many → payment_transactions (cobranca_id)

report_schedules
  └─ 1:many → report_deliveries (schedule_id)

tax_reports
  ├─ 1:many → tax_report_items (report_id)
  └─ 1:many → tax_report_totals (report_id)
```

---

## Migration Notes

- **Total Size**: ~150 tables (including materialized views, RLS policies)
- **Auto-Generated**: `latest_snapshots`, `snapshots_all` (views)
- **Cron Jobs**: Health check (5min), archival (daily), metrics cleanup (daily)
- **Edge Functions**: validate-signup, send-email-sequence, submit-indexnow
- **Encryption**: PII at-rest; HTTPS in-transit; field-level key management

---

Generated on: **2026-04-03**  
Muuney Hub - Strategic Financial Management for Gen Z & Millennials
