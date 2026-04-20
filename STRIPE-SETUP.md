# Stripe Setup — muuney.hub

Guia operacional para ativar checkout de assinatura Pro em produção.
Código está pronto (stripe-checkout, stripe-webhook, stripe-portal). Este doc cobre **apenas o setup manual** no Stripe Dashboard + Supabase.

**Pré-requisitos:** CNPJ da PJ (FLUXX CASH TECNOLOGIA LTDA), conta bancária PJ, cartão para validação do payout.

---

## 1. Criar conta Stripe (Brasil)

1. Acesse https://dashboard.stripe.com/register
2. Selecione país = **Brasil** (obrigatório para suportar Pix + Boleto nativos)
3. Email de admin = `contato@muuney.com.br` (não use Gmail pessoal)
4. Complete verificação PJ: CNPJ, endereço, atividade econômica, dados bancários PJ
5. Aguarde aprovação (1–3 dias úteis)

Durante o período de aprovação, use **modo de teste** (`sk_test_...`) para dev.

---

## 2. Criar produtos + preços

Dashboard → Products → **Add product**.

### Produto 1: Muuney Pro Mensal

- Nome: `Muuney Pro Mensal`
- Descrição: `muuney.hub Pro — acesso ilimitado (mensal)`
- Preço: `R$ 49,00 BRL` · recorrente · mensal
- Save → copiar **price_id** (formato `price_...`)

### Produto 2: Muuney Pro Anual

- Nome: `Muuney Pro Anual`
- Descrição: `muuney.hub Pro — acesso ilimitado (anual, 2 meses grátis)`
- Preço: `R$ 490,00 BRL` · recorrente · anual
- Save → copiar **price_id**

---

## 3. Habilitar Customer Portal

Dashboard → Settings → Billing → **Customer portal**.

1. Enable portal
2. Allowed actions: `Cancel subscriptions`, `Update payment method`, `Update subscription` (permite troca mensal↔anual), `View invoice history`, `Update billing details`
3. Cancellation behavior: `Cancel at period end` (padrão, evita reembolso)
4. Save

Sem isso, `stripe-portal` Edge Function retorna 500.

---

## 4. Configurar webhook

Dashboard → Developers → Webhooks → **Add endpoint**.

- Endpoint URL: `https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/stripe-webhook`
- Events to send (exatamente estes 5):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Save → clicar na endpoint recém-criada → **Signing secret** → `Reveal` → copiar (formato `whsec_...`)

---

## 5. Configurar secrets no Supabase

Project `yheopprbuimsunqfaqbp` → Edge Functions → **Manage secrets**.

Adicionar (valores copiados dos passos 1, 2, 4):

| Key | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (ou `sk_test_...` para testes) |
| `STRIPE_PRICE_ID_MONTHLY` | `price_...` do produto mensal |
| `STRIPE_PRICE_ID_YEARLY` | `price_...` do produto anual |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` do webhook |
| `SITE_URL` | `https://hub.muuney.com.br` |
| `STRIPE_TRIAL_DAYS` *(opcional)* | `14` para habilitar trial de 14 dias. `0` ou ausente desabilita. Apenas para usuários que nunca foram Pro (checa `hub_user_tiers.pro_since IS NULL`). |

---

## 6. Deploy das Edge Functions

Da raiz do repo (`/sessions/determined-blissful-mendel/mnt/muuney-hub`):

```bash
# checkout + portal precisam de JWT do usuário (verify_jwt = true, default)
supabase functions deploy stripe-checkout
supabase functions deploy stripe-portal

# webhook recebe POST assinado pela Stripe — sem JWT
supabase functions deploy stripe-webhook --no-verify-jwt
```

Verificar deploy:

```bash
supabase functions list
# Deve listar stripe-checkout, stripe-webhook, stripe-portal como ACTIVE
```

---

## 7. Teste end-to-end (modo teste)

1. Usar `STRIPE_SECRET_KEY=sk_test_...` e price_ids do modo teste
2. Acessar `https://hub.muuney.com.br/upgrade` logado
3. Clicar "Assinar mensal" → redireciona para Stripe Checkout
4. Usar cartão de teste: `4242 4242 4242 4242`, qualquer CVV, qualquer data futura
5. Confirmar → Stripe redireciona para `/upgrade?status=success&session_id=...`
6. Página faz polling no tier a cada 3s (timeout 30s); webhook deve disparar e `hub_user_tiers.tier` deve virar `pro`
7. Voltar em `/upgrade` e testar "Gerenciar assinatura" → redireciona para portal
8. No portal: cancelar assinatura → verificar que `hub_user_tiers.tier` voltou para `free`

Eventos no Stripe Dashboard → Developers → Events: deve listar cada webhook com `200 OK`.

---

## 8. Ir para produção

1. Trocar keys de teste para live em Supabase secrets (`sk_test_` → `sk_live_`, price_ids test → price_ids live, whsec test → whsec live)
2. Reconfigurar webhook em modo **Live** no Stripe Dashboard (URL idêntica, eventos idênticos, novo whsec)
3. Atualizar `STRIPE_WEBHOOK_SECRET` com o whsec de live
4. Redeploy funções (caso mude o código; secrets são picked up sem redeploy em Supabase)
5. Smoke-test com cartão real (pequena quantia, reembolsar via dashboard)

---

## 9. Monitoramento

- Supabase → Edge Functions → `stripe-webhook` → Logs: conferir runs sem erro
- Stripe Dashboard → Developers → Events: inspecionar falhas de entrega (retry automático até 3 dias)
- `hub_user_tiers` table: `select tier, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end from hub_user_tiers`

Se webhook reportar `setTierForCustomer: no hub_user_tiers row matched customer cus_...` → significa que Stripe tem o customer mas Supabase perdeu o link. Corrigir manualmente com `update hub_user_tiers set stripe_customer_id = 'cus_...' where user_id = '<uuid>'`.

---

## Troubleshooting

**Erro "Stripe env vars not configured" em stripe-checkout:** secret não foi salvo no Supabase. Checar em Edge Functions → Manage secrets.

**Webhook retorna 400 "Signature verification failed":** `STRIPE_WEBHOOK_SECRET` no Supabase não bate com o signing secret do endpoint no Stripe Dashboard. Reabrir endpoint no Stripe, copiar whsec novo, atualizar no Supabase.

**Checkout redireciona para `muuney.app/upgrade` em vez de `hub.muuney.com.br/upgrade`:** `SITE_URL` não foi configurado. O fallback no código é `hub.muuney.com.br`, mas se `SITE_URL` estiver setado errado ele ganha precedência.

**Portal retorna "No Stripe customer on file":** usuário nunca completou checkout. Enviá-lo para `/upgrade` primeiro.

**Tier não vira Pro após checkout:** webhook não está recebendo o evento. Stripe → Developers → Events → filtrar por `checkout.session.completed` → checar se há delivery para o endpoint do Hub. Se status ≠ 200, ver erro no payload.

---

## Trial de 14 dias (opcional)

Para habilitar o trial de 14 dias no checkout:

1. Supabase → Edge Functions → Manage secrets → adicionar `STRIPE_TRIAL_DAYS=14`
2. Redeploy é desnecessário — secrets são picked up imediatamente

Regras do trial (implementadas em `stripe-checkout/index.ts`):

- Aplicado apenas para usuários que nunca tiveram uma assinatura Pro ativa (`hub_user_tiers.pro_since IS NULL`)
- Trial é gerenciado pela Stripe (não exige implementação server-side extra)
- Após o trial, Stripe cobra automaticamente o cartão cadastrado no checkout
- Durante o trial, `subscription.status = "trialing"` e `tier = "pro"` (mesmo acesso de um Pro pagante)
- Se o usuário cancelar antes do trial expirar (via Customer Portal), nada é cobrado

Para desabilitar: setar `STRIPE_TRIAL_DAYS=0` ou remover a secret.

---

## Campos que a gente NÃO usa

- `price_id` do checkout não vai na URL (exposição desnecessária) — preço é escolhido pelo backend baseado em `plan=monthly|yearly`
- Cupons: `allow_promotion_codes: true` já está ligado — basta criar cupons no Stripe Dashboard
