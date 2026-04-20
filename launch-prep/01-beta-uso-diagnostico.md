# T1 — Diagnóstico de Uso do Beta (Muuney.hub)

**Data do diagnóstico:** 19/Abr/2026 (D+4 do beta, D-11 do launch)
**Fonte:** Supabase `auth.users`, `auth.sessions`, `public.hub_user_tiers`, `public.hub_beta_invites`, `public.hub_feedback`, Edge Function logs
**Autor:** Agente executor

---

## 1. TL;DR (Rule of 3)

- **Apenas 1 beta tester real logou:** Aruan Andrade. Os outros 4 “logins” em 15/04 18:09 foram requisições `curl/7.81.0` do IP do Lucas — **eram testes do fluxo de convite, não acessos reais.**
- **Claim rate real = 20% (1/5),** não 100%. O número 100% do CLAUDE.md reflete `hub_beta_invites.claimed_at` preenchido pelo auto-promote trigger, não login efetivo.
- **Pedro Chacon, Pedro Ivo, Felipe Rodrigues e MMmath10 nunca entraram no hub.** O email de reset/primeiro-acesso provavelmente não chegou, foi pra spam, ou eles receberam mas não clicaram.

---

## 2. Tabela de uso por tester

| Tester | Email | Cadastrado | Últ. login real (browser) | Sessões browser | User-agent | Sinal |
|---|---|---|---|---|---|---|
| **Aruan Andrade** | aruan.andrade@hotmail.com | 15/04 14:01 | **17/04 16:49** | **2** | Chrome 147 Windows | ✅ **Usuário real** |
| Pedro Chacon | pedroa.chacon@hotmail.com | 15/04 13:20 | — | 0 browser (só curl test) | curl/7.81.0 | ❌ Nunca entrou |
| Pedro Ivo | pedroivoqb@gmail.com | 15/04 14:00 | — | 0 browser | curl/7.81.0 | ❌ Nunca entrou |
| Felipe Rodrigues | feliperodrigues7376@gmail.com | 15/04 14:00 | — | 0 browser | curl/7.81.0 | ❌ Nunca entrou |
| MMmath10 | mmmath10@hotmail.com | 15/04 14:01 | — | 0 browser | curl/7.81.0 | ❌ Nunca entrou |

**Referência Lucas (admin):** 3 sessões, última atividade 19/04 19:14 — em uso ativo neste exato momento.

---

## 3. Feedback recebido

```sql
SELECT count(*) FROM public.hub_feedback;
-- 0
```

**Zero feedback. Esperado, dado que 4/5 nunca entraram e o único que entrou (Aruan) não deixou feedback em 2 sessões.**

Hipóteses plausíveis para o Aruan:
- (a) Explorou rápido, achou interessante mas não teve o que comentar.
- (b) Viu bugs mas não clicou no widget (floating bottom-right pode não chamar atenção).
- (c) Não teve contexto/caso de uso real no momento (sem carteira de cliente aberta na tela).

---

## 4. Atividade do Aruan — padrão de uso real

- **1ª sessão:** 16/04 14:23 → 17/04 11:33 (refresh token — 21h, provável que fechou e reabriu)
- **2ª sessão:** 17/04 11:33 → 17/04 16:49 (5h de janela)
- **Dias de uso:** 16/04 e 17/04. Silêncio em 18 e 19/04.
- **Origem:** IP 191.205.108.231, Chrome 147 Windows desktop.

Edge Function logs mostram requests vindo do hub nos últimos dias (mistura Lucas + Aruan, impossível separar por user_id sem JWT decode). Módulos acessados (via endpoint hits): `hub-macro-api` (pib, ipca, selic, fiscal, focus, trabalho, cambio, balanca, credito/saldo_pf/taxa_pj/inadimplencia, renda-fixa/curva_di/ntnb/breakeven/tesouro), `hub-cvm-api` (catalog, fund_search, fund detail, monthly, composition, rankings, insights), `hub-fidc-api` (fidc_overview, fidc_rankings com filtros subordinação), `hub-fii-api` (fii_overview, rentabilidade), `hub-fip-api` (fip_overview, rankings).

**Leitura:** alguém (Lucas provavelmente) está navegando exaustivamente todos os módulos hoje. Aruan nos dias 16-17 também, mas padrão mais superficial (não conseguimos decompor sem analytics).

---

## 5. Bug de produção detectado (não é só diagnóstico de uso)

**3 endpoints do `hub-cvm-api` v23 retornaram HTTP 500 hoje (19/04):**

- `GET hub-cvm-api?endpoint=monthly_overview&months=11` → 500 (323 ms)
- `GET hub-cvm-api?endpoint=admin_rankings&limit=30&order_by=total_pl` → 500 (168 ms)
- `GET hub-cvm-api?endpoint=gestora_rankings&limit=30&order_by=total_pl` → 500 (162 ms)

**Impacto:** Dashboard Hero (tarefa T6) e seção Gestoras/Admins do `/fundos` quebrados para o usuário. O Aruan pode ter batido nisso em 16-17/04 e desistido de voltar.

**Ação imediata:** investigar log da Edge Function hub-cvm-api v23 antes de qualquer outra coisa. Provavelmente é um bug de migração RCVM 175 onde algum endpoint ainda assume coluna legada.

---

## 6. Hipótese consolidada

**O beta não está tendo problema de engajamento. Tem problema de onboarding.**

Sinal forte: dos 4 testers que nunca logaram, todos têm `claimed_at` no mesmo timestamp `2026-04-15 14:01:41` — disparado pelo trigger `auto_promote_beta_invitee` quando o Lucas rodou o invite batch. **Nenhum deles recebeu ou agiu sobre o email de reset de senha.**

Causas possíveis, em ordem de probabilidade:
1. **SITE_URL no Supabase Auth ainda aponta pra localhost** — item ⚠️ nº 45 do CLAUDE.md está ATIVO. Link no email quebra ao clicar.
2. **Redirect URLs não inclui `https://muuney.app/**`** — item ⚠️ nº 46 do CLAUDE.md.
3. **Email caiu em spam** (Supabase default SMTP tem reputation baixa, especialmente para hotmail).
4. **Email não foi enviado** (quota Supabase free tier = 4/hora — 4 convites no mesmo minuto pode ter drop-silent).
5. **Testers não abriram o email** (cenário menos provável dado que todos eram convites coordenados previamente com Lucas).

---

## 7. Recomendação de ação imediata

**Em ordem de prioridade para o Lucas executar HOJE (19/Abr):**

1. **Conferir `SITE_URL` e Redirect URLs no Supabase Dashboard** (Settings → Auth → URL Configuration). Se `http://localhost:*` ainda estiver lá como Site URL, mudar para `https://muuney.app` e adicionar `https://muuney.app/**` em Redirect URLs. Salvar. Reemitir convites.
2. **Investigar os 3 bugs 500 do `hub-cvm-api` v23** (endpoint `monthly_overview`, `admin_rankings`, `gestora_rankings`). Deploy de hotfix ANTES do check-in com testers.
3. **Enviar WhatsApp proativo para os 4 testers que nunca logaram** (template no arquivo `02-beta-checkin-templates.md`). Perguntar: “você recebeu o email de primeiro acesso? conseguiu clicar no link? precisa de um novo convite?”
4. **Contatar Aruan separadamente** — ele é o único usuário real, é ouro. Templates também em `02-`.
5. **Reemitir convites via `invite-beta-user` v2** depois de 1+2 resolvidos, com template de email customizado (hoje o reset padrão Supabase é frio — trocar por comms em tom Lucas).

---

## 8. Queries usadas (para replicação)

```sql
-- Usuários pro/admin + status de convite
SELECT u.id, u.email, u.created_at, u.last_sign_in_at,
       t.tier, bi.invited_at, bi.claimed_at
FROM auth.users u
LEFT JOIN public.hub_user_tiers t ON t.user_id = u.id
LEFT JOIN public.hub_beta_invites bi ON lower(bi.email) = lower(u.email)
WHERE t.tier IN ('pro','admin')
ORDER BY u.last_sign_in_at DESC NULLS LAST;

-- Sessões reais (separa curl de browser)
SELECT u.email, count(DISTINCT s.id) AS sessions_total,
       min(s.created_at) AS first_session,
       max(s.updated_at) AS last_activity,
       array_agg(DISTINCT split_part(s.user_agent, ' ', 1)) AS agents
FROM auth.sessions s
JOIN auth.users u ON u.id = s.user_id
JOIN public.hub_user_tiers t ON t.user_id = s.user_id
WHERE t.tier IN ('pro','admin')
GROUP BY u.email
ORDER BY last_activity DESC NULLS LAST;

-- Feedback
SELECT count(*) AS total_feedback FROM public.hub_feedback;
SELECT * FROM public.hub_feedback ORDER BY created_at DESC LIMIT 20;
```

Para monitorar diariamente, deixar essas 3 queries como bookmark em Supabase Studio SQL Editor.

---

## 9. Perguntas pendentes pro Lucas

1. **Você enviou o link do primeiro-acesso por WhatsApp também, ou só confiou no email automatizado do Supabase?** Se só email, é 90% dos casos de “nunca entrou” — troca de canal resolve.
2. **Qual `SITE_URL` está configurado no Supabase Auth agora?** (prints do Settings → Auth → URL Configuration seriam ideais).
3. **Você já falou com Aruan depois do dia 17?** Se sim, o que ele comentou?
4. **Existe instrumentação de pageview/eventos além dos Edge Function logs?** (PostHog, Mixpanel, GA4 no hub?). Se não, recomendo adicionar PostHog free tier junto com Sentry (T5).
