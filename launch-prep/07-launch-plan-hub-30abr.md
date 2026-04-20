# T7 — Plano de lançamento Muuney.hub (30/Abr/2026)

**Data atual:** 19/Abr/2026 (D-11)
**Data alvo launch:** 30/Abr/2026, quinta-feira, **09:00 BRT**
**Janela crítica monitorada:** D-3 (27/Abr) → D+7 (07/Mai)
**Escopo:** tornar o hub acessível publicamente via signup (tier free) + sinalizar para wait-list, beta testers, comunidade e orgânico.

---

## 1. TL;DR (Rule of 3)

- Launch às **qui 30/Abr 09:00** (melhor janela pro público alvo — AAIs começam o dia antes da reunião diária das 10h).
- Go/no-go check nas **24h antes (29/Abr 09:00)** baseado em: (a) P0 bugs zerados, (b) smoke test E2E aprovado, (c) beta feedback processado.
- Rollback plan simples: reverter último deploy no Vercel + manter landing estática. Comms "em manutenção" se tudo quebrar.

---

## 2. Timeline consolidada (D-11 → D+7)

### D-11 a D-4 (19-25/Abr) — Foundation week

**Objetivo:** zerar bugs P0, validar onboarding com beta, preparar assets de launch.

| Dia | Tarefa | Dono | Deliverable |
|---|---|---|---|
| Dom 19/Abr | Fix 3 bugs 500 hub-cvm-api v23 | Lucas | v24 deployed |
| Dom 19/Abr | Verificar SITE_URL + Redirect URLs Supabase | Lucas | Print confirmando |
| Dom 19/Abr | WhatsApp proativo 4 testers + Aruan (T2) | Lucas | 5 msgs enviadas |
| Seg 20/Abr | Implementar HubDashboardHero (T6) | Lucas | PR merged |
| Seg 20/Abr | Call Aruan (se topar) | Lucas | Notas estruturadas |
| Ter 21/Abr | Sentry setup (T5) | Lucas | Deploy + alerts ativos |
| Ter 21/Abr | SEO + OG tags (T4) | Lucas | PR merged, validator OK |
| Qua 22/Abr | Smoke test E2E completo (T3) | Lucas | Planilha com 18 sections marcadas |
| Qua 22/Abr | Produzir OG images (T4 design briefs) | Lucas | 12 imagens 1200x630 em /public/og/ |
| Qui 23/Abr | Recrutar 3-5 testers novos (T9) | Lucas | LinkedIn DMs enviadas |
| Qui 23/Abr | Draft comms launch (T8) revisão Lucas | Lucas | Aprovação textos LinkedIn + email |
| Sex 24/Abr | Follow-up testers novos + Aruan | Lucas | Tracking table atualizada |
| Sex 24/Abr | Produzir assets creative (IG carousel + Reels) | Creative Producer | 6 designs aprovados |
| Sáb 25/Abr | Buffer — bugs reportados | Lucas | — |

**Gate D-4 (Sex 24/Abr EOD):**
- [ ] 0 bugs P0 abertos
- [ ] ≥2 beta testers entraram de verdade e deram feedback
- [ ] Sentry ativo em prod com 0 alerts novos
- [ ] SEO + OG funcionando (validators OK)
- [ ] Comms launch aprovados pelo Lucas

### D-3 a D-1 (27-29/Abr) — Pre-launch week

**Objetivo:** garantir deploy stable + aquecer audiência + validar rollback.

| Dia | Tarefa | Dono | Deliverable |
|---|---|---|---|
| Seg 27/Abr 09:00 | Smoke test E2E rerun + production | Lucas | Planilha v2 green |
| Seg 27/Abr 12:00 | Lock feature freeze | Lucas | Anúncio interno |
| Seg 27/Abr 16:00 | Post LinkedIn teaser Lucas | Lucas | Live post (1º touchpoint) |
| Ter 28/Abr 09:00 | Verificar Sentry sem incidentes 72h | Lucas | Screenshot dashboard |
| Ter 28/Abr 11:00 | Ensaiar rollback em preview branch | Lucas | Confirmar `vercel rollback` funciona |
| Ter 28/Abr 14:00 | Email warm-up waitlist (T8) | Lucas | Resend dispatch |
| Ter 28/Abr 16:00 | Post Twitter/X teaser | Lucas | Live thread start |
| Qua 29/Abr 09:00 | **Go/No-Go meeting (solo Lucas 30min)** | Lucas | Checklist assinada |
| Qua 29/Abr 11:00 | Final deploy freeze + tag release | Lucas | `v1.0.0-launch` em GitHub |
| Qua 29/Abr 14:00 | WhatsApp status + IG stories prévia | Lucas | Multicanal aquecido |
| Qua 29/Abr 18:00 | Última checagem Sentry + Supabase quotas | Lucas | Logs limpos |
| Qui 30/Abr 06:00 | Monitoring começa | Lucas | Tab aberto Sentry + Supabase |

**Gate D-1 (Qua 29/Abr 11:00):**
- [ ] Todos os 8 critérios do go/no-go abaixo satisfeitos
- [ ] Ensaio rollback executado com sucesso
- [ ] Backups Supabase recentes (automatic tá OK, só confirmar)
- [ ] Estoque de respostas (FAQ) preparado

### D-day (Qui 30/Abr) — Launch day

**Objetivo:** entrar no ar, absorver primeiros 100-500 usuários, monitorar e reagir.

| Hora BRT | Tarefa | Dono | Critério |
|---|---|---|---|
| 06:00 | Monitoring check: Sentry + Supabase logs | Lucas | 0 alerts críticos |
| 07:00 | Deploy sinal público + post LinkedIn principal (T8) | Lucas | Post ao ar |
| 07:15 | Twitter thread principal | Lucas | Tweet ao ar |
| 07:30 | Email broadcast waitlist + newsletter | Lucas | Resend dispatch confirmed |
| 08:00 | Post Instagram carousel + Stories | Lucas | Feed + stories ao ar |
| 08:30 | WhatsApp status + mensagens curadas (10 contatos VIP) | Lucas | 10 DMs |
| 09:00 | **Oficialização launch — abrir signup público** | Lucas | Remover feature flag tier restrictivo |
| 09:15 | Primeira checagem: Sentry + GA4 users online | Lucas | Sem spikes de erro |
| 10:00 | Post em comunidade (se houver) + Slack AAIs | Lucas | Touchpoint grupo alvo |
| 10:30 | Checkpoint: novos signups últimos 90min | Lucas | Target: 20-50 |
| 11:00 | Second wave LinkedIn — article+posts convidados | Lucas | Repost dos amigos de RP |
| 12:00 | Check meio-dia: erros / feedback / signups | Lucas | Planilha D-day atualizada |
| 13:00-14:00 | Almoço + buffer (não fazer nada novo, só monitorar) | Lucas | — |
| 14:00 | Post pt.2 LinkedIn — caso de uso | Lucas | Content marketing |
| 15:00 | Check: Sentry error rate <2% requests | Lucas | OK / rollback |
| 16:00 | DMs individuais 10 AAIs top-of-mind | Lucas | Handouts personalizados |
| 17:00 | Newsletter thank-you aos primeiros signups | Lucas | Resend loop |
| 18:00 | Resumo interno do dia | Lucas | Planilha "D-day recap" |
| 22:00 | Final check antes de dormir | Lucas | Sentry clean + set alerts noite |

### D+1 a D+7 (01-07/Mai) — Stabilization week

**Objetivo:** corrigir bugs emergentes, converter curiosos em Pro (ainda não — foco em ativação), produzir social proof.

| Dia | Foco | Tarefas chave |
|---|---|---|
| Sex 01/Mai | **Holiday Day do Trabalho** (!) → pouca atividade | Só monitoring passivo. Aproveitar pra rever feedback |
| Sáb 02/Mai | Análise quantitativa D-day | Dashboard signup / session / retention D0→D1 / feedback |
| Dom 03/Mai | Preparar post "24h depois" + fix quick wins | Bugs triviais deploy silencioso |
| Seg 04/Mai | Post "24h recap" + thank you públicos | LinkedIn + Twitter |
| Seg 04/Mai | Contatar primeiros 10 usuários ativos | WhatsApp/email perguntando feedback |
| Ter 05/Mai | Sprint 7d — priorizar bugs reportados | Roadmap ajustado |
| Qua 06/Mai | Newsletter comunidade | Resend (via automação) |
| Qui 07/Mai | **D+7 Retro** | Planilha métricas + decisão pivot/segue |

---

## 3. Critérios Go/No-Go (D-1 checklist)

Todos precisam estar verdes para launch. Qualquer vermelho → adiar para segunda 04/Mai.

**Técnico (P0):**
- [ ] Zero bugs P0 em backlog (hub-cvm-api v23 fixado)
- [ ] Smoke test E2E passou em produção (last run <24h)
- [ ] Sentry capturando erros e alertas configurados (validado com erro de teste)
- [ ] Supabase quotas: auth tier free ≥80% available, database ≥70%
- [ ] Edge Functions todas respondendo <2s p95 nos últimos 7 dias
- [ ] Vercel: último deploy ≥24h atrás sem issues

**Produto:**
- [ ] Onboarding tour fluindo (6 steps)
- [ ] Dashboard Hero visível em /dashboard
- [ ] Signup fluxo completo testado (email → recovery → senha → login)
- [ ] Premium gates funcionando (free vê paywalls, Pro desbloqueado)
- [ ] Feedback widget enviando para hub_feedback table

**Comms:**
- [ ] LinkedIn post principal aprovado + scheduled
- [ ] Twitter thread draft + 8-10 tweets prontos
- [ ] Email broadcast template aprovado no Resend
- [ ] OG images validadas (LinkedIn Post Inspector + Twitter Validator)
- [ ] IG carousel 6 frames produzido
- [ ] WhatsApp status mídia preparada

**Regulatório:**
- [ ] CVMDisclaimer presente em páginas com dados de fundos (Resolução CVM 19/2021)
- [ ] LGPD: termos de uso + política privacidade publicados em /termos + /privacidade
- [ ] Email de contato funcional (contato@muuney.com.br)

---

## 4. Rollback plan

### 4.1 Cenário leve (bug cosmético)
- Permanecer deploy, abrir issue, corrigir em patch release D+1/D+2.
- Não comunicar publicamente. Resposta privada a quem reportar.

### 4.2 Cenário médio (feature quebrada mas app funcional)
- Comunicar em Sentry + dashboard interno
- Deploy hotfix Edge Function em <2h via MCP Supabase
- Se hotfix precisa >4h: comentar em rodapé do hub "Módulo X em manutenção"
- Post público só se impactar ≥20% dos usuários

### 4.3 Cenário grave (app caiu / auth quebrado / dados expostos)
- **Rollback imediato:** `vercel rollback` para último deploy estável (tag `v0.9.x-stable`)
- Edge Functions problemáticas: remover via MCP Supabase ou desativar no dashboard
- Landing page estática muuney.com.br permanece (não depende do hub)
- Status page: publicar em X/LinkedIn "Hub em manutenção — volta em X horas"
- Se for vazamento LGPD: notificar ANPD em 2 dias úteis (Art. 48 LGPD)

### 4.4 Pré-requisitos do rollback funcionar

- [ ] Tag `v0.9-stable` criada em GitHub antes do deploy de launch
- [ ] `vercel rollback` testado em preview env
- [ ] Edge Functions v21/v22 ainda disponíveis no Supabase (não sobrescrever)
- [ ] Backup Supabase recente (automatic daily OK)
- [ ] Status page preparada (draft post X + LinkedIn + email)

---

## 5. Métricas de sucesso

### 5.1 Vanity metrics (importantes pra percepção pública)

| Métrica | D+1 | D+7 | D+30 |
|---|---|---|---|
| Signups totais | 50 | 200 | 800 |
| Visitantes únicos /hub | 500 | 2.000 | 8.000 |
| LinkedIn impressões | 5.000 | 20.000 | 50.000 |
| Twitter impressões | 1.000 | 5.000 | 15.000 |

### 5.2 Activation metrics (o que de verdade importa)

| Métrica | D+1 | D+7 | D+30 |
|---|---|---|---|
| Signups que logaram ≥1x | 60% | 70% | 75% |
| Usuários com ≥2 sessões | 20% | 40% | 50% |
| Usuários que viram ≥3 módulos | 30% | 50% | 55% |
| Usuários que acessaram uma lâmina | 15% | 30% | 40% |
| Feedbacks submetidos | 5 | 20 | 80 |

### 5.3 Retention (pós-launch, foco real do negócio)

| Métrica | Meta |
|---|---|
| D1 retention | 40% |
| D7 retention | 20% |
| D30 retention | 10% |

### 5.4 Revenue (deferred — beta sem cobrança)

Beta grátis até 30/Abr. Upgrade para Pro (R$49/mês ou R$490/ano) só ativado **após** Stripe setup manual. Durante launch: **zero cobrança**. Comunicar explícito "Gratuito em fase beta, sem necessidade de cartão."

**Soft target D+30 pós-Stripe setup:**
- 20 Pro users (R$980/mês MRR inicial)
- Churn <10%
- Upgrade rate free→Pro ≥2%

---

## 6. Stakeholders & RACI

Muuney é pequeno o suficiente pra que tudo seja responsabilidade do Lucas, mas vamos distribuir quando possível:

| Atividade | R | A | C | I |
|---|---|---|---|---|
| Hotfix código | Lucas | Lucas | — | — |
| Comms LinkedIn | Lucas | Lucas | — | Rede contatos AAIs |
| Customer support | Lucas | Lucas | — | — |
| LGPD/legal | Lucas (OAB) | Lucas | — | — |
| Ops Supabase/Vercel | Lucas | Lucas | — | — |
| Creative Producer bot | Auto | Lucas | — | — |
| Monitoring | Sentry auto + Lucas | Lucas | — | — |

---

## 7. Budget estimado D-11 → D+7

| Item | Custo | Observação |
|---|---|---|
| Sentry Free | R$ 0 | Até 5k errors/mês |
| Vercel Hobby | R$ 0 | Já em uso |
| Supabase Free | R$ 0 | Já em uso |
| Resend (até 3k/mês) | R$ 0 | Ativar conta + domínio (T8 item) |
| GA4 | R$ 0 | Já em uso |
| Boost LinkedIn (opcional) | R$ 150 | 1 post principal |
| Domínio .app | R$ 60/ano | Já em uso |
| **Total 18 dias** | **R$ 0-150** | Zero marketing paid durante launch (validação orgânica) |

---

## 8. Comunicação stakeholders externos

Durante a semana D-3 → D+3, Lucas deve também:

- **Aruan e beta testers ativos:** avisar no D-3 que o launch é na quinta, pedir que compartilhem se acharem legal
- **LPA Wealth clientes selecionados:** email personalizado D-1 "estamos lançando, aqui está seu acesso antecipado"
- **Comunidade AAIs conhecidos:** DMs individuais D-day manhã
- **Ecossistema Pluggy:** post tagging @pluggy no LinkedIn pra aproveitar rede
- **ANCORD/APIMEC:** se aplicável, newsletter interna no D+3

---

## 9. Cenários não felizes mapeados

1. **Nenhum signup nas primeiras 2h:** re-verificar comms live, DMs pessoais para 10 AAIs, reativar boost LinkedIn.
2. **Supabase Auth quota estourada (rate limit emails):** temporariamente desabilitar email verification no Supabase, confiar na validação do link.
3. **Edge Function cai em produção:** rollback para versão v21/v22 via MCP Supabase, comunicar "módulo X temporariamente offline".
4. **Crítica pública (ex: AAI famoso criticando no Twitter):** Lucas responde pessoalmente com tom construtivo, nunca defensive. Convida pra call privada. Atitude: aprender publicamente.
5. **Load spike imprevisto (alguém grande compartilha):** Vercel auto-scale cobre, Supabase free tier pode cair — upgrade Team ($25/mês) em <5min se necessário.
6. **Bug LGPD detectado (ex: dados de user A aparecendo para user B):** rollback imediato + notificação ANPD em 2 dias úteis. Priority absoluta.

---

## 10. Post-launch first sprint (D+1 → D+14)

Já pensando no pós:
- **Sprint 01 (01-07/Mai):** Stabilization — bugs do launch, UX quick wins
- **Sprint 02 (08-14/Mai):** Revenue gate — Stripe live + primeiros 5 Pro users
- **Sprint 03 (15-21/Mai):** Growth — ATvrez Meta Pixel, Google Ads (se orçamento), referral program

---

## 11. Perguntas pendentes pro Lucas

1. **Quinta-feira 09:00 BRT serve?** AAIs normalmente têm call de mercado 09:00-09:30 — talvez queiram ter aberto o hub antes. Se preferir 08:30, tudo bem. Domingo → segunda 09:00 pode ser alternativa se 30/Abr bater no feriado ponte 01/Mai (dia do trabalho BR).
2. **Tem alguém do ecossistema que pode produzir 1-2 posts de apoio D-day?** (ex: Pimentel LPA, contato Pluggy, cliente HNW que vai testar). Amplifica 3-5x sem custo.
3. **Vai ter 30min fixo D-day 09:00 sem reunião/call?** Launch demanda atenção total — não é hora de validar SLA cliente ou call legal.
4. **Quer que o beta testers tenham badge "Beta Founding AAI"?** Se sim, criar campo em hub_user_tiers.metadata ou profile + exibir no Hub (social proof + reconhecimento gratuito).
5. **Stripe entra D-day ou pós-beta?** Spec diz que beta é grátis — assumo launch público sem Stripe também, upgrade pago ativa Sprint 02 (08-14/Mai). Confirma?
