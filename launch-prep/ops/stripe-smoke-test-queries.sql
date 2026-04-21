-- Stripe Smoke Test Queries
-- Para rodar em https://supabase.com/dashboard/project/yheopprbuimsunqfaqbp/sql/new
-- durante/após smoke test end-to-end do checkout.

-- =====================================================================
-- 1. ANTES do checkout — verificar tier atual de um user free
-- =====================================================================
-- Substitua o email pelo user que vai testar (ex: Lucas admin ou criar test@muuney.app free)
SELECT
  u.email,
  u.id as user_id,
  t.tier,
  t.pro_since,
  t.stripe_customer_id,
  t.stripe_subscription_id,
  t.subscription_status,
  t.trial_ends_at,
  t.cancel_at_period_end
FROM auth.users u
LEFT JOIN hub_user_tiers t ON t.user_id = u.id
WHERE u.email = 'lucas.lpof@gmail.com';  -- ajuste aqui
-- Esperado pré-checkout: tier=admin (Lucas) OU tier=free + pro_since=null (test user)

-- =====================================================================
-- 2. DEPOIS do checkout bem-sucedido — validar estado
-- =====================================================================
-- Mesma query. Pós-checkout deve mostrar:
--   tier = 'pro'
--   stripe_customer_id = 'cus_...'
--   stripe_subscription_id = 'sub_...'
--   subscription_status = 'trialing' (se trial ativo) OU 'active'
--   trial_ends_at = now() + 14 dias (se trial)
--   cancel_at_period_end = false
--   plan = 'monthly' ou 'yearly'

-- =====================================================================
-- 3. MONITORAR — últimas transições de tier (debug webhook)
-- =====================================================================
SELECT
  t.user_id,
  u.email,
  t.tier,
  t.plan,
  t.subscription_status,
  t.trial_ends_at,
  t.current_period_end,
  t.cancel_at_period_end,
  t.updated_at
FROM hub_user_tiers t
JOIN auth.users u ON u.id = t.user_id
WHERE t.stripe_customer_id IS NOT NULL
ORDER BY t.updated_at DESC
LIMIT 20;

-- =====================================================================
-- 4. Contagem por tier — acompanhar conversão
-- =====================================================================
SELECT
  tier,
  COUNT(*) as users,
  COUNT(*) FILTER (WHERE subscription_status = 'trialing') as in_trial,
  COUNT(*) FILTER (WHERE subscription_status = 'active') as paying,
  COUNT(*) FILTER (WHERE cancel_at_period_end = true) as cancelling,
  COUNT(*) FILTER (WHERE subscription_status = 'past_due') as payment_failed
FROM hub_user_tiers
GROUP BY tier
ORDER BY tier;

-- =====================================================================
-- 5. Trial funnel — quem está em trial e quando expira
-- =====================================================================
SELECT
  u.email,
  t.plan,
  t.trial_started_at,
  t.trial_ends_at,
  EXTRACT(DAY FROM (t.trial_ends_at - NOW())) as days_left,
  t.subscription_status
FROM hub_user_tiers t
JOIN auth.users u ON u.id = t.user_id
WHERE t.subscription_status = 'trialing'
ORDER BY t.trial_ends_at ASC;

-- =====================================================================
-- 6. Debug — caso webhook não atualize, verificar Edge Function logs
-- =====================================================================
-- Supabase Dashboard → Edge Functions → stripe-webhook → Logs
-- Procurar por:
--   "Upgraded user <uuid> to pro (customer cus_...)"  ← checkout.session.completed OK
--   "Subscription sub_... → trialing (tier=pro, plan=monthly)"  ← subscription.updated OK
--   "Signature verification failed"  ← whsec errado
--   "setTierForCustomer: no hub_user_tiers row matched"  ← customer orphan (rare)

-- =====================================================================
-- 7. Rollback de emergência — demover user de volta a free (se algo der errado)
-- =====================================================================
-- ATENÇÃO: só rodar se precisar reverter manualmente.
-- UPDATE hub_user_tiers
-- SET tier = 'free',
--     subscription_status = 'canceled',
--     updated_at = NOW()
-- WHERE user_id = '<uuid>';

-- =====================================================================
-- 8. Verificar secrets do Stripe chegaram na Edge Function (indireto)
-- =====================================================================
-- Não dá pra ler secrets via SQL. Para validar, chamar o endpoint com JWT
-- real e ver se retorna sessionId (OK) ou "Stripe env vars not configured" (faltam secrets).
-- Lucas roda no browser console logado:
/*
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'monthly' })
});
console.log(res.status, await res.json());
// Esperado: 200 { url: "https://checkout.stripe.com/c/pay/cs_test_...", sessionId: "cs_test_..." }
*/
