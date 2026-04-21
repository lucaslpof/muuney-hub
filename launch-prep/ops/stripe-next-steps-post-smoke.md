# Stripe — Próximos Passos Pós-Smoke Test

**Contexto:** Stripe Live ativado e Edge Functions redeployadas com `verify_jwt=false` (fix ES256 JWT). Smoke test E2E iniciado em 21/Abr/2026 (D-9 launch) mas não finalizado — Lucas fechou checkout session sem submeter cartão. Nenhum evento `checkout.session.completed` foi registrado no Stripe Dashboard.

**Status global:** 🟡 Em finalização. Infra pronta, falta 1 validação end-to-end real.

---

## Bloco A — Finalizar smoke test (BLOQUEIO CRÍTICO antes do launch)

Sem este bloco concluído, não há garantia de que webhook firing + tier upgrade + portal funcionam em Live. **Não lançar 30/Abr sem validar**.

### A.1 Gerar nova checkout session Live

```bash
# Via browser console em muuney.app logado como admin (lucas.lpof@gmail.com)
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-checkout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ plan: 'monthly' })
});
const { url } = await res.json();
window.open(url, '_blank');
```

**Expectativa:** abre Stripe Checkout em nova aba com `cs_live_...` URL, plano R$ 49/mês, trial 14 dias.

### A.2 Submeter cartão real

Durante o beta, Lucas usa cartão corporativo próprio para validação. Após smoke test, **cancelar subscription imediatamente** via Billing Portal para evitar cobrança.

- Cartão: real (BR ou internacional — Stripe Live aceita ambos)
- Pix: ❌ não disponível ainda (aguardando aprovação Stripe BR)
- Valor: R$ 49,00 será exibido mas **não cobrado agora** (trial 14d — primeira cobrança em 05/Mai/2026 se não cancelado)

### A.3 Validar sequência de webhooks

No Stripe Dashboard → Workbench → **Webhooks → selecionar endpoint → Recent deliveries**, esperar ver na ordem:

1. `customer.created` (já existe da rodada anterior)
2. `checkout.session.completed` → payload com `subscription_data.metadata.supabase_user_id`
3. `customer.subscription.created` → status `trialing`

Cada evento deve mostrar **HTTP 200** no response. Se 4xx/5xx, investigar logs Edge Function.

### A.4 Validar upgrade tier + customer/subscription persistidos

```sql
-- Via MCP execute_sql ou Supabase SQL Editor
SELECT
  user_id,
  tier,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_status,
  current_period_end,
  pro_since
FROM hub_user_tiers
WHERE user_id = '3b1d8d96-d68b-40b9-b67e-e29873d621ae';
```

**Expectativa:**
- `tier = 'pro'`
- `stripe_customer_id = 'cus_UNP...'` (novo, ou reuso do existente)
- `stripe_subscription_id = 'sub_...'`
- `subscription_status = 'trialing'`
- `current_period_end` ≈ 05/Mai/2026 (14 dias a partir de hoje)
- `pro_since` ≈ now() (primeiro upgrade Pro via Stripe)

### A.5 Validar Billing Portal

No app muuney.app logado:

1. Navegar para `/upgrade` ou `/settings/billing`
2. Clicar em "Gerenciar Assinatura"
3. Confirma redirect para `billing.stripe.com/...` com branding Muuney (#0B6C3E)
4. Testar **Cancel at period end** → volta para app → validar DB:

```sql
SELECT subscription_status, tier FROM hub_user_tiers
WHERE user_id = '3b1d8d96-d68b-40b9-b67e-e29873d621ae';
-- Expectativa: subscription_status='trialing' ainda (não cancela imediatamente), tier='pro'
-- Após D+14 sem reverter: webhook subscription.deleted → tier='free'
```

### A.6 Cleanup pós-validação

Se for validar e não usar a assinatura de verdade:

```sql
-- NÃO FAZER durante smoke test, só depois de validado
-- Stripe Dashboard → Customers → cus_UNP... → Cancel subscription immediately
-- Depois:
UPDATE hub_user_tiers
SET tier = 'admin',  -- Lucas volta para admin
    stripe_customer_id = NULL,
    stripe_subscription_id = NULL,
    subscription_status = NULL,
    current_period_end = NULL
WHERE user_id = '3b1d8d96-d68b-40b9-b67e-e29873d621ae';
```

**Tempo estimado total Bloco A:** 15-25 min (checkout + 5 validações + cleanup).

---

## Bloco B — Polish pré-launch (26-30/Abr)

### B.1 Pix BR — escalar aprovação Stripe

Status: payment method solicitado no Passo 1 mas ainda pendente aprovação. Sem Pix, conversão BR cai ~30-40% (dados de outros fintechs BR).

**Ação:** email Stripe Support (`support@stripe.com`) anexando:
- CNPJ Muuney ativo + CNAE compatível
- Case de uso (SaaS fintech, PFM/mercado financeiro)
- Volume estimado (50 signups beta + projeção 500 Mês 1)
- Pedir priority approval dado timeline 30/Abr launch

**Fallback se negado/demora:** lançar só com cartão, adicionar Pix pós-launch (Mês 2).

### B.2 Páginas legais (Termos / Privacidade)

Billing Portal exige links para Terms of Service + Privacy Policy (Stripe mostra no footer do portal).

**Status atual:**
- `/termos` — existe? ❓ verificar
- `/privacidade` — existe? ❓ verificar

**Ação:** validar se páginas existem e têm texto jurídico adequado LGPD + CVM. Se não, usar template + revisão rápida por advogado LPA.

### B.3 Email transacional Stripe → reforçar branding

Stripe envia emails automáticos (receipt, trial ending, payment failed). Customizar:

- Dashboard → Settings → Emails
- Upload logo Muuney (#0B6C3E)
- From address: `billing@muuney.com.br` (se não, usa `billing@stripe.com` default)
- Review wording pt-BR (Stripe auto-traduz mas reler)

### B.4 Monitoring produção

- Adicionar Sentry ou LogRocket nas Edge Functions stripe-checkout/stripe-portal/stripe-webhook
- Dashboard Stripe Sigma query: taxa de conversão trial → paid (acompanhar D+14 dos primeiros signups)
- Slack webhook para falhas 5xx em webhooks (via `get_logs` MCP ou alert custom)

---

## Bloco C — Pós-launch (Mês 1+)

### C.1 Ativar cobrança dos beta testers (D+30 = 30/Mai)

Beta testers atuais (Pedro + futuros 9) estão com `tier='pro'` manual (sem Stripe). Política definida:

- **Opção 1 (recomendada):** Beta gratuito até 30/Jun (2 meses), depois migrar para Pro pago com desconto 50% primeiros 3 meses
- **Opção 2:** Cobrar desde 01/Mai mas conceder cupom 3 meses grátis via Stripe Coupons
- **Decisão pendente:** alinhar com Pedro + outros beta testers no Q&A de 29/Abr

### C.2 Webhook resilience

Atualmente webhook Edge Function não tem retry explícito se Supabase DB estiver indisponível. Stripe reenvia após timeout mas:

- Adicionar idempotency key check em hub_user_tiers (evitar double-processing)
- Dead letter queue para eventos que falharam 3x
- Alert via Slack quando webhook 5xx > 5% em 1h

### C.3 Pricing experimentation

Pós-launch, rodar A/B test:
- R$ 49/mês vs R$ 39/mês (elasticidade)
- Trial 14d vs 7d (conversion rate)
- Anual com desconto 17% (R$ 490) vs 25% (R$ 441)

Canal: Supabase feature flag + Stripe Coupons variantes.

### C.4 Referral program

Após primeiras 100 assinaturas pagas:
- Cupom "AMIGO50" via Stripe Coupons
- Advocate → 1 mês grátis; Referred → 50% primeiro mês
- Tracking via `metadata.referred_by` em Checkout Session

---

## Bloco D — Débito técnico identificado

### D.1 ES256 JWT permanente (verify_jwt=false)

**Decisão atual:** Edge Functions stripe-checkout/stripe-portal validam JWT internamente via `supabase.auth.getUser(jwt)` com SERVICE_ROLE_KEY. Funciona, mas:

- Performance: 1 round-trip extra para Supabase Auth por request
- Superfície de ataque maior (qualquer um pode chamar endpoint, rate limiting é responsabilidade da Edge Function)

**Opções futuras:**
- Aguardar Supabase adicionar suporte ES256 no verifier platform (tracking issue: ?)
- Migrar auth keys de volta para HS256 (não recomendado — ES256 é mais seguro)
- Implementar rate limiting via Upstash Redis ou Cloudflare no front-layer

**Prioridade:** P3, pós-launch, após volume > 1K requests/min.

### D.2 Smoke test automation

Atualmente smoke test é manual (Lucas testa navegando). Idealmente:

- Playwright test em CI/CD que executa fluxo checkout → webhook → tier upgrade
- Stripe Test mode exclusivo para CI (não Live)
- Run semanal + antes de cada deploy stripe-* function

**Ferramenta sugerida:** Playwright + Supabase Test DB branch + Stripe CLI `stripe listen --forward-to localhost:54321`.

---

## Referências cruzadas

- `launch-prep/ops/stripe-setup-runbook.md` — passos 1-7 (infra completa)
- `launch-prep/DECISIONS-LOG.md` — entry #1.5 (Stripe Live ativação + ES256 fix)
- `/sessions/adoring-upbeat-ritchie/mnt/.claude/CLAUDE.md` — seção "Stripe Live Integration"
- Notion "🔴 [PRE-LAUNCH] Stripe/Pagamentos Setup" (335b77f9-3886-81d2-94c3-e1f62c89da13)

---

**Última atualização:** 21/Abr/2026 (D-9 launch), Lucas/Claude session.
