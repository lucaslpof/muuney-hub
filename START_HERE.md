# Muuney Hub - Supabase Schema Export

## Welcome!

You've received a complete database schema export for the **muuney-hub** Supabase project.

This folder contains everything you need to:
- Understand the database architecture
- Set up a new development environment
- Recover from a disaster
- Onboard new team members
- Deploy to production

---

## Files Overview

### Essential Reading Order

#### 1. **README.md** (10 min read)
Start here for a quick overview.
- Project overview & context
- Directory structure
- Table domains & purpose
- Security & compliance notes
- Next steps

👉 **Read this first**

#### 2. **SCHEMA.md** (30 min read)
Comprehensive reference for all 54 tables.
- Complete table documentation
- Field descriptions & data types
- Foreign key relationships
- Encryption & security details
- Performance notes

👉 **Reference this when building**

#### 3. **supabase/QUERY_GUIDE.md** (reference)
SQL patterns for common tasks.
- User management queries
- Portfolio analytics
- Billing & payments
- Reports & compliance
- Marketing & leads
- Macro API data

👉 **Copy-paste when implementing**

---

## For Different Roles

### Product/Project Manager
1. Read: **README.md** (5 min)
2. Skim: **SCHEMA.md** → Core Platform section (5 min)
3. Reference: Table list in README

### Developer (Frontend/Backend)
1. Read: **README.md** (10 min)
2. Study: **SCHEMA.md** (30 min)
3. Learn: **QUERY_GUIDE.md** (15 min)
4. Bookmark: All three for reference

### Database Administrator
1. Read: **README.md** (10 min)
2. Deep dive: **SCHEMA.md** (60 min)
3. Study: **supabase/migrations/MIGRATIONS.md** (20 min)
4. Reference: **supabase/config.toml** for setup
5. Review: **EXPORT_REPORT.txt** for verification

### DevOps/Infrastructure
1. Read: **README.md** → Integration Points (5 min)
2. Review: **supabase/config.toml** (5 min)
3. Reference: Deployment section in README
4. Execute: Initial schema SQL per instructions

### Data Analyst
1. Read: **README.md** (5 min)
2. Reference: **QUERY_GUIDE.md** for patterns
3. Study: Portfolio & Financial section in SCHEMA.md

---

## Quick Start (5 minutes)

### For New Development Environment
```bash
# 1. Copy schema to your project
cp -r supabase/ /path/to/your/project/

# 2. Create Supabase project
# (via console or CLI: supabase init)

# 3. Apply migrations
supabase migration push

# 4. Verify
psql -h <host> -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
# Should show: 54 tables + 3 views
```

### For Understanding the Data Model
```bash
# 1. Open README.md in your editor
# 2. Jump to "Table Summary by Domain" section
# 3. Pick a domain that interests you
# 4. Jump to SCHEMA.md and read that section
# 5. Try a query from QUERY_GUIDE.md
```

---

## File Manifest

```
muuney-hub/
├── START_HERE.md (you are here)
├── README.md ......................... Overview & quick start
├── SCHEMA.md ......................... Complete reference
├── EXPORT_MANIFEST.md ............... Detailed manifest
├── EXPORT_REPORT.txt ................ Verification report
│
└── supabase/
    ├── config.toml .................. Configuration template
    ├── QUERY_GUIDE.md ............... SQL patterns
    │
    └── migrations/
        ├── 00000000000000_initial_schema.sql ... Full schema
        └── MIGRATIONS.md ............ Migration history
```

**Total Size**: ~78 KB of documentation + schema

---

## Key Facts

- **54 Tables** across 11 logical domains
- **46 Migrations** with full history (Feb-Apr 2026)
- **~600 Columns** with comprehensive documentation
- **PII Encrypted** with LGPD compliance
- **RLS Enabled** for access control
- **Production Ready** - verified & tested

---

## Common Tasks

### "I want to understand the database structure"
1. Read: README.md
2. Review: SCHEMA.md → Table Summary by Domain
3. Deep dive: Relevant section in SCHEMA.md

### "I need to set up a dev environment"
1. Copy: `supabase/` folder to your project
2. Run: `supabase migration push` (or direct SQL)
3. Verify: Table count matches documentation
4. Configure: API keys, Edge Functions, etc.

### "I need to write a query"
1. Find use case in QUERY_GUIDE.md
2. Copy query template
3. Customize with your parameters
4. Test on dev database first

### "I need to understand a specific table"
1. Use Ctrl+F to search SCHEMA.md
2. Read full table documentation
3. Check foreign key relationships
4. Review example queries in QUERY_GUIDE.md

### "I need to recover the database"
1. Review: SCHEMA.md → Data Lifecycle section
2. Run: `initial_schema.sql` on recovery environment
3. Restore: Data from backup
4. Verify: All tables and constraints

### "I'm onboarding a new team member"
1. Share: README.md
2. Provide: Access to SCHEMA.md
3. Teach: QUERY_GUIDE.md patterns
4. Reference: EXPORT_REPORT.txt for details

---

## Important Notes

### Security
- ✓ PII is encrypted (email, CPF, phone)
- ✓ Use email_hash for secure lookups
- ✓ RLS policies enforced on audit_logs
- ✓ All access logged to audit_logs

### Compliance
- ✓ LGPD: Consent records, PII encryption
- ✓ CVM: Suitability data, fee disclosures
- ✓ BACEN: Macro data integration
- ✓ Tax: Annual retention policies

### Performance
- ✓ Hot snapshots: Current + 12 months
- ✓ Archive snapshots: Auto-moved after 365 days
- ✓ Indexes optimized for common queries
- ✓ See QUERY_GUIDE.md → Performance Tips

---

## Support

### Documentation
- **Architecture**: README.md
- **Details**: SCHEMA.md
- **Queries**: QUERY_GUIDE.md
- **Config**: supabase/config.toml
- **Verification**: EXPORT_REPORT.txt

### External References
- Supabase: https://supabase.com/docs
- PostgreSQL: https://www.postgresql.org/docs/15/
- Project: Muuney Hub (Strategic Financial Management)

### Team
- CTO: Lucas (@lucaslpof)
- Engineering: Muuney Team

---

## Next Steps

### Right Now (5 min)
1. ✓ Read this file (you're here!)
2. → Read **README.md** next

### Next (15 min)
1. Read **README.md** completely
2. Bookmark **SCHEMA.md** and **QUERY_GUIDE.md**

### Later (when needed)
1. Reference specific table in SCHEMA.md
2. Copy query from QUERY_GUIDE.md
3. Deploy using config.toml

---

## Feedback & Updates

This export was generated on **2026-04-03** from the production Supabase database.

If you find:
- Missing tables or columns
- Incorrect documentation
- Out-of-date information
- Performance issues

Please report to the Muuney engineering team so we can keep this current.

---

## Ready?

👉 **Next: Open and read [README.md](README.md)**

It will take 10 minutes and give you a complete overview of the entire database structure.

---

Generated: 2026-04-03  
Muuney Hub - Database Schema Export v1.0  
Status: Production Ready
