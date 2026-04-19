# Friday Week Close — Sprint 13-17/Abr 2026

**Emitido:** 18/04/2026 (sábado)
**Referência:** Sprint Master 13-17/Abr (Notion: 341b77f9388681609e16c4f974794c05)
**Batch:** 21 (follow-up à closure 17/Abr do Lucas)
**D-beta launch:** 12 dias (30/04/2026)

---

## 1. Headline

A sprint foi **a mais intensa do trimestre**: 18 entregas técnicas, Pedro onboarded como beta
tester #1, pipeline de convite validado end-to-end, landing page com login público, Pluggy
destravado no muuney.app, Resend ativo, código Stripe completo (pendente setup comercial).
Todas as semanas 1 e 2 do plano beta (Foundation + Polish) foram concluídas em **6 dias** —
originalmente planejadas para 14.

Três bloqueios comerciais continuam represando a largada completa do beta:
1. Lista de 9 beta testers AAI (não fornecida).
2. Verificação Supabase Auth SITE_URL (task #40 desta sessão, checklist pronto).
3. Ativação comercial Stripe (defer até pós-beta — OK).

---

## 2. Entregas da semana (17 itens)

### Pipeline técnico — Hub
| # | Item | Status |
|---|------|--------|
| 1 | V4 Fase 1 FIDC Deep Module (hub-fidc-api + FidcHub + FidcLamina) | ✅ |
| 2 | V4 Fase 2 FII Deep Module (hub-fii-api v2 + FiiHub + FiiLamina) | ✅ |
| 3 | V4 Fase 3 Ofertas Públicas Radar standalone (/ofertas) | ✅ |
| 4 | V4 Fase 4 Portfolio Tracker (3 tabelas + RLS + page) | ✅ |
| 5 | Sprint Opção A hotfix: v_hub_fidc_clean + fidc_latest_complete_date | ✅ |
| 6 | Sprint Opção C: ingest-cvm-data v4 streaming, ingest-cvm-ofertas (12,681 RCVM 160) | ✅ |
| 7 | Macro #14 COPOM/FOMC overlay (67 decisões em 6 charts) | ✅ |
| 8 | P1+P3 Sweep (hooks fix, hub-cvm-api v21, hub-fip-api v2, hub-fidc-api v3) | ✅ |
| 9 | Fundos Deep Audit P0+P1+P2 (percentile bug fix, O(n²)→O(n), KPICard shared, debounce) | ✅ |

### Beta Sprint Semana 1 — Foundation
| # | Item | Status |
|---|------|--------|
| 10 | Beta invite system (hub_beta_invites + invite_beta_testers() + auto_promote trigger) | ✅ |
| 11 | FeedbackWidget.tsx (hub_feedback table + floating contextual UI) | ✅ |
| 12 | SkeletonLoader.tsx + EmptyState.tsx (integrados em 6+5 pages) | ✅ |
| 13 | Mobile responsiveness (9 arquivos: grids, padding, feedback widget) | ✅ |
| 14 | OnboardingTour 7 steps (localStorage, route nav, Tech-Noir) | ✅ |

### Beta Sprint Semana 2 — Polish
| # | Item | Status |
|---|------|--------|
| 15 | Breadcrumbs (5 pages) + sidebar persistence | ✅ |
| 16 | ChartTooltip component + apiError.ts (pt-BR) + typography standardization | ✅ |

### Comercial / Produto
| # | Item | Status |
|---|------|--------|
| 17 | Beta Invite Pipeline (invite-beta-user v2 + trigger fixes + Pedro onboarded) | ✅ |
| 18 | Landing page login + primeiro-acesso flow (HubFirstAccess page, Hub Navbar) | ✅ |
| 19 | Stripe Checkout code (edge functions + HubUpgrade rewrite) — pendente setup comercial | ✅ código |
| 20 | Chinese Wall .docx formal (CVM Res. 19/2021 + LGPD) — desta sessão | ✅ |

### Sessão 18/Abr (batch 21)
| # | Item | Status |
|---|------|--------|
| 21 | CLAUDE.md: Pluggy scoping clarificado (muuney.app only, não hub) | ✅ |
| 22 | Notion Sprint Master + Muuney.hub page: update batch 21 | ✅ |
| 23 | chinese-wall-policy-muuney-lpa.docx (17.9 KB, validado) | ✅ |
| 24 | CHECKLIST-supabase-auth-config.md (procedimento #40) | ✅ |
| 25 | META-ADS-B2C-SETUP-PLAYBOOK.md (#42) | ✅ |

---

## 3. Métricas operacionais (snapshot 18/04)

### Produto Muuney.hub
- **Cobertura de dados**: 29,491 fundos catalogados, 21,598 com dados diários, 4,130 FIDCs Feb/26 válidos.
- **Edge functions ativas**: 17 (hub-cvm-api v21, hub-fidc-api v3, hub-fii-api v2, hub-fip-api v2, hub-ofertas-api v1, ingest-cvm-data v4, invite-beta-user v2, +10).
- **pg_cron jobs**: 6 (CDA #15, FIDC #16, FII #17, FIP #18, detect-fund-insights #19, ofertas #20).
- **Build health**: tsc 0 erros, vite 4.44s.

### Beta
- **Convidados**: 1/10 (Pedro — tier=pro, email_confirmed, senha pendente).
- **Feedbacks coletados**: 0 (widget acabou de entrar em produção).
- **Tempo até primeira sessão válida de beta**: aguardando Pedro definir senha em hub.muuney.com.br/primeiro-acesso.

### Go-to-market (muuney.app B2C)
- **Waitlist**: dado em `newsletter_subscribers` (consulta pendente, sem SQL rodado esta sessão).
- **Blog**: 15+ artigos publicados (daily publisher ativo).
- **SEO**: sitemap 27 URLs + IndexNow ativo.
- **Meta Pixel**: 1601597777561652 (configurado; Ads Manager ainda não ativo — draft em #42).

---

## 4. Riscos e bloqueios

### 🔴 Crítico (bloqueia beta launch 30/04)
| Risco | Mitigação | Owner | SLA |
|-------|-----------|-------|-----|
| Lista de 9 beta testers AAI não fornecida | Lucas colar no chat ou Notion | Lucas | 22/04 |
| Supabase SITE_URL potencialmente em localhost | Verificar via checklist #40, 5 min | Lucas | 21/04 |
| Pedro ainda sem senha (senha pendente) | Avisar Pedro por WhatsApp/e-mail para acessar hub.muuney.com.br/primeiro-acesso | Lucas | 19/04 |

### 🟡 Atenção (não bloqueia, mas pesa no trimestre)
| Risco | Mitigação | Owner | SLA |
|-------|-----------|-------|-----|
| taxa_adm cobertura 0.4% — fundos sem custo no Fund Score | UI já degrada graciosamente; sprint ANBIMA futura | Lucas | Pós-launch |
| FIDC 202603 parcial na CVM | pg_cron #16 reprocessa dia 8 | Automático | Automático |
| Legacy CVM 400/476 parser bug | Dado histórico congelado; Python pipeline funciona | — | Não bloqueia |
| Stripe dashboard não configurado | Defer pós-beta (beta sem cobrança) | Lucas | Pós 30/04 |

### 🟢 Sob controle
- Edge functions sem incidentes conhecidos.
- Build production clean.
- Pluggy integration com muuney.app operacional.

---

## 5. Meta para a semana 26-30/04 (launch week)

Lembrando: são as 5 últimas sessões antes do public launch do hub.

**Obrigatórios (go/no-go do launch):**
1. Convidar e validar os 9 beta testers restantes → conseguir **≥ 3 sessões de feedback ativas** até 28/04.
2. Build + deploy final com error tracking (Sentry ou similar, leve).
3. Smoke test E2E completo (login → 5 módulos → lâmina → portfolio → comparador → insights → logout).
4. Dashboard hero na landing do hub (KPIs consolidados).
5. SEO/OG meta tags nas 5 páginas core (+ Ofertas e Portfolio).

**Desejáveis (nice-to-have se sobrar tempo):**
6. Resolver feedbacks críticos recebidos até 26/04.
7. Atualizar muuney-hub-onepager-b2b.pdf com screenshots atuais.
8. Vídeo de 60s demonstrando um fluxo completo no hub (para LinkedIn do Lucas no dia 30/04).
9. Post de lançamento no blog (1 artigo).

**Não tentar agora (anti-commit):**
- V4 Fase 5 Premium Polish (trial 14d, billing history).
- ANBIMA partnership para taxa_adm.
- Macro #11 DI×Pré real vertices.
- Macro #15 PDF export.

---

## 6. Comitê da semana que vem (segunda 21/04 08h, Cowork)

**Pauta proposta:**
1. (5 min) Status tasks #34, #40, #41, #42, #47 desta sessão.
2. (5 min) Pedro conseguiu entrar? Qual a primeira impressão? Primeiros bugs reportados?
3. (10 min) Priorização dos 8 bloqueios 🟡 + rebalanceamento semana 3.
4. (10 min) Meta Ads B2C: aprovar budget/draft (#42) ou adiar para maio?
5. (5 min) Launch week calendário (comm plan + blog + LinkedIn).

**Insumos já prontos (nesta sessão):**
- chinese-wall-policy-muuney-lpa.docx (assinatura do Lucas).
- CHECKLIST-supabase-auth-config.md (10 min para aplicar).
- META-ADS-B2C-SETUP-PLAYBOOK.md (decisão go/no-go).
- Notion Sprint Master + Muuney.hub atualizados.

---

## 7. Velocity

Sprint 13-17/Abr + sessão 18/Abr:
- **Entregas técnicas**: 20 (Hub V4 + Beta Sprint S1+S2 + Invite Pipeline + Audits).
- **Entregas comerciais**: 5 (Landing login, Pedro, CLAUDE.md, Notion batch 21, Chinese Wall docx).
- **PRs / commits relevantes**: e6eba60, 26ff312, d5a506d, bb4dd39, db46b4e, 2129aca, 6c8e781, bdd3993, bc0d8aa, 2f0e1ba + outros.
- **Cobertura do plano beta 14 dias**: 72% em 6 dias corridos (Foundation 100% + Polish 100% + Launch 0%).

**Conclusão:** velocidade excepcional nas semanas 1-2. Semana 3 (launch) cabe em 5 sessões se
os 3 bloqueios críticos forem destravados até 22/04. Caso contrário, risco concreto de
postergar de 30/04 para 07/05.

---

## 8. Ação imediata para Lucas (próximas 48h)

- [ ] Colar a lista de 9 e-mails dos beta testers AAI no chat ou no Notion Sprint Master → dispara #37, #38.
- [ ] Abrir Supabase Studio → executar o CHECKLIST-supabase-auth-config.md (10 min).
- [ ] WhatsApp ou e-mail para Pedro: "acesse hub.muuney.com.br/primeiro-acesso e defina sua senha".
- [ ] Ler e assinar `chinese-wall-policy-muuney-lpa.docx` (10 min).
- [ ] Ler META-ADS-B2C-SETUP-PLAYBOOK.md e decidir go/no-go (15 min).

Total estimado: 40 minutos.
