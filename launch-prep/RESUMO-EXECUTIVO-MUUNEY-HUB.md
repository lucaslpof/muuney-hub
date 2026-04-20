# Muuney.hub — Resumo Executivo Launch 30/Abr/2026

**Autor:** Agente Executor Muuney.hub
**Gerado em:** 19/Abr/2026 (D-11)
**Launch target:** 30/Abr/2026 (Qui) 09:00 BRT
**Caminho crítico:** 11 dias até launch público

---

## TL;DR

- **12 deliverables preparados** cobrindo diagnóstico, templates, checklists, specs técnicas, plano de launch, comms, recrutamento, ops, coordenação de ecossistema e matriz de riscos.
- **3 bloqueios críticos** a resolver esta semana: (1) fix dos 3 bugs 500 em hub-cvm-api v23, (2) implementar Dashboard Hero, (3) ativar Sentry.
- **Lucas precisa decidir/responder ~50 pendências** (consolidadas abaixo por prioridade).
- **Risco #1** é edge functions 500 em produção — tem que ser zero até D-4 (Sex 24/Abr).
- **Próxima ação única** para destravar launch: abrir o arquivo `07-launch-plan-hub-30abr.md` e fazer o Go/No-Go gate de D-4 na próxima sexta-feira.

---

## 1. O que está pronto (12 arquivos entregues)

Todos em `/sessions/adoring-upbeat-ritchie/mnt/muuney-hub/launch-prep/`:

| # | Arquivo | Função | Usar quando |
|---|---------|--------|-------------|
| 01 | `01-beta-uso-diagnostico.md` | Diagnóstico do beta (queries Supabase, 3 bugs 500 identificados) | Agora — entender baseline antes de fix |
| 02 | `02-beta-checkin-templates.md` | Templates WhatsApp/email/call para reativar 4 beta testers | D-10 → D-7 (reativação) |
| 03 | `03-smoke-test-checklist-v1.md` | 18 seções E2E para validar antes launch | D-4 (Sex 24/Abr) e D-1 (Qua 29/Abr) |
| 04 | `04-seo-og-specs.md` | Specs OG + HubSEO component + 12 rotas | D-7 → D-5 (implementação) |
| 05 | `05-sentry-setup-spec.md` | Sentry setup (Free tier), 10 steps, lib/sentry.ts completo | D-9 → D-6 (setup) |
| 06 | `06-dashboard-hero-spec.md` | Spec do HubDashboardHero (KPIs, insights, recents, modules) | D-8 → D-5 (implementação) |
| 07 | `07-launch-plan-hub-30abr.md` | Plano 72h + Go/No-Go gates + rollback | Diário daqui até D+7 |
| 08 | `08-launch-comms-hub-v1.md` | Drafts LinkedIn/Twitter/email/IG/WhatsApp/PR | D-3 → D+3 (publicação) |
| 09 | `09-recrutamento-pre-launch.md` | 4 ICPs + templates cold outreach + content marketing | D-11 → D-3 (recrutar 3–5 testers extras) |
| 10 | `10-ops-playbook-hub-v1.md` | Daily/weekly/incident routines + support templates T1–T5 | D+0 → D+30 (operação) |
| 11 | `11-coordenacao-hub-app-landing-lpa.md` | 4 surfaces + Chinese Wall + shared infra + SSO roadmap | D-7 (landing updates) e ongoing |
| 12 | `12-riscos-contingencias-launch.md` | Top 12 riscos + probabilidade × impacto + mitigação | Semanal (weekly review) |

---

## 2. Caminho crítico (11 dias)

```
D-11 (HOJE 19/Abr Dom)  ── ler/validar deliverables + iniciar recrutamento
D-10 Seg 20/Abr  ── começar Sentry setup + triagem dos 3 bugs hub-cvm-api
D-9  Ter 21/Abr  ── fix bugs + deploy v24 + beta reativation (T2 templates)
D-8  Qua 22/Abr  ── implementar HubSEO (T4) + iniciar Dashboard Hero (T6)
D-7  Qui 23/Abr  ── landing /hub updates (T11) + Sentry em produção
D-6  Sex 24/Abr  ── Dashboard Hero merge + smoke test interno
D-5  Sáb 25/Abr  ── buffer day (contingência) + finalizar comms drafts (T8)
D-4  Dom 26/Abr  ── 🚦 GATE Go/No-Go técnico (T7 seção "D-4")
D-3  Seg 27/Abr  ── LinkedIn teaser post + press embargo + IG warm-up
D-2  Ter 28/Abr  ── smoke test completo T3 + dry-run comms
D-1  Qua 29/Abr  ── 🚦 GATE FINAL Go/No-Go + backup database
D-0  Qui 30/Abr  ── 🚀 LAUNCH 09:00 BRT
D+1  Sex 01/Mai  ── métricas D+1 + quick fixes + segundo post LinkedIn
```

**Se perder 1 dia:** consumir D-5 (buffer)
**Se perder 2+ dias:** postergar launch para 06/Mai (Ter) — comunicar a Pimentel + beta testers + imprensa

---

## 3. Pendências consolidadas — Lucas precisa decidir

Agrupadas por prioridade e bloqueador.

### 🔴 Decisões esta semana (D-11 → D-7) — bloqueiam launch

**Técnico:**
1. **Listar os 3 bugs ativos em hub-cvm-api v23** — stack trace + endpoint + payload. Sem isso, não consigo priorizar fix. (T1, T12-R1)
2. **Feature flag dashboard hero** — OK configurar via env var Vercel (rollback < 5 min)? (T6, T12-R5)
3. **Sentry DSN** — criar conta Sentry nesta semana e compartilhar DSN via env var. (T5)
4. **SITE_URL no Supabase Auth** — verificar que está `https://muuney.app` (não localhost). Se não, reset password links quebram. (CLAUDE.md item 45)
5. **Redirect URLs Supabase Auth** — incluir `https://muuney.app/**` (wildcard)? (CLAUDE.md item 46)

**Regulatório:**
6. **CGA CVM Nº e OAB Nº** — preencher disclaimer padrão dos comms. Sem isso, não posso publicar material público. (T8, T12-R3)
7. **Lucas nome completo** para press release e bio footer. (T8)
8. **Pode publicar changelog público em `/changelog`** — argumento "velocity > copycat"? (T12-R11)

**Comms + marcas:**
9. **Email sender oficial do Muuney.hub** — `hub@muuney.com.br`? `lucas@muuney.com.br`? (T8, T11)
10. **IG handle Muuney** — `@muuney` existe? Se não, criar na semana. (T8)
11. **Tagline hub consolidada** — "Dados CVM + BACEN em um só painel" ou outra? Precisa ser única para D-day. (T8, T11)
12. **Headline e sub do hero da landing `/hub`** — confirmar ou redigir. (T11)

**Beta:**
13. **Permissão explícita para contatar os 4 beta testers** via WhatsApp/email (Aruan, Pedro, mais 2)? Contatos atualizados? (T1, T2)
14. **Autorização de uso de nome + depoimento** para os 2 testers mais ativos — como coletar (reply email simples)? (T2, T4)

### 🟠 Decisões até D-4 (Sex 24/Abr) — alto impacto

**Operacional:**
15. **Contato backup** se Lucas indisponível em incidente crítico — Pimentel? Aruan? Ninguém? (T10, T12)
16. **Budget de emergência** disponível se precisar upgrade Supabase (US$ 25 → US$ 599) ou CS freelancer (R$ 1.500/mês)? (T12-R2, R7)
17. **Pausar 1 rotina durante launch week** (competitor-pulse Sex? muuney-creative-producer?) para aliviar Lucas? (T7, T10)
18. **Deputy regulatório** — Pimentel tem banda para apoiar em < 48h se CVM/ANPD notificar? Ou backup advogado? (T12-R3)

**Recrutamento:**
19. **Press list qualificada** existe (Notion/planilha)? Se não, vale montar esta semana? (T9, T12-R10)
20. **Lucas consegue 30–40 cold outreach por semana** (seção T9) em LinkedIn sem comprometer LPA? Ou precisa reduzir meta?

### 🟡 Decisões até D-1 (Qua 29/Abr) — pode ir ajustando

**Produto:**
21. **5ª KPI no Dashboard Hero** — "últimas atualizações de dados"? "alertas ativos"? (T6)
22. **Greeting personalization** Dashboard Hero — nome do user? Função (AAI / analista)? (T6)
23. **BACEN series codes exatos** para mini chart Dashboard (Selic? IPCA? CDI?) (T6)

**Comms:**
24. **Waitlist size real** (#subscribers em newsletter_subscribers) — para incluir em press release. (T8)
25. **Video teaser 30s** disponível para D-day? Ou pivot para carrossel estático? (T8)
26. **Tom dos follow-ups LinkedIn** — agressivo/comercial ou educacional/brand? (T8)
27. **Ecosystem reposts** — Pimentel e LPA Wealth fazem repost no D-day? (T7, T11)

**Coordenação:**
28. **Domínio `hub.muuney.com.br`** dedicado ou mantém tudo em `muuney.app/hub/*`? (T11)
29. **SSO cross-surface (App PFM ↔ Hub)** é prioridade Q2/Q3 ou pode ir para Q4? (T11)
30. **Signal negativo "muitos produtos"** — há algum sinal de mercado? Se sim, comms precisa enfatizar foco. (T11)

### 🟢 Decisões pós-launch (podem ir para semana D+1→D+7)

31. **Stripe timing** — ativar em Jun ou antes se demanda aparecer? (T7, T12-R9)
32. **Beta Founding AAI badge** — cria um badge visual no perfil? (T9)
33. **Referral program** — lançar Mês 2 pós-launch (CLAUDE.md item 44)?
34. **CS part-time** — contratar se backlog explodir em Mai? (T10, T12-R7)
35. **Mobile app Sentry** — quando o app mobile lançar (roadmap pós-beta) ligar Sentry? (T5)
36. **Admin panel** — onde expor para Lucas (rota separada `/admin` ou inline no dashboard)? (T6)
37. **Fund Score™ metodologia pública** — publicar post D+7 explicando algoritmo? (T9)

---

## 4. Recursos e infraestrutura

**Custos previstos (mensal):**
- Vercel free tier: R$ 0 (até 100GB bandwidth)
- Supabase free tier: R$ 0 (agora) → upgrade Pro US$ 25/mês (D-2) = R$ ~130
- Sentry free tier: R$ 0 (5k errors/mês)
- Domínio muuney.com.br + muuney.app: R$ ~50/ano
- Resend: R$ 0 (até 3k emails/mês)
- Anthropic API (Claude): R$ ~200/mês (suporte dev)
- **Total previsto pré-scale:** R$ 130–330/mês

**Custos contingência (se viralizar):**
- Supabase Team: US$ 599/mês = R$ ~3.000
- Cloudflare Pro: US$ 20/mês = R$ ~100
- CS freelancer: R$ 1.500/mês
- **Total stress case:** R$ 4.500–5.000/mês

**Tooling já configurado:**
- Supabase (yheopprbuimsunqfaqbp)
- Vercel (prj_3l9W4niwBa8uBCZ7fldQVhfQcdgL)
- GA4 (G-FW3X3NEWRP)
- Meta Pixel (1601597777561652)
- Resend API
- IndexNow Edge Function

**Tooling a configurar esta semana:**
- Sentry (T5)
- Google Search Console (T4 seção "submit sitemap")
- Bing Webmaster Tools (T4)

---

## 5. KPIs de sucesso

### D+1 (Sex 01/Mai)
- Signups: 50+ (mínimo para validar landing conversão)
- Activation rate: 60%+ (login + 1 módulo aberto)
- 0 incidentes críticos (P1)
- Sentry errors: < 20 total

### D+7 (Qui 07/Mai)
- Signups cumulativos: 200+
- Retention D7: 40%+
- 1 depoimento público coletado
- 3 artigos de terceiros mencionando Muuney.hub
- Feedback widget: 10+ messages (sinal de engagement)

### D+30 (Sáb 30/Mai)
- Signups cumulativos: 800+
- Retention D30: 10%+ (benchmark SaaS cedo estágio)
- Paying Pro (se Stripe ativo): 5–10 conversões
- NPS: 7+ (coletar em D+14)
- 0 incidentes regulatórios

---

## 6. Próxima ação única para destravar launch

### Esta semana (20–24/Abr)

**Segunda 20/Abr (amanhã):**
1. Ler este resumo + T7 (launch plan) → validar timeline
2. Responder as 14 decisões 🔴 "esta semana" (itens 1–14)
3. Criar Sentry account + compartilhar DSN (1h de trabalho)
4. Triagem dos 3 bugs em hub-cvm-api v23 — listar stack trace + endpoint em `ops/bug-triage.md`

**Terça 21/Abr:**
5. Fix dos 3 bugs + deploy hub-cvm-api v24
6. Enviar templates T2 para os 4 beta testers (WhatsApp primeiro, email fallback)
7. Iniciar cold outreach LinkedIn T9 (10 DMs AAI/analista sell-side)

**Quarta 22/Abr:**
8. Implementar HubSEO component + meta tags das 12 rotas (T4)
9. Iniciar Dashboard Hero (T6) — component scaffolding + mock KPIs

**Quinta 23/Abr:**
10. Landing `/hub` updates (T11 seção "Landing updates pré-launch")
11. Sentry setup completo + 1 teste de alerta

**Sexta 24/Abr — GATE Go/No-Go técnico (T7):**
12. Dashboard Hero merged + smoke test T3 interno
13. Decisão: lançamos 30/Abr ou posterga?

---

## 7. Avaliação honesta do estado atual

**Pontos fortes:**
- Plataforma técnica robusta (29k fund classes, 15+ Edge Functions, 73 séries BACEN)
- Diferencial regulatório real (CGA+OAB do Lucas + posicionamento "dados" vs "recomendação")
- Plano documentado (12 deliverables cobrindo todas as dimensões)
- 11 dias dá tempo confortável para executar caminho crítico

**Pontos de atenção:**
- Beta com baixa ativação (apenas Aruan ativo de 4 convidados) — precisa reativar esta semana ou aceitar launch sem depoimentos
- 3 bugs em edge function crítica — risco #1 na matriz, obrigatório fix antes D-4
- Lucas solo em operação — sobrecarga é risco real, precisa pausar 1 rotina semanal durante launch week
- Dashboard Hero ainda não implementado — risco de ficar apertado se D-5 chegar sem estar pronto

**Honesty check:**
- Launch 30/Abr é ambicioso mas factível se esta semana (D-11 → D-7) for executada com foco
- Se no D-4 o gate Go/No-Go mostrar 🔴 em qualquer item crítico, adiar para 06/Mai é o movimento certo — melhor postergar 6 dias do que lançar com hub-cvm-api 500
- Beta sem depoimentos não inviabiliza launch — pivot narrativo "estreia aberta após 18 dias de beta fechado" é válido
- Foco no launch é mais importante que multiplicar canais — melhor LinkedIn + email + 1 press que 10 canais mal executados

---

## 8. Referências cruzadas

Todos os caminhos abaixo assumem raiz `/sessions/adoring-upbeat-ritchie/mnt/muuney-hub/launch-prep/`.

- **Para rodar diagnóstico do beta agora:** `01-beta-uso-diagnostico.md` (queries SQL prontas)
- **Para contactar beta testers esta semana:** `02-beta-checkin-templates.md` (templates copy-paste)
- **Para smoke test antes do D-day:** `03-smoke-test-checklist-v1.md` (18 seções)
- **Para HubSEO + OG:** `04-seo-og-specs.md` (code + 12 rotas)
- **Para Sentry setup:** `05-sentry-setup-spec.md` (lib/sentry.ts completo, 10 steps)
- **Para Dashboard Hero:** `06-dashboard-hero-spec.md` (wireframes + interfaces + hooks)
- **Para plano 72h diário:** `07-launch-plan-hub-30abr.md` (D-11 → D+7 detalhado)
- **Para comms prontas:** `08-launch-comms-hub-v1.md` (LinkedIn, Twitter, email, IG, WhatsApp, PR)
- **Para recrutar 3–5 extras:** `09-recrutamento-pre-launch.md` (ICPs + templates)
- **Para operação D+0 → D+30:** `10-ops-playbook-hub-v1.md` (daily + weekly + incidents)
- **Para coordenação ecossistema:** `11-coordenacao-hub-app-landing-lpa.md` (Chinese Wall + shared infra)
- **Para monitorar riscos semanalmente:** `12-riscos-contingencias-launch.md` (top 12 + mitigação)

---

## 9. Checklist de entrega final (Agente → Lucas)

- [x] 12 arquivos entregues em `/launch-prep/`
- [x] Cada arquivo self-contained e acionável
- [x] Pendências de Lucas em cada arquivo (não inventadas)
- [x] Tech-Noir preservado (#0a0a0a + #0B6C3E + tom minimalista)
- [x] Rule of 3 aplicado em TL;DRs
- [x] Regulatory-first documentado em riscos + comms + LGPD
- [x] Caminho crítico 11 dias viável
- [x] Resumo executivo consolidando as ~50 pendências
- [x] Próxima ação única documentada (Seg 20/Abr)

---

**Bom launch, Lucas. Esse é o plano. Próximo passo é abrir `07-launch-plan-hub-30abr.md` e rodar o dia de amanhã.** 🚀
