# Stripe Setup Runbook — muuney.hub

**Owner:** Lucas · **Prazo:** pós-beta (não bloqueia launch 30/Abr — cobrança só após trial)
**Plano contratado:** Free + Pro · R$ 49/mês ou R$ 490/ano (2 meses grátis) · Trial 14 dias (hard trial, com cartão)

**Status atualização 21/Abr/2026 (D-9):** Passos 1-6 ✅ CONCLUÍDOS em Live mode. Passo 7 (smoke test E2E) em finalização — aguardando Lucas submeter cartão real no checkout atual (cs_live_b1JYO...). Ver `stripe-next-steps-post-smoke.md` para plano de finalização.

---

## Contexto

O stack Stripe no código (Edge Functions + `HubUpgrade.tsx`) está 100% implementado. O que falta é setup manual no Stripe Dashboard + configuração de secrets no Supabase. Este runbook cobre o path crítico do zero até smoke test end-to-end.

Decisões fechadas (21/Abr/2026):
- **Tiers:** Free + Pro (sem Starter/Team no launch)
- **Pricing:** R$ 49/mês · R$ 490/ano (desconto 17% = 2 meses grátis)
- **Trial:** 14 dias com cartão (hard trial) — só concedido a usuários nunca-Pro (`hub_user_tiers.pro_since IS NULL`)
- **Cobrança:** cartão (via Stripe) + Pix BR ativado no checkout
- **Promo codes:** habilitados no checkout (`allow_promotion_codes: true`)

---

## ✅ Passo 1 — Criar conta Stripe BR [CONCLUÍDO 21/Abr/2026]

1. Acesse https://dashboard.stripe.com/register
2. Escolha país: **Brasil**
3. Ative modo Live após validação (CPF/CNPJ + comprovante bancário)
4. Configure métodos de pagamento: Cartão (padrão) + Pix (Brazil → Payment methods → Enable Pix)
5. Moeda de cobrança: **BRL**

**Checkpoint:** Dashboard mostra "Live mode" no topo + Pix ativo em Settings → Payment methods.

---

**Status:** Conta BR Live ativa. Pix BR ainda **pendente aprovação Stripe** — launch 30/Abr só com cartão. Pix será ativado pós-launch quando Stripe BR liberar.

---

## ✅ Passo 2 — Criar Products + Prices [CONCLUÍDO 21/Abr/2026]

Navegue em https://dashboard.stripe.com/products → **Add product**.

### Produto 1 — Muuney Pro Mensal

- Name: `Muuney Pro Mensal`
- Description: `Acesso completo ao muuney.hub — inteligência de mercado, screener avançado, módulos deep FIDC/FII/FIP, insights automáticos.`
- Pricing:
  - Model: **Recurring**
  - Price: **R$ 49,00 BRL**
  - Billing period: **Monthly**
- **Copiar `price_id`** (formato `price_1Abc...`) → anotar como `STRIPE_PRICE_ID_MONTHLY`

### Produto 2 — Muuney Pro Anual

- Name: `Muuney Pro Anual`
- Description: `Muuney Pro com 2 meses grátis pagando anual.`
- Pricing:
  - Model: **Recurring**
  - Price: **R$ 490,00 BRL**
  - Billing period: **Yearly**
- **Copiar `price_id`** → anotar como `STRIPE_PRICE_ID_YEARLY`

**Checkpoint:** `https://dashboard.stripe.com/prices` mostra 2 prices ativos em BRL.

---

**Status:** 2 prices Live criados (Pro Mensal R$49 + Pro Anual R$490 em BRL). Price IDs persistidos em Supabase secrets `STRIPE_PRICE_ID_MONTHLY` e `STRIPE_PRICE_ID_YEARLY`.

---

## ✅ Passo 3 — Configurar Billing Portal [CONCLUÍDO 21/Abr/2026]

Navegue em https://dashboard.stripe.com/settings/billing/portal → **Activate test/live link**.

Configuração obrigatória (para `stripe-portal` Edge Function funcionar):
- ✅ **Customer information:** permitir atualizar nome, email, endereço, CPF/CNPJ
- ✅ **Payment methods:** permitir adicionar/remover
- ✅ **Invoices:** permitir download
- ✅ **Subscriptions — Cancel:** permitir cancelar (at period end)
- ✅ **Subscriptions — Update:** permitir trocar entre Pro Mensal ↔ Pro Anual (adicione os 2 prices na lista de allowed updates)
- ❌ **Pause:** desabilitar (não suportamos pause no código)

Branding: upload logo Muuney + primary color `#0B6C3E`.

**Checkpoint:** Page preview renderiza em pt-BR com logo + cor verde Muuney.

---

**Status:** Billing Portal Live configurado com cancel at period end, update plan (monthly↔yearly), invoice download, branding Muuney #0B6C3E.

---

## ✅ Passo 4 — Criar Webhook Endpoint [CONCLUÍDO 21/Abr/2026]

Navegue em https://dashboard.stripe.com/webhooks → **Add endpoint**.

- **URL:** `https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-webhook`
- **API version:** `2024-12-18.acacia` (deve casar com `apiVersion` no código)
- **Events to send** (selecionar exatos 5):
  1. `checkout.session.completed`
  2. `customer.subscription.created`
  3. `customer.subscription.updated`
  4. `customer.subscription.deleted`
  5. `invoice.payment_failed`

Após criar, clique no endpoint → **Reveal signing secret** → copie `whsec_...` → anotar como `STRIPE_WEBHOOK_SECRET`.

**Checkpoint:** Endpoint listado com status "Enabled" + 5 events configurados.

---

**Status:** Webhook endpoint Live Ativo: `https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-webhook`. 5 events configurados. Signing secret persistido como `STRIPE_WEBHOOK_SECRET` no Supabase. **Ainda sem delivery alguma** — Recent deliveries: 0 (aguardando primeiro payment real para validar).

---

## ✅ Passo 5 — Configurar Secrets no Supabase [CONCLUÍDO 21/Abr/2026]

Navegue em https://supabase.com/dashboard/project/yheopprbuimsunqfaqbp/settings/functions → **Add secret** (ou `supabase secrets set` via CLI).

Secrets obrigatórios:

| Nome | Valor | Origem |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (ou `sk_test_...` em staging) | Dashboard → API keys |
| `STRIPE_PRICE_ID_MONTHLY` | `price_1Abc...` | Passo 2 produto mensal |
| `STRIPE_PRICE_ID_YEARLY` | `price_1Xyz...` | Passo 2 produto anual |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Passo 4 |
| `SITE_URL` | `https://muuney.app` | Frontend hub domain |
| `STRIPE_TRIAL_DAYS` | `14` | Decisão 21/Abr |

**Nota SITE_URL:** o default no código é `https://hub.muuney.com.br`. Setamos explicitamente `https://muuney.app` para casar com o frontend atual.

**Checkpoint:** `supabase secrets list` mostra os 6 secrets.

---

**Status:** 6 secrets Live no Supabase (`STRIPE_SECRET_KEY` sk_live_, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL=https://muuney.app`, `STRIPE_TRIAL_DAYS=14`).

---

## ✅ Passo 6 — Deploy Edge Functions [CONCLUÍDO 21/Abr/2026 via MCP]

Deploy realizado via MCP Supabase (não via CLI, porque o script local não tinha Supabase CLI instalado):

```
mcp__supabase__deploy_edge_function stripe-checkout (verify_jwt=false) → v2 bdfbeb07-7fd5-4940-910a-7fb5c94644f3
mcp__supabase__deploy_edge_function stripe-portal   (verify_jwt=false) → v2 a39f09a8-4c7b-4a3a-9a9d-d208ab62f706
stripe-webhook                                      (verify_jwt=false) → já deployed em batch anterior
```

### ⚠️ ES256 JWT Fix (21/Abr/2026)

**Bug descoberto durante smoke test:** Supabase platform-level Edge Function JWT verifier rejeita tokens ES256 com:
```
{"code":"UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM","message":"Unsupported JWT algorithm ES256"}
```

**Root cause:** Supabase migrou auth keys para ES256 (antes eram HS256). Platform Edge Function verifier ainda não suporta ES256.

**Fix:** Redeploy `stripe-checkout` + `stripe-portal` com `verify_jwt=false`. As funções já validam tokens internamente via:
```ts
const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
```
usando `SUPABASE_SERVICE_ROLE_KEY`, então skip do platform verifier é seguro — o token continua sendo validado, só em camada diferente (aplicação vs plataforma).

**Nota:** `stripe-webhook` já usava `verify_jwt=false` desde o deploy inicial (Stripe assina via `stripe-signature` header, não via Supabase Auth).

**Checkpoint:** `mcp__supabase__list_edge_functions` mostra `stripe-checkout` (ACTIVE v2, verify_jwt=false), `stripe-portal` (ACTIVE v2, verify_jwt=false), `stripe-webhook` (ACTIVE, verify_jwt=false).

---

## 🟡 Passo 7 — Smoke Test End-to-End [EM FINALIZAÇÃO 21/Abr/2026]

**⚠️ Decisão operacional (21/Abr):** smoke test final executado DIRETO em Live mode (não em Test). Motivo: secrets já configurados em Live, Pix não disponível no Test Brasil, cartão test não valida Live pricing em BRL. Contingência: Lucas faz primeira cobrança com cartão próprio, cancela via Billing Portal e reembolsa no Dashboard após validação.

**Status atual:**
- ✅ Checkout Session create via Edge Function: 200 OK, customer Live `cus_UNPmTAi796OPeW` criado
- ✅ Billing Portal page renderiza config OK (aguardando primeiro customer com sub para teste full)
- ⚠️ Payment finalization pendente — Lucas abandonou primeira session sem submeter cartão. Nova session gerada: `cs_live_b1JYOnTlW9ts6YDx1jVW3xMaKH42a3cQtqFDqdbRr2kJzxMnjmZsSd0zHD`
- ⚠️ Webhook delivery ainda sem round-trip — Stripe Eventos: só `customer.created` (do API call); nenhum `checkout.session.completed` ainda

**Bugs corrigidos durante smoke test:**
| # | Sintoma | Causa | Fix |
|---|---------|-------|-----|
| 1 | Checkout retorna 401 UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM | Platform verifier rejeita ES256 | Redeploy com `verify_jwt=false` (ver Passo 6) |
| 2 | Checkout retorna 400 "No such price" | Secrets test mode vs Live mode mismatch | Lucas atualizou todos os secrets para Live |
| 3 | Checkout retorna 400 "No such customer: cus_UNPVS1XND11iVA" | Customer Test mode stale em DB | `UPDATE hub_user_tiers SET stripe_customer_id=NULL...` para user test → nova sessão recriou customer Live |

⚠️ Seção original abaixo mantida para referência do fluxo esperado. Resultado REAL em `stripe-next-steps-post-smoke.md`.

### 7.1 — Checkout flow

1. Login em `https://muuney.app/login` com usuário free (ex: criar `test@muuney.app` como tier=free)
2. Navegar para `/upgrade`
3. Clicar em "Começar 14 dias grátis"
4. Ser redirecionado para `checkout.stripe.com`
5. Inserir cartão de teste: `4242 4242 4242 4242` · qualquer data futura · qualquer CVC · qualquer CEP
6. Confirmar → redireciona para `/upgrade?status=success&session_id=...`

**Checkpoint esperado:**
- Banner verde "Pagamento processado..." aparece
- Após ~5-30s, `refreshTier()` retorna tier=pro + badge "Você já é Pro ✓"
- Trial countdown visível ("14 dias restantes")
- Supabase query: `select * from hub_user_tiers where user_id = '...'` mostra `tier=pro`, `subscription_status=trialing`, `trial_ends_at` ≈ now + 14d

### 7.2 — Webhook delivery

Dashboard → Webhooks → endpoint → **Recent deliveries**:
- `checkout.session.completed` → 200 OK
- `customer.subscription.created` → 200 OK
- (posteriormente) `customer.subscription.updated` → 200 OK (quando Stripe confirma trial)

Qualquer 4xx/5xx → checar logs em `supabase functions logs stripe-webhook`.

### 7.3 — Billing Portal

1. Em `/upgrade` clicar "Gerenciar assinatura"
2. Ser redirecionado para `billing.stripe.com`
3. Verificar: lista de invoices, métodos de pagamento, opção cancel
4. Clicar "Cancel plan" → voltar para `/upgrade`

**Checkpoint esperado:**
- Webhook dispara `customer.subscription.updated` com `cancel_at_period_end=true`
- `/upgrade` mostra banner amber "Sua assinatura foi cancelada e seu acesso Pro vai até [data]"

### 7.4 — Trial expiration (simulado)

Stripe Dashboard → Customers → selecionar test customer → Subscriptions → **Advance to end of trial** (test mode only).

**Checkpoint esperado:**
- Se cartão test `4242` → cobra R$ 49 com sucesso → `invoice.payment_succeeded` → tier continua Pro
- Se cartão test `4000 0000 0000 0341` (declinado) → `invoice.payment_failed` → tier vira free + `subscription_status=past_due`

---

## Passo 8 — Promoção de Test → Live

Após 7.1-7.4 verdes em Test mode:

1. Criar prices em **Live mode** (Passo 2 repetido em produção)
2. Criar webhook em Live mode (Passo 4 repetido, copiar novo `whsec_` de live)
3. Atualizar secrets Supabase com valores live (`sk_live_`, `price_...` live, `whsec_` live)
4. Re-deploy Edge Functions (não precisa, já pegam env atualizado)
5. Smoke test completo em Live com cartão real próprio (Lucas) ou Apple Pay

**Checkpoint final:** 1 assinatura real Pro ativa no Stripe (Lucas) + tier=pro em `hub_user_tiers` + invoice paga.

---

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| Checkout retorna 500 "Stripe env vars not configured" | Secret faltante/typo | `supabase secrets list` + reconferir nomes |
| Webhook retorna 400 "Signature verification failed" | `STRIPE_WEBHOOK_SECRET` errado (confundido test/live) | Copiar signing secret do endpoint correto |
| Tier não atualiza pós-checkout | Webhook não disparou ou `supabase_user_id` faltou na metadata | Checar `stripe-webhook` logs + verificar que `metadata.supabase_user_id` aparece no Stripe event |
| Portal retorna 404 "No Stripe customer" | User nunca passou por checkout | Esperado — precisa fazer checkout primeiro |
| Trial não aplicado | `STRIPE_TRIAL_DAYS` ausente ou `pro_since IS NOT NULL` | Setar secret + conferir que é first-time subscriber |
| Cobrança em moeda errada | Produto criado em USD em vez de BRL | Recriar produto em BRL (não dá pra trocar moeda de price existente) |

---

## Checklist final (tick antes de anunciar cobrança)

- [ ] Conta Stripe BR ativa em Live mode
- [ ] 2 products + 2 prices criados em BRL (mensal R$49 + anual R$490)
- [ ] Pix ativado em Payment methods
- [ ] Billing Portal configurado (cancel + update + invoice download)
- [ ] Webhook endpoint Live criado com 5 events + signing secret copiado
- [ ] 6 secrets no Supabase (inclui `STRIPE_TRIAL_DAYS=14` + `SITE_URL=https://muuney.app`)
- [ ] Edge Functions `stripe-checkout`, `stripe-portal`, `stripe-webhook` deployed (último com `--no-verify-jwt`)
- [ ] Smoke test 7.1 (checkout) verde em Test mode
- [ ] Smoke test 7.2 (webhook 200s) verde
- [ ] Smoke test 7.3 (portal cancel) verde
- [ ] Smoke test 7.4 (trial expiration) verde
- [ ] Smoke test Live com cartão real próprio verde
- [ ] Atualizar CLAUDE.md + DECISIONS-LOG com "Stripe live ativo em [data]"
