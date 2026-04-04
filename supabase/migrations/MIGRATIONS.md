# Supabase Migrations - Muuney Hub

## Overview
This directory contains all database migrations for the muuney-hub project (Supabase project: `yheopprbuimsunqfaqbp`).

## Migration History (46 migrations)

### Foundation & Infrastructure (Feb 2026)
- `20260225162407` - delete_test_clients_tst001_tst002
- `20260225162414` - delete_test_auth_users
- `20260225162433` - create_get_latest_snapshots_rpc
- `20260225162446` - create_clients_meta_table
- `20260225174215` - create_cobrancas_and_company_settings
- `20260225175327` - fix_cobrancas_schema
- `20260225195730` - add_simulacao_aposentadoria_to_clients_meta
- `20260226001228` - archival_snapshots
- `20260226001301` - create_system_metrics
- `20260226001513` - setup_health_check_cron
- `20260226002833` - setup_metrics_cleanup_cron
- `20260226132648` - add_deleted_at_to_cobrancas
- `20260226150128` - create_market_rates
- `20260226160459` - expand_market_rates_rate_type_check
- `20260227192416` - create_tax_reports
- `20260228123009` - create_fee_disclosures
- `20260228123028` - create_patrimonio_extra

### Security & Compliance (Feb-Mar 2026)
- `20260308202807` - force_reonboarding
- `20260311022337` - add_aprovado_to_suitability_status_check
- `20260317011423` - totp_2fa_table
- `20260317011438` - totp_enrollment
- `20260317011526` - rate_limits
- `20260317011611` - report_schedules_and_deliveries
- `20260320124744` - add_nome_cpf_to_clients_meta
- `20260321104132` - d1_expanded_audit_log_with_retention
- `20260321104350` - d4_push_subscriptions_table
- `20260321104607` - d5_pii_phase2_encrypt_and_null_plaintext

### Content & Features (Mar 2026)
- `20260315152102` - create_blog_posts_table
- `20260321140143` - e_sprint5_rebalancing_analytics_crm
- `20260321231626` - financeiro_automation
- `20260321231709` - create_newsletter_subscribers_table
- `20260322223030` - fix_schema_mismatches_imports
- `20260322223902` - snapshot_versioning_and_document_imports

### Payment Integration (Mar 2026)
- `20260324014301` - payment_integration_stripe_pix
- `20260324014331` - financeiro_cron_schedule
- `20260324020818` - fee_anual_defaults_and_valor_column
- `20260324022156` - add_stripe_customer_id_and_invoice_fields

### Hub Module & Recent (Apr 2026)
- `20260324120726` - create_pro_waitlist_table
- `20260402130213` - 20260401_000001_add_missing_indexes
- `20260402130231` - 20260401_000002_add_stripe_columns
- `20260402222740` - create_hub_leads_table
- `20260402232356` - create_hub_email_sequence
- `20260403031016` - create_b2c_email_templates
- `20260403150723` - hub_modules_1_2_data_infrastructure
- `20260403164118` - add_hub_leads_email_tracking

## Table Categories

### Core Tables (5)
- `profiles` - User profiles with LGPD encryption
- `clients_meta` - Client metadata and account info
- `consent_records` - LGPD consent tracking
- `totp_secrets` - 2FA TOTP secrets
- `company_settings` - System configuration

### Portfolio & Financial (11)
- `snapshots` - Financial snapshots (current)
- `snapshot_versions` - Versioned snapshots
- `snapshots_archive` - Archived snapshots
- `snapshots_all` - Unified view (hot+archive)
- `latest_snapshots` - View for latest data
- `financial_snapshots` - Raw broker data
- `patrimonio_extra` - Extra assets
- `portfolio_analytics` - Computed analytics
- `document_imports` - Imported documents
- `suitability` - Investment suitability
- `target_allocations` - Target portfolio allocation

### Billing & Payments (3)
- `cobrancas` - Monthly fee invoices
- `payment_transactions` - Payment records
- `fee_disclosures` - Fee transparency

### Reports & Compliance (5)
- `tax_reports` - Tax reporting documents
- `tax_report_items` - Tax item details
- `tax_report_totals` - Tax report summaries
- `report_schedules` - Automated report scheduling
- `report_deliveries` - Report delivery tracking

### Marketing & Engagement (4)
- `blog_posts` - Blog articles
- `newsletter_subscribers` - Newsletter list
- `email_sequence` - Email automation (legacy)
- `b2c_email_templates` - Email templates

### Hub Infrastructure (6)
- `hub_leads` - B2B/Hub leads
- `hub_email_templates` - Hub email templates
- `hub_macro_series` - Macro economic data
- `hub_credito_series` - Credit market data
- `hub_macro_series_meta` - Series metadata
- `hub_data_ingestion_log` - Data import logs

### Market Data (1)
- `market_rates` - Interest rates & market data

### CRM & Activity (5)
- `crm_pipeline` - Sales pipeline
- `crm_events` - CRM events
- `notifications` - User notifications
- `portal_events` - Activity tracking
- `pro_waitlist` - Pro tier waitlist

### Security & Audit (4)
- `audit_log` - Legacy audit log
- `audit_logs` - Current audit logs (RLS-enabled)
- `audit_logs_archive` - Archived audit logs
- `rate_limits` - API rate limiting

### Realtime & Push (1)
- `push_subscriptions` - Web push subscriptions

### System (2)
- `latest_metrics` - System metrics
- `system_metrics` - Detailed metrics
- `webhook_events` - Webhook tracking

## Key Architectural Notes

1. **PII Encryption**: Email, CPF, phone encrypted in `profiles` table
2. **RLS Enabled**: `audit_logs` table has row-level security
3. **Multi-Broker Support**: XP, BTG, Inter, Avenue
4. **Stripe Integration**: Invoice URLs, customer IDs, payment intents
5. **BACEN Data Integration**: Macro series auto-fetched from BACEN SGS API
6. **Email Automation**: Multi-step sequences with delay hours
7. **Archive Strategy**: Hot snapshots + archive tables + unified view
8. **Audit Trail**: Expanded audit logs with retention policy

## Running Migrations

```bash
# Apply all pending migrations
supabase migration up

# Check migration status
supabase migration list

# Rollback last migration
supabase migration down
```

## Related Files
- `config.toml` - Supabase project configuration
- `00000000000000_initial_schema.sql` - Full schema export
