# Muuney Hub - Database Schema Export

**Project**: muuney-hub  
**Supabase Project ID**: yheopprbuimsunqfaqbp  
**Export Date**: 2026-04-03  
**Status**: Production Database Schema  

---

## Overview

Complete database schema export for the Muuney Hub platform, including:
- 54 tables across 11 logical domains
- 46 migration files with full audit trail
- Comprehensive schema documentation
- Query guide with common patterns
- Configuration templates

This export provides a complete snapshot of the production Supabase database for:
- Development environment setup
- Disaster recovery planning
- Architecture documentation
- Team onboarding

---

## Directory Structure

```
muuney-hub/
├── README.md (this file)
├── SCHEMA.md (comprehensive schema documentation)
│
└── supabase/
    ├── config.toml (Supabase project configuration)
    ├── QUERY_GUIDE.md (common SQL queries & patterns)
    │
    └── migrations/
        ├── 00000000000000_initial_schema.sql (full schema export)
        ├── MIGRATIONS.md (migration history & details)
        └── [original 46 migrations from production]
```

---

## Key Files

### 1. SCHEMA.md (Primary Reference)
Detailed documentation of all 54 tables organized by domain:

**Domains**:
- Core Platform (5 tables) - Profiles, consent, auth
- Portfolio & Financial (11 tables) - Snapshots, analytics, positions
- Billing & Payments (3 tables) - Invoices, transactions, fees
- Reports & Compliance (5 tables) - Tax, audit, delivery
- Marketing & Content (4 tables) - Blog, newsletters, emails
- Hub Infrastructure (6 tables) - Leads, macro API, data ingestion
- CRM & Engagement (5 tables) - Pipeline, events, notifications
- Security & Audit (4 tables) - Audit logs, rate limiting
- System & Config (2 tables) - Settings, waitlist
- Realtime (1 table) - Push subscriptions
- Monitoring (3 tables) - Metrics, webhooks

**Includes**:
- Table descriptions & purpose
- Complete field listing with data types
- Key constraints & defaults
- Foreign key relationships
- Indexing strategy
- Encryption & security approach
- Data lifecycle & archival

### 2. supabase/migrations/00000000000000_initial_schema.sql
Full schema export as SQL CREATE TABLE statements.

**Usage**:
```bash
# Apply initial schema to new Supabase project
psql -h <db-host> -U postgres -d postgres -f migrations/00000000000000_initial_schema.sql
```

**Structure**:
- 54 CREATE TABLE statements
- Organized by domain with comments
- Includes defaults, constraints, indexes
- PII encryption fields preserved

### 3. supabase/config.toml
Supabase project configuration for:
- API settings (max rows, formats)
- Database configuration (PostgreSQL 15)
- Auth setup (signup, JWT expiry)
- Email provider (Resend)
- Storage, Realtime, Cron jobs
- Security policies

**Customize for your environment**:
```toml
[project]
project_id = "your-project-id"
region = "your-preferred-region"

[auth]
enable_signup = true  # Adjust per your security policy
```

### 4. QUERY_GUIDE.md
Common SQL patterns organized by use case:

**Categories**:
- User Management (profile lookups, activity)
- Portfolio Queries (snapshots, allocations, performance)
- Billing & Payments (invoices, transactions, fees)
- Reports & Compliance (tax, delivery tracking)
- Marketing & Leads (conversion funnel, newsletter)
- Macro Data (Hub API, indicators, ingestion)
- Audit & Security (activity logs, suspicious access)
- System Monitoring (metrics, 2FA adoption)

**Copy-paste ready** SQL with parameter placeholders.

### 5. supabase/migrations/MIGRATIONS.md
Complete migration history with:
- All 46 migrations timestamped
- Migration purpose & category
- Execution order
- Related tables affected

---

## Table Summary by Domain

| Domain | Tables | Key Purpose |
|--------|--------|-------------|
| **Core Platform** | 5 | User identity, auth, consent |
| **Portfolio & Financial** | 11 | Client positions, snapshots, analytics |
| **Billing & Payments** | 3 | Invoicing, payment tracking, fees |
| **Reports & Compliance** | 5 | Tax docs, audit reports, delivery |
| **Marketing & Content** | 4 | Blog, newsletter, email automation |
| **Hub Infrastructure** | 6 | B2B leads, macro economic data |
| **CRM & Engagement** | 5 | Sales pipeline, activity, notifications |
| **Security & Audit** | 4 | Access logs, rate limiting |
| **System & Config** | 2 | Settings, product waitlist |
| **Realtime** | 1 | Web push subscriptions |
| **Monitoring** | 3 | System metrics, webhooks |

---

## Critical Tables for New Environments

### Must Initialize First:
1. `profiles` - User identity (refs auth.users)
2. `clients_meta` - Client metadata
3. `consent_records` - LGPD compliance
4. `company_settings` - System configuration

### Core Features:
5. `snapshots` + `snapshot_versions` - Portfolio data
6. `cobrancas` - Billing engine
7. `audit_logs` - Compliance & security
8. `hub_macro_series_meta` - Macro API metadata

### Optional (Feature-Dependent):
- `blog_posts` - Content management
- `tax_reports*` - Tax reporting module
- `crm_pipeline` - Sales tracking
- `push_subscriptions` - Mobile notifications

---

## Security & Compliance

### PII Encryption
- `profiles.email_encrypted`, `cpf_encrypted`, `phone_encrypted` (bytea)
- `clients_meta.nome`, `cpf_cnpj`, `email` (searchable plaintext)
- `snapshot.assets_*_enc` (financial data encrypted)

### Access Control
- RLS enabled on `audit_logs` table
- Row-level policies by user role (admin | advisor | client)
- Client_id filtering on all portfolio tables

### Data Retention
- Hot snapshots: Current + 12 months
- Archive snapshots: 12+ months
- Audit logs: 90 days current + archive
- Consent records: Indefinite (LGPD requirement)

### Compliance
- CVM: Suitability data, fee disclosures
- BACEN: Macro data integration
- LGPD: PII encryption, consent records
- Tax: Annual tax report retention

---

## Integration Points

### External APIs
- **Supabase Auth**: OAuth, JWT, email/password
- **Stripe**: Billing, PIX payments, invoices
- **Resend**: Email delivery (via Edge Functions)
- **BACEN SGS**: Macro economic series (auto-fetched)
- **Pluggy**: Broker data aggregation (if enabled)

### Edge Functions
- `validate-signup` - Auth flow
- `send-email-sequence` - Email automation
- `submit-indexnow` - SEO indexing

### Cron Jobs
- Health check (5 min)
- Snapshot archival (daily 2 AM)
- Metrics cleanup (daily)
- Billing generation (monthly)
- Data ingestion (hourly)

---

## Usage Examples

### 1. Spin Up New Dev Environment
```bash
# Create new Supabase project
# Copy this export to your repo
cp -r muuney-hub/supabase ./

# Apply configuration
supabase init
supabase link --project-ref <new-project-id>

# Apply migrations
supabase migration push

# Or apply initial schema directly:
psql -h <host> -U postgres -d postgres < supabase/migrations/00000000000000_initial_schema.sql
```

### 2. Backup & Restore
```bash
# Export current database (production)
pg_dump -h <host> -U postgres <database> > backup.sql

# Restore to new environment
psql -h <new-host> -U postgres <database> < backup.sql

# Verify with schema diff
diff <(your-current-schema) <(muuney-hub/SCHEMA.md)
```

### 3. Query Portfolio Data
```bash
# See QUERY_GUIDE.md for:
# - Latest snapshots for all clients
# - Performance comparisons
# - Allocation analysis
# - Asset position tracking
```

### 4. Monitor System Health
```bash
# Check data ingestion status
SELECT * FROM hub_data_ingestion_log 
ORDER BY completed_at DESC LIMIT 10;

# Verify audit trail
SELECT COUNT(*) as total_logs FROM audit_logs
WHERE created_at > NOW() - INTERVAL '24 hours';

# Check rate limiting
SELECT COUNT(*) FROM rate_limits
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Documentation Index

| File | Purpose | Audience |
|------|---------|----------|
| `SCHEMA.md` | Complete table reference | Developers, DBAs |
| `QUERY_GUIDE.md` | SQL patterns & examples | Developers, Analysts |
| `supabase/config.toml` | Project configuration | DevOps, Architects |
| `supabase/migrations/MIGRATIONS.md` | Migration history | DevOps, QA |
| `README.md` | Quick start (this file) | Everyone |

---

## Key Metrics

**Database Size**: ~500 MB (production, as of 2026-04-03)  
**Tables**: 54 (with 3 materialized views)  
**Columns**: ~600 total across all tables  
**Migrations**: 46 (since project inception)  
**Users**: ~100-1000 range (scale design)  
**Snapshots**: 24-36 per client (monthly)  
**Daily Volume**: 
- Snapshots: 50-100 new
- Audit logs: 1000-5000
- Email events: 100-500
- Billing records: 50-200

---

## Troubleshooting

### Common Issues

**Q: "Column is encrypted, cannot read"**
- A: Use `email_hash` for profile lookups instead of email_encrypted
- Reference: SCHEMA.md → profiles section

**Q: "Permission denied for table X"**
- A: RLS policy blocking access. Check user role and client_id match
- Reference: SCHEMA.md → Security & Audit section

**Q: "Missing index on frequently queried column"**
- A: Add index in migration. See supabase/migrations/MIGRATIONS.md
- Common: `CREATE INDEX ON snapshots(client_id, ref_date)`

**Q: "Snapshot archive queries slow"**
- A: Use `snapshots_all` view (includes hot + archive)
- Reference: QUERY_GUIDE.md → Performance Tips

---

## Next Steps

1. **Review SCHEMA.md** for table structure & relationships
2. **Copy to your environment**:
   ```bash
   cp -r /Users/lucas/Desktop/muuney-hub/supabase ./
   ```
3. **Customize supabase/config.toml** for your region & settings
4. **Apply migrations** via `supabase migration push` or direct SQL
5. **Run queries** from QUERY_GUIDE.md to verify setup
6. **Configure Edge Functions** (email, auth, data ingestion)
7. **Set up cron jobs** for archival, billing, metrics

---

## Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **PostgreSQL**: https://www.postgresql.org/docs/15/
- **Project Context**: See CLAUDE.md for operational setup
- **Team**: Lucas (@lucaslpof) - Muuney CTO

---

**Generated**: 2026-04-03  
**Environment**: Production Database  
**Status**: Ready for Development & Backup

For questions or updates, reference the project issues or contact the team.
