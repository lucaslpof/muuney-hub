# Supabase Query Guide - Muuney Hub

Quick reference for common database queries on the muuney-hub project.

---

## User Management

### Get user profile with client metadata
```sql
SELECT 
  p.id, p.client_id, p.full_name, p.email, p.role,
  p.account_xp, p.account_btg, p.advisor,
  cm.fee_anual, cm.status, cm.stripe_customer_id,
  p.lgpd_consent, p.lgpd_consent_at,
  p.onboarding_done, p.totp_enabled
FROM profiles p
LEFT JOIN clients_meta cm ON p.client_id = cm.client_id
WHERE p.id = '<user_id>';
```

### Find user by email (with hash)
```sql
SELECT * FROM profiles 
WHERE email_hash = encode(digest('<email>', 'sha256'), 'hex')
LIMIT 1;
```

### List active clients with recent activity
```sql
SELECT 
  p.client_id, p.full_name, p.email, 
  cm.fee_anual, cm.status,
  MAX(cp.created_at) as last_activity
FROM profiles p
LEFT JOIN clients_meta cm ON p.client_id = cm.client_id
LEFT JOIN crm_pipeline cp ON p.client_id = cp.client_id
WHERE p.active = true
GROUP BY p.id, p.client_id, cm.fee_anual, cm.status
ORDER BY last_activity DESC;
```

---

## Portfolio Queries

### Get latest portfolio snapshot for a client
```sql
SELECT *
FROM latest_snapshots
WHERE client_id = '<client_id>';
```

### Get portfolio performance over time
```sql
SELECT 
  period, ref_date, 
  patrimonio_total, 
  ret_month, ret_12m, pct_cdi_12m,
  allocation,
  created_by
FROM snapshots
WHERE client_id = '<client_id>'
ORDER BY ref_date DESC
LIMIT 24; -- Last 2 years
```

### Compare current vs target allocation
```sql
SELECT 
  s.allocation::jsonb as current_allocation,
  jsonb_object_agg(ta.classe, ta.target_pct) as target_allocation,
  jsonb_object_agg(ta.classe, ta.tolerance) as tolerance
FROM snapshots s
CROSS JOIN target_allocations ta
WHERE s.client_id = '<client_id>'
  AND s.id = (SELECT id FROM snapshots WHERE client_id = '<client_id>' ORDER BY ref_date DESC LIMIT 1)
  AND ta.client_id = '<client_id>'
GROUP BY s.allocation;
```

### Get asset positions across brokers
```sql
SELECT 
  s.period,
  jsonb_each_text(s.assets_xp) as xp_assets,
  jsonb_each_text(s.assets_btg) as btg_assets,
  jsonb_each_text(s.assets_inter) as inter_assets,
  jsonb_each_text(s.positions_avenue) as avenue_assets
FROM snapshots s
WHERE s.client_id = '<client_id>'
  AND s.ref_date = CURRENT_DATE;
```

---

## Billing & Payments

### Get open invoices
```sql
SELECT 
  id, client_id, ref_mes, valor, status,
  vencimento, stripe_invoice_id, payment_url
FROM cobrancas
WHERE client_id = '<client_id>'
  AND status IN ('Pendente', 'Vencido')
  AND deleted_at IS NULL
ORDER BY vencimento ASC;
```

### Monthly billing summary
```sql
SELECT 
  DATE_TRUNC('month', created_at) as mes,
  COUNT(*) as total_invoices,
  SUM(valor) as total_valor,
  COUNT(CASE WHEN status = 'Pago' THEN 1 END) as paid,
  COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pending
FROM cobrancas
WHERE client_id = '<client_id>'
  AND deleted_at IS NULL
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mes DESC;
```

### Track payment transactions
```sql
SELECT 
  c.ref_mes, c.valor,
  pt.provider, pt.status, pt.amount_cents,
  pt.created_at, pt.updated_at
FROM payment_transactions pt
JOIN cobrancas c ON pt.cobranca_id = c.id
WHERE c.client_id = '<client_id>'
ORDER BY pt.created_at DESC;
```

### Fee disclosure report (CVM)
```sql
SELECT 
  year, quarter, fee_type,
  COUNT(*) as num_clients,
  SUM(amount) as total_fees,
  AVG(amount) as avg_fee
FROM fee_disclosures
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY year, quarter, fee_type
ORDER BY year, quarter, fee_type;
```

---

## Reports & Compliance

### Scheduled reports due today
```sql
SELECT 
  id, client_id, report_type, frequency,
  next_scheduled_at,
  CASE WHEN next_scheduled_at <= NOW() THEN 'READY' ELSE 'PENDING' END as status
FROM report_schedules
WHERE is_active = true
  AND next_scheduled_at <= NOW() + INTERVAL '1 hour'
ORDER BY next_scheduled_at ASC;
```

### Tax report summary by client
```sql
SELECT 
  client_id, 
  ano_exercicio,
  COUNT(*) as num_reports,
  SUM((data->>'rendimentos_tributaveis')::numeric) as total_income,
  SUM((data->>'ir_retido')::numeric) as total_tax_withheld
FROM tax_reports
GROUP BY client_id, ano_exercicio
ORDER BY client_id, ano_exercicio DESC;
```

### Report delivery tracking
```sql
SELECT 
  rs.report_type, rs.frequency,
  COUNT(rd.*) as total_sent,
  COUNT(CASE WHEN rd.opened_at IS NOT NULL THEN 1 END) as opened,
  ROUND(100.0 * COUNT(CASE WHEN rd.opened_at IS NOT NULL THEN 1 END) / COUNT(rd.*), 2) as open_rate
FROM report_schedules rs
LEFT JOIN report_deliveries rd ON rs.id = rd.schedule_id
WHERE rd.created_at > CURRENT_DATE - INTERVAL '90 days'
GROUP BY rs.report_type, rs.frequency;
```

---

## Marketing & Leads

### Hub leads conversion funnel
```sql
SELECT 
  source,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN email_completed = true THEN 1 END) as email_completed,
  ROUND(100.0 * COUNT(CASE WHEN email_completed = true THEN 1 END) / COUNT(*), 2) as completion_rate
FROM hub_leads
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY source, status
ORDER BY source, status;
```

### Newsletter unsubscribe rate
```sql
SELECT 
  source,
  COUNT(*) as subscribers,
  COUNT(CASE WHEN unsubscribed = true THEN 1 END) as unsubscribed,
  ROUND(100.0 * COUNT(CASE WHEN unsubscribed = true THEN 1 END) / COUNT(*), 2) as unsubscribe_rate
FROM newsletter_subscribers
WHERE created_at > CURRENT_DATE - INTERVAL '90 days'
GROUP BY source;
```

### Blog content performance
```sql
SELECT 
  id, slug, title, category,
  is_published, published_at,
  read_time_minutes,
  created_at
FROM blog_posts
WHERE is_published = true
ORDER BY published_at DESC
LIMIT 20;
```

---

## Macro Data (Hub API)

### Latest economic indicators
```sql
SELECT 
  m.serie_code, m.serie_name, m.category,
  m.value, m.unit, m.date,
  m.fetched_at
FROM hub_macro_series m
INNER JOIN hub_macro_series_meta meta 
  ON m.serie_code = meta.serie_code AND meta.is_active = true
WHERE m.date = (
  SELECT MAX(date) FROM hub_macro_series WHERE serie_code = m.serie_code
)
ORDER BY m.category, m.serie_name;
```

### Time series for dashboard (last 12 months)
```sql
SELECT 
  date, value, unit
FROM hub_macro_series
WHERE serie_code = 432 -- CDI
  AND date >= CURRENT_DATE - INTERVAL '365 days'
ORDER BY date ASC;
```

### Data ingestion health check
```sql
SELECT 
  module, 
  COUNT(*) as total_runs,
  COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  MAX(completed_at) as last_run,
  CASE WHEN MAX(completed_at) > NOW() - INTERVAL '24 hours' THEN 'OK' ELSE 'STALE' END as health
FROM hub_data_ingestion_log
WHERE completed_at > NOW() - INTERVAL '30 days'
GROUP BY module
ORDER BY max(completed_at) DESC;
```

---

## Audit & Security

### User activity log
```sql
SELECT 
  created_at, action, category, severity,
  user_email, client_id,
  details, ip_address
FROM audit_logs
WHERE user_id = '<user_id>'
  AND created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;
```

### Suspicious activity (failed logins, etc.)
```sql
SELECT 
  user_email, ip_address,
  COUNT(*) as attempts,
  MAX(created_at) as latest
FROM audit_logs
WHERE category = 'auth'
  AND severity IN ('warning', 'error')
  AND created_at > CURRENT_DATE - INTERVAL '24 hours'
GROUP BY user_email, ip_address
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

### Consent changes (LGPD)
```sql
SELECT 
  cr.user_id, p.email, p.full_name,
  cr.consent_type, cr.granted,
  cr.granted_at, cr.revoked_at,
  cr.ip_address
FROM consent_records cr
JOIN profiles p ON cr.user_id = p.id
WHERE cr.created_at > CURRENT_DATE - INTERVAL '30 days'
ORDER BY cr.created_at DESC;
```

### Rate limiting abuse check
```sql
SELECT 
  key, endpoint,
  COUNT(*) as requests,
  MAX(window_start) as latest_window
FROM rate_limits
WHERE window_start > NOW() - INTERVAL '1 hour'
GROUP BY key, endpoint
HAVING COUNT(*) > 100
ORDER BY requests DESC;
```

---

## System Monitoring

### Latest system metrics
```sql
SELECT 
  metric_name,
  metric_value,
  recorded_at
FROM latest_metrics
ORDER BY recorded_at DESC;
```

### 2FA adoption
```sql
SELECT 
  COUNT(DISTINCT id) as total_users,
  COUNT(DISTINCT CASE WHEN totp_enabled = true THEN id END) as with_2fa,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN totp_enabled = true THEN id END) / COUNT(DISTINCT id), 2) as adoption_rate
FROM profiles
WHERE active = true;
```

### Profile completion rate
```sql
SELECT 
  COUNT(DISTINCT id) as total,
  COUNT(DISTINCT CASE WHEN onboarding_done = true THEN id END) as completed,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN onboarding_done = true THEN id END) / COUNT(DISTINCT id), 2) as completion_rate
FROM profiles;
```

---

## RLS (Row-Level Security) Queries

### Check if user can access client data (RLS policy)
```sql
-- This is enforced by Supabase RLS; no special query needed
-- RLS policies restrict data based on:
-- - User role (admin | advisor | client)
-- - User's client_id match
-- - Advisor/sub-advisor relationship

-- To test RLS in dev:
SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"<user_uuid>","role":"client","client_id":"<client_id>"}';

SELECT * FROM profiles WHERE client_id = '<client_id>';
-- Returns only if RLS policy allows
```

---

## Performance Tips

1. **Always use `latest_snapshots`** for current portfolio data (materialized view)
2. **Use `snapshots_all`** for historical analysis (includes archive tier)
3. **Filter by `client_id` first** to leverage indexes
4. **Use `email_hash`** instead of plaintext email for security
5. **Batch date-range queries** with `created_at > NOW() - INTERVAL '<days> days'`
6. **Archive old audit logs** monthly (cron job handles this)
7. **Use EXPLAIN ANALYZE** to check query plans before production

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `permission denied` | RLS policy blocked | Check role & client_id match |
| `column is encrypted` | Accessing bytea field | Use email_hash instead of encrypted version |
| `connection timeout` | Pool exhausted | Reduce connection count in app |
| `out of memory` | Large JSONB in snapshots | Use `jsonb_extract_path()` instead of full select |

---

**Last Updated**: 2026-04-03  
**Project**: muuney-hub (yheopprbuimsunqfaqbp)
