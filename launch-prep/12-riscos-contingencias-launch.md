# Muuney.hub — Matriz de Riscos & Contingências (Launch 30/Abr/2026)

**Autor:** Agente Executor Muuney.hub
**Última atualização:** 19/Abr/2026 (D-11)
**Escopo:** Launch dia 30/Abr + primeiros 30 dias (até 30/Mai/2026)
**Metodologia:** Probabilidade (1–5) × Impacto (1–5) = Severidade (1–25). Ordenação por severidade desc.

---

## TL;DR

- **3 riscos críticos (severidade ≥ 16):** edge functions 500 em produção, viralização sem cache/rate-limit, falha regulatória CVM/LGPD em comms.
- **5 riscos altos (10–15):** landing não converte, beta churn antes D-day, bug crítico dashboard hero, Stripe não pronto pós-beta, sobrecarga operacional Lucas solo.
- **4 riscos médios (5–9):** SEO indexação lenta, press sem eco, competidor copia features, PR negativo fintech brasileira.
- **Resposta:** cada risco tem owner, trigger signals, plano de mitigação pré-launch, contingência se ocorrer, e critério de escalonamento.

---

## Legenda

| Escala | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **Probabilidade** | Muito baixa | Baixa | Moderada | Alta | Quase certa |
| **Impacto** | Desprezível | Menor | Moderado | Grande | Catastrófico |

**Severidade:**
- 🔴 **Crítico** (16–25): ação obrigatória pré-launch, revisar diariamente
- 🟠 **Alto** (10–15): plano de mitigação documentado, revisar semanalmente
- 🟡 **Médio** (5–9): monitorar, contingência pronta
- 🟢 **Baixo** (1–4): aceitar, documentar

---

## Matriz consolidada (top 12)

| # | Risco | P | I | Sev | Owner | Status mitigação |
|---|-------|---|---|-----|-------|------------------|
| 1 | Edge functions 500 em produção (hub-cvm-api v23 tem 3 bugs ativos) | 4 | 5 | 🔴 20 | Lucas | Em andamento |
| 2 | Viralização inesperada sem cache/rate-limit → Supabase quota exceeded | 2 | 5 | 🔴 10 + upside catastrófico | Lucas | Parcial |
| 3 | Comms violam regulatório CVM (promessa implícita de retorno, disclaimer fraco) | 2 | 5 | 🔴 10 + risco PF | Lucas | Em revisão |
| 4 | Beta churn antes D-day (4 testers pagos, Aruan único ativo) | 4 | 3 | 🟠 12 | Lucas | Em andamento |
| 5 | Dashboard hero quebra no D-day (componente novo, sem smoke test E2E) | 3 | 4 | 🟠 12 | Lucas | Pendente |
| 6 | Landing /hub não converte (taxa signup < 3% → meta D+7 não atinge) | 3 | 4 | 🟠 12 | Lucas | Parcial |
| 7 | Sobrecarga operacional Lucas solo (CS + bugs + comms + LPA) | 4 | 3 | 🟠 12 | Lucas | Parcial |
| 8 | SEO indexação lenta (12 URLs novas, Google leva 7–14d) | 4 | 2 | 🟡 8 | Lucas | Em andamento |
| 9 | Stripe não pronto quando beta pedir Pro pago (Maio) | 3 | 3 | 🟡 9 | Lucas | Deferred OK |
| 10 | Press release sem eco (0 jornalistas respondem em 7 dias) | 4 | 2 | 🟡 8 | Lucas | Aceitar |
| 11 | Competidor (XP, Nubank, Toro) copia feature em 30d | 2 | 3 | 🟡 6 | Lucas | Aceitar parcial |
| 12 | PR negativo viral sobre fintech brasileira atinge Muuney por proximidade | 2 | 3 | 🟡 6 | Lucas | Plano comms |

---

## R1 — 🔴 Edge functions 500 em produção

**Probabilidade:** 4/5 (já tem 3 bugs ativos confirmados em hub-cvm-api v23 conforme diagnóstico T1)
**Impacto:** 5/5 (usuário abre módulo Fundos/FIDC/Ofertas e vê erro → churn instantâneo no D-day)
**Severidade:** 🔴 **20**

**Trigger signals:**
- Sentry alerta `http_status=500` em `edge_function=hub-cvm-api`
- Supabase dashboard `Function logs` com spike de errors
- Feedback widget recebe ≥ 3 reports "não carrega" em 1h

**Mitigação pré-launch (D-11 → D-4):**
- Listar os 3 bugs conhecidos em v23 (arquivar stack trace + endpoint + payload que falha)
- Corrigir os 3 bugs e deployar v24 até **D-7 (Qua 22/Abr)**
- Smoke test dos 27+ endpoints (T3 seção 8) — cada um deve retornar 200 com payload válido
- Configurar alerta Sentry: qualquer `edge_function=*` com `status=500` → email + Slack Lucas em < 2 min
- Adicionar try/catch defensivo em todos os callers frontend (InlineEmpty vs crash)

**Contingência se ocorrer em produção:**
1. **Detecção < 5 min:** Sentry envia alerta → Lucas recebe push
2. **Triagem < 15 min:** reproduzir em curl; é bug de código, de dados, ou de infra?
3. **Fix < 60 min:** se código — rollback para v22 via Supabase CLI; se dados — corrigir fonte e retry; se infra — abrir ticket Supabase
4. **Comms:** postar status page `/status` com texto "Estamos restaurando o módulo X, previsão Y min"
5. **Pós-mortem:** documentar em `ops/incidents.md` (T10 Incident #N) + retrospectiva em 24h

**Escalonamento:**
- Se > 3 incidentes 500 em 24h → pausar novos signups até estabilizar (banner amarelo "Capacidade limitada")
- Se > 1h sem resolver → publicar em redes "manutenção emergencial" + contatar Supabase support

---

## R2 — 🔴 Viralização inesperada sem cache/rate-limit

**Probabilidade:** 2/5 (raro mas possível se um post viralizar)
**Impacto:** 5/5 (Supabase tier free = 500MB DB + 50k MAU; 5k usuários simultâneos = quota exhausted → app offline)
**Severidade:** 🔴 **10** (mas upside catastrófico justifica tratamento crítico)

**Trigger signals:**
- GA4 `users` > 1.000 em 1h (vs baseline diário < 100)
- Supabase dashboard `Database size` > 400MB ou `API requests` > 80% quota
- Vercel bandwidth > 80GB/mês (tier free = 100GB)
- Sentry `rate limit errors` pico

**Mitigação pré-launch:**
- Configurar React Query `staleTime` generoso em hooks públicos (60min para overview)
- Adicionar CDN caching headers em Edge Functions `Cache-Control: public, max-age=300` para endpoints que não dependem de user
- Rate limit client-side via fingerprint: máx 100 requests/min por IP
- Upgrade Supabase **Pro plan** (US$ 25/mês) antes D-day → 8GB DB + 100k MAU + quotas maiores
- Monitorar em tempo real no D-day (checagem a cada 30 min das primeiras 6h)

**Contingência se ocorrer:**
1. **Banner amarelo:** "Estamos experimentando alta demanda — algumas funcionalidades podem estar lentas"
2. **Desativar features não-críticas:** Feedback widget pode ser temp disabled, insights feed pode ter refresh reduzido
3. **Escalar Supabase:** upgrade Pro → Team (US$ 599/mês) se quota MAU explodir
4. **Limitar signups:** fechar waitlist por 24h, comunicar "acesso por convite devido ao alto volume"
5. **CDN:** Cloudflare free tier na frente do Vercel (pode ser adicionado em < 30 min)

**Escalonamento:**
- > 5k users simultâneos → Lucas + alertar Supabase support (tier Pro tem response 24h)
- Custo > R$ 2.000/dia → avaliar freemium gate mais agressivo

---

## R3 — 🔴 Comms violam regulatório CVM / LGPD

**Probabilidade:** 2/5 (Lucas é CGA+OAB, baixa chance de erro próprio, mas risco em repost ou material terceiro)
**Impacto:** 5/5 (sanção CVM + dano reputacional + responsabilização PF de Lucas)
**Severidade:** 🔴 **10** (mas PF em risco → tratamento crítico)

**Trigger signals:**
- Post LinkedIn/Twitter mostra número de performance ou "retorno" implícito
- Case com beta tester cita cliente 3P sem autorização (Chinese Wall)
- Email marketing para base LPA Wealth mencionar Muuney.hub sem opt-in explícito
- Jornalista pede "rentabilidade típica" e resposta é genérica demais

**Mitigação pré-launch:**
- Review regulatório de **100% dos drafts T8** (LinkedIn, Twitter, IG, email, press release) antes de publicar — Lucas faz o check próprio como CGA+OAB
- Disclaimer padrão em qualquer material público: _"Este conteúdo é informacional e não constitui recomendação de investimento. CGA CVM Nº [preencher] / OAB [preencher]."_
- Checklist pré-publicação (T8 seção "Checklist"): sem número de performance, sem promessa de retorno, sem nome de cliente 3P, sem dado sensível
- Separar base de email: `hub@muuney.com.br` (Muuney.hub) nunca mistura com `lpa@lpawealth.com.br` (clientes LPA)
- Todo depoimento de beta tester tem autorização por escrito (forma simples: reply de email "autorizo uso do meu nome + foto")

**Contingência se ocorrer:**
1. **Detecção:** alerta do próprio Lucas ou feedback externo (amigo advogado, comunidade)
2. **Remoção < 30 min:** apagar post / retirar anúncio / suspender sequence email
3. **Comunicação:** post de correção em 24h _"Ajustamos o conteúdo anterior para clareza"_ (sem se autoincriminar)
4. **Documentação interna:** registrar em `ops/lgpd-log.md` ou `ops/cvm-log.md` — incidente + ação + aprendizado
5. **Se incidente material:** consultar Pimentel (sócio LPA) para alinhar resposta regulatória

**Escalonamento:**
- CVM ou ANPD notifica → responder em < 48h com ajuda jurídica (próprio Lucas + Pimentel)
- Mídia pega caso → resposta institucional pronta (rascunho em `ops/crisis-response.md`)

---

## R4 — 🟠 Beta churn antes do D-day

**Probabilidade:** 4/5 (4 testers convidados, apenas Aruan ativo, 0 feedback — padrão já indica baixa ativação)
**Impacto:** 3/5 (compromete cases/depoimentos no launch, mas não compromete launch técnico)
**Severidade:** 🟠 **12**

**Trigger signals:**
- Nenhum check-in de beta tester após templates T2 enviados (D-10 → D-8)
- Supabase `hub_feedback` permanece zerado
- Queries de uso (T1) mostram 0 sessions nos 7 dias pré-launch
- Senha nunca configurada (auth.users `last_sign_in_at` null)

**Mitigação pré-launch (D-10 → D-5):**
- Enviar templates T2 para os 4 beta testers hoje (D-11) — WhatsApp preferencial, fallback email
- Se Aruan + 1 respondem: coletar 1 depoimento cada + autorização de uso para D-day
- Recrutar 3–5 novos beta testers via T9 (cold LinkedIn + indicações Pimentel) — meta: ao menos 2 ativos até D-4
- Oferecer incentivo: "Beta Founding AAI" badge + 3 meses Pro grátis pós-launch (tier=pro manual até Jul)
- Se D-4 ainda tem < 2 ativos → comms D-day pivota para "estreia com beta seleto, abrindo hoje para todos" (sem depoimento, narrativa construção)

**Contingência se ocorrer (zero tester ativo):**
1. **Launch sem depoimento:** remover seção "Cases" da landing + comms (não inventar quote)
2. **Narrativa pivot:** "Construído por um CGA+OAB, validado em 18 dias de beta fechado — agora aberto para o mercado"
3. **Post-launch recovery:** primeiros 50 signups viram "early adopters" com badge próprio → source orgânico de depoimento nas primeiras 2 semanas
4. **Lição:** documentar em `ops/week-review.md` e recalibrar aquisição B2B direta

**Escalonamento:**
- Se D-1 tem 0 sessions em beta → Lucas posta _"Estou curioso: quem topa ser o primeiro AAI a testar antes de amanhã?"_ (mobiliza rede pessoal)

---

## R5 — 🟠 Dashboard hero quebra no D-day

**Probabilidade:** 3/5 (componente novo conforme T6, sem smoke test E2E ainda)
**Impacto:** 4/5 (primeira impressão pós-login; se crashar, taxa de bounce alta)
**Severidade:** 🟠 **12**

**Trigger signals:**
- Sentry `ErrorBoundary catch` em rota `/dashboard`
- `useDashboardKPIs` hook retorna erro em console
- Feedback widget: "tela branca após login"
- GA4 pageview `/dashboard` > mas `session_duration < 10s`

**Mitigação pré-launch:**
- Implementar T6 até **D-6 (Qui 23/Abr)**
- Smoke test dedicado (T3 seção 14) — 4 cenários: logado Pro, logado Free, logado Admin, mobile
- Wrap completo em `SectionErrorBoundary` (fallback: cards estáticos genéricos "Bem-vindo ao Hub")
- Se qualquer hook falhar, exibir skeleton indefinido + botão "Ir para Módulos" (rota `/fundos`)
- Feature flag (env var `VITE_DASHBOARD_HERO_ENABLED=true`) — permite rollback < 5 min via Vercel env update + redeploy
- Pre-render testing: 50 sessions internos (Lucas + Pimentel + Aruan) antes do D-day

**Contingência se ocorrer no D-day:**
1. **Rollback feature flag:** `VITE_DASHBOARD_HERO_ENABLED=false` + redeploy → versão anterior do dashboard (sem hero, mas estável)
2. **Banner interno:** "Estamos polindo o dashboard; enquanto isso, explore os módulos diretamente"
3. **Hot fix deploy:** Lucas corrige em < 2h + redeploy + re-habilitar flag
4. **Comunicação:** se ocorrer em 09:00 e só resolve 11:00, NÃO publicar posts LinkedIn no mesmo horário — esperar estabilidade

**Escalonamento:**
- > 1h sem resolver → publicar primeiro post LinkedIn com link direto para `/fundos` em vez de `/dashboard`
- Bug estrutural (não resolvível em 4h) → adiar comms agressivas para D+1, manter soft launch

---

## R6 — 🟠 Landing /hub não converte

**Probabilidade:** 3/5 (nova landing, sem A/B test histórico)
**Impacto:** 4/5 (signups < 50 em D+1 significa tração abaixo da projeção T7)
**Severidade:** 🟠 **12**

**Trigger signals:**
- GA4 `landing /hub` bounce rate > 80%
- Form signup abandona > 60% (view vs submit)
- D+1 signups < 20 (meta 50)
- Twitter/LinkedIn: comentários "não entendi o que é"

**Mitigação pré-launch:**
- Landing dedicada `/hub` com 4 seções claras: hero + 3 diferenciais + cases (se houver) + CTA signup (T11 seção "Landing updates pré-launch")
- Hero tagline (T11 seção 4): _"Dados CVM + BACEN em um só painel. Fundos, macro, crédito, ofertas — grátis para começar."_
- CTA principal acima da dobra: "Entrar grátis" (leva para /signup, não para waitlist)
- OG image otimizado (T4) para preview WhatsApp/LinkedIn
- Prova social: "4 AAIs testaram antes — [1 depoimento se disponível]" ou "Construído por CGA+OAB"
- Meta Pixel + GA4 eventos: `landing_view`, `cta_click_signup`, `signup_started`, `signup_completed` — para funnel analysis

**Contingência se ocorrer (conversão baixa):**
1. **D+1 análise:** Lucas verifica funnel GA4, identifica drop-off específico
2. **Hipótese + teste:** alterar 1 variável (headline OU CTA OU prova social) e deployar
3. **D+3 iteração:** se conversão < 3%, reescrever hero com ajuda IA + feedback de 5 amigos externos
4. **Plano B orgânico:** dobrar posts educacionais (não promocionais) — "thread: como usar dados CVM em 15 min" → linkar landing no final

**Escalonamento:**
- D+7 signups < 100 (meta 200) → revisar estratégia: é problema de posicionamento, oferta ou canal?
- D+14 < 300 → repensar ICP (pode não ser AAI, pode ser analista sell-side)

---

## R7 — 🟠 Sobrecarga operacional Lucas solo

**Probabilidade:** 4/5 (playbook T10 mapeia daily + weekly + incident, tudo em Lucas)
**Impacto:** 3/5 (erros operacionais acumulam, qualidade de resposta cai, burnout em 30d)
**Severidade:** 🟠 **12**

**Trigger signals:**
- Lucas tem < 4h/dia de foco disponível (LPA + família + launch)
- Backlog `ops/tickets.md` cresce mais rápido que resolve (> 5 tickets abertos há 3+ dias)
- Qualidade de resposta cai (templates copy-paste sem personalização)
- Sinais pessoais: cansaço, irritabilidade, sono ruim

**Mitigação pré-launch:**
- Automatizar tudo que puder: feedback widget → email → Lucas (sem checar Supabase manualmente)
- Templates prontos (T10 T1–T5) reduzem tempo de resposta para < 5 min/ticket
- Canva + prompts de IA para comms diárias (não escrever do zero)
- Pausar 1 rotina durante launch week (ex: competitor pulse Sexta) — retomar D+14
- Delegar para Pimentel (LPA side) qualquer review jurídico urgente — Lucas só faz regulatório crítico

**Contingência se ocorrer:**
1. **Semana de launch (26–30/Abr):** Lucas bloqueia calendar 08:00–18:00 para Muuney.hub, LPA só emergência
2. **Se acumular:** reduzir escopo de comms (1 post LinkedIn em vez de 3), não responder press não-solicitado
3. **Pós-launch (Mai):** avaliar contratar part-time CS freelancer R$ 1.500/mês para T1 support (templates prontos)
4. **Pré-alertas pessoais:** Lucas checa próprio energy level toda Segunda — se < 6/10, reduzir ambição da semana

**Escalonamento:**
- Burnout sinalizado (Lucas esquecer de dormir, deixar refeições) → pausa obrigatória 48h + Pimentel assume comunicação básica
- Churn de usuário > 30% em D+7 → provavelmente causa é qualidade CS, contratar ajuda imediata

---

## R8 — 🟡 SEO indexação lenta

**Probabilidade:** 4/5 (12 URLs novas, Google demora 7–14 dias para indexar, IndexNow ajuda Bing mas não Google)
**Impacto:** 2/5 (tráfego orgânico é canal de médio prazo, não D+7 crítico)
**Severidade:** 🟡 **8**

**Trigger signals:**
- Google Search Console: URLs "Descoberto — não indexado" após 7d
- `site:muuney.com.br/hub` retorna 0 resultados em 10d
- Organic traffic < 5/dia após 14d

**Mitigação pré-launch:**
- Sitemap.xml atualizado com 12 URLs novas + submit Google Search Console D-day
- IndexNow ping para Bing/Yandex (já implementado via Edge Function `submit-indexnow`)
- Internal linking: cada landing aponta para 2+ módulos; cada módulo aponta para ≥ 1 lâmina; blog aponta para hub
- Schema markup: FAQ Schema (já implementado), `Article` nos posts de blog
- 3 backlinks de qualidade (LinkedIn post + 1 parceria + 1 press) nas primeiras 2 semanas

**Contingência (aceitar):**
- Tráfego orgânico é meta Q3/Q4 2026, não D+30
- Substituir volume orgânico por SEM (Google Ads) se precisar acelerar — orçamento R$ 500/mês experimental em Mai

**Escalonamento:**
- Se após 21d ainda 0 indexação → auditoria técnica (robots.txt, canonical tags, sitemap status) + help Google

---

## R9 — 🟡 Stripe não pronto quando beta pedir Pro pago

**Probabilidade:** 3/5 (deferred post-beta; Maio beta testers podem querer converter)
**Impacto:** 3/5 (perder conversões pagas, mas não urgente pois beta = free por design)
**Severidade:** 🟡 **9**

**Trigger signals:**
- 3+ beta testers pedem "como pago Pro?" em D+3
- Pedro/Aruan oferece "pagar antecipado" e não temos checkout
- Competidor libera feature paga similar primeiro

**Mitigação pré-launch:**
- Deixar `/upgrade` com banner "Beta grátis até 30/Mai, assinaturas abrem em Jun" (claro e positivo)
- Wishlist temporária: botão "Quero ser avisado quando abrir" → salva em Supabase `newsletter_subscribers` com tag `upgrade_waitlist`
- Código Stripe Checkout já implementado (T10 seção "Stripe"); falta só setup manual no Dashboard

**Contingência se demanda aumentar:**
1. **Se 10+ pedem pago em Mai:** acelerar setup Stripe (2h Lucas) — criar conta, price IDs, secrets, deploy
2. **Soft launch Stripe:** abrir para wishlist primeiro (email manual com link checkout), medir conversão antes broadcast
3. **Comunicar claramente:** "Assinatura Pro abre em [DATA] — R$ 49/mês, R$ 490/ano, cancela quando quiser"

**Escalonamento:**
- Se grande conta (escritório AAI 20 usuários) quer pagar em Mai → processar via PIX manual + nota manual + ativar tier=pro na mão até Stripe pronto

---

## R10 — 🟡 Press release sem eco

**Probabilidade:** 4/5 (jornalistas têm caixa lotada, fintech brasileira é competitivo)
**Impacto:** 2/5 (press é nice-to-have, não crítico para launch)
**Severidade:** 🟡 **8**

**Trigger signals:**
- 0 jornalistas respondem em 7d pós envio
- 0 menções `"muuney"` em Google News após 14d

**Mitigação pré-launch:**
- Lista qualificada de 10–15 jornalistas (fintech/investimentos/BR): Pipeline Valor, BP Money, Brazil Journal, Neofeed, Startups, Exame Invest, Bloomberg Linea BR
- Pitch personalizado por jornalista (1 parágrafo contexto do beat + relevância Muuney.hub)
- Release de 300 palavras (T8) + 3 bullets diferenciadores + convite entrevista Lucas
- D-3: enviar embargo release para 3 jornalistas de confiança (se houver) + releases padrão restante no D-day
- Pitchar em comunidades: LinkedIn, Twitter fintech BR, Startups.com.br

**Contingência (aceitar):**
- Press é canal lento; focar em posts próprios + partnerships
- Substituto: entrevistas podcasts (Market Makers, Braincast, InfoMoney Podcast) — menor custo, maior conversão

**Escalonamento:**
- Se zero eco em 14d → pivotar 100% para conteúdo próprio + relacionamento 1:1 com creators financeiros

---

## R11 — 🟡 Competidor copia feature em 30d

**Probabilidade:** 2/5 (grandes têm roadmaps próprios; pequenos podem copiar)
**Impacto:** 3/5 (se Toro/BTG Digital copia FIDC radar, diferencial se esvazia)
**Severidade:** 🟡 **6**

**Trigger signals:**
- Lançamento público por competidor com tema similar
- Post LinkedIn viral competidor com keywords Muuney
- Cliente menciona "vi isso no [concorrente]"

**Mitigação (aceitar parcialmente):**
- **Vantagem competitiva sustentável:** profundidade (73 séries BACEN + FIDC+FII+FIP + 29k fund classes RCVM 175 + Fund Score™ percentile-based) é difícil replicar em 30d
- **Speed to market:** Lucas deploya feature em 48h, grandes levam 90+ dias
- **Focus:** AAIs e analistas sell-side são nicho que grandes players ignoram (lucrativo mas não massivo)
- Documentar cada feature lançada (changelog público em `/changelog`) → posicionar velocidade

**Contingência:**
- **Se copiam FIDC radar:** lançar FII DY ranking + Ofertas heatmap no mês seguinte (T10 roadmap Mai)
- **Se lançam preço agressivo:** não entrar em guerra de preço; reforçar diferencial regulatório + profissional
- **Se parceria (XP + Bloomberg):** responder com parceria ANBIMA ou B3 (longo prazo, Q3 2026)

**Escalonamento:**
- Competidor direto com > 10x budget → repensar posicionamento (B2B white label, API-first, niche por vertical AAI)

---

## R12 — 🟡 PR negativo fintech BR atinge Muuney por proximidade

**Probabilidade:** 2/5 (histórico BR: C6, XP, Banco Inter tiveram crises; contágio reputacional é real)
**Impacto:** 3/5 (usuário novo associa "fintech BR = risco" por 1–2 semanas)
**Severidade:** 🟡 **6**

**Trigger signals:**
- Manchete negativa grande em fintech BR (ex: vazamento, crise regulatória, fraude)
- Menções sociais "não confio em fintech" aumentam
- Drop de signups correlacionado com notícia externa

**Mitigação (plano comms pronto):**
- Rascunho pronto de post diferenciador: _"Somos uma fintech de dados — não custodiamos dinheiro, não damos recomendação, não dependemos de tesouraria. Somos uma biblioteca de dados públicos CVM + BACEN, organizada."_
- Manter disclaimer regulatório em toda comms → reforça posicionamento institucional
- Responsabilizar: CGA+OAB visíveis no site (rodapé + about page) → sinaliza rigor regulatório
- Não comentar publicamente crise de concorrente (nunca) — sempre respeitoso

**Contingência se atingir:**
1. **24h após notícia:** post próprio de contexto (não ataque, não defesa — informação)
2. **Email para base:** reforçar transparência: onde dados vêm, o que não fazemos, LGPD
3. **Pausar mídia paga:** não anunciar em janela de 48h para não associar
4. **Retomar:** quando ciclo notícia esfriar, voltar comms normal

**Escalonamento:**
- Crise regulatória sistêmica (ex: BCB anuncia restrição a dados abertos) → consulta jurídica urgente + plano B de fonte de dados

---

## Monitoramento contínuo

### Dashboard de riscos (criar `ops/risk-dashboard.md`)

Revisar semanalmente (Seg, durante weekly review T10):

| # | Risco | Status pré-launch | Status D+7 | Status D+30 |
|---|-------|-------------------|------------|-------------|
| 1 | Edge functions 500 | | | |
| 2 | Viralização | | | |
| 3 | Regulatório | | | |
| 4 | Beta churn | | | |
| 5 | Dashboard hero | | | |
| 6 | Landing conversão | | | |
| 7 | Sobrecarga Lucas | | | |
| 8 | SEO | | | |
| 9 | Stripe | | | |
| 10 | Press | | | |
| 11 | Competidor | | | |
| 12 | PR negativo | | | |

**Legenda status:** 🟢 sob controle | 🟡 monitorar | 🟠 atenção | 🔴 escalado

### Métricas de early warning (checar toda manhã)

- Sentry errors last 24h (target < 5)
- Supabase API requests % (target < 70%)
- Vercel bandwidth % (target < 60%)
- Feedback widget messages last 24h (0 = ok ou preocupante?)
- GA4 signups last 24h (target incremental)

---

## Comunicação de crise — templates prontos

### Template 1 — Status page banner (bug geral)

```
⚠️ Estamos investigando um problema em [módulo]. Previsão de resolução: [X min]. Acompanhe em /status.
```

### Template 2 — LinkedIn/Twitter post (incidente técnico)

```
Transparência total: tivemos um incidente em [módulo] às [HH:MM]. Resolvido em [X min]. Impacto: [N] usuários afetados.

Pós-mortem público em 48h. Se você foi afetado e não voltou, me responda aqui.
```

### Template 3 — Email para base (incidente maior)

```
Assunto: Incidente hoje em [módulo] — resumo e próximos passos

Oi [nome],

Hoje às [HH:MM] tivemos [descrição breve]. O problema foi resolvido às [HH:MM].

O que aconteceu: [1 frase técnica simples]
Impacto: [X usuários afetados durante Y minutos]
Ação: [o que fizemos + o que vamos fazer para prevenir]

Se alguma coisa ficou estranha no seu lado, me responda direto.

Obrigado pela paciência,
Lucas
```

### Template 4 — Resposta a crítica pública

```
Oi [nome], obrigado pelo toque direto. Você tem razão sobre [ponto específico]. Já ajustei/já estou ajustando. Pode me mandar mais detalhes por DM? Quero resolver antes que afete mais gente.
```

**Princípios crise comms:**
1. **Transparência > spin** — admitir erro cedo reduz dano
2. **Dados > adjetivos** — "2.3% dos usuários afetados por 14 minutos" > "pequeno grupo por pouco tempo"
3. **Ação > desculpa** — o que está sendo feito concreto
4. **Canal próprio primeiro** — post próprio antes de resposta a outros
5. **Sem ataque** — nunca culpar Supabase, Vercel, CVM publicamente

---

## Pendências — Lucas inputs

1. **Qual é o budget de emergência disponível** para upgrade Supabase (US$ 25 → US$ 599) ou CS freelancer (R$ 1.500/mês) se precisar escalar rápido?
2. **Quem é o contato backup** se Lucas estiver indisponível em incidente crítico (Pimentel? Aruan? Nenhum)? Precisamos de 1 deputy mesmo que informal.
3. **Press list qualificada existe?** Se sim, onde (Notion? Planilha?). Se não, vale montar nesta semana?
4. **Pode publicar changelog público em `/changelog`** (argumento: velocity > copycat) ou preferimos manter changelog privado?
5. **Em caso de incidente regulatório (CVM/ANPD notificação)**, Pimentel tem banda para apoiar em < 48h ou vale ter outro advogado backup?
6. **Feature flag para dashboard hero** — OK configurar via env var Vercel (rollback em 5 min) ou prefere deploy guard com branch protection?
