# T10 — Ops Playbook Muuney.hub (D+0 → D+30)

**Objetivo:** documentar rotinas diárias / semanais / incidentais que o Lucas executa sozinho nos primeiros 30 dias pós-launch, de forma que uma futura contratação part-time (CS/ops) possa absorver o playbook sem re-inventar o processo.
**Janela de aplicação:** 30/Abr → 30/Mai/2026.
**Premissa de capacidade:** Lucas dedica ~2-3h/dia nesse primeiro mês (outra parte: LPA Wealth + family office).

---

## 1. TL;DR (Rule of 3)

- **Daily ritual 30 min:** Sentry + Supabase logs + feedback inbox + 2-3 DMs de resposta (08:30 ou 18:30).
- **Weekly review 90 min (segundas 10h):** métricas + feedback qualitativo + decisão da semana.
- **Incident playbook:** 6 cenários mapeados com runbook de 3 passos cada.

---

## 2. Daily routine

### 2.1 Morning check (sugerido 08:30-09:00, 20 min)

1. **Sentry dashboard** (Issues → Production): novos erros nas últimas 24h? Triage rápido:
   - Erro com ≥3 users afetados → issue criada em backlog + investigar
   - Erro com ≥10 users → hotfix mesmo dia (prioridade sobre outras tasks)
   - Erro isolado (1 user) → monitorar, não agir ainda
2. **Supabase Dashboard** → Logs (Edge Functions): olhar se algum endpoint teve >5% erro rate nas últimas 24h. Alertar se sim.
3. **hub_feedback table:**
```sql
SELECT category, rating, message, page, section, created_at
FROM hub_feedback
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;
```
4. **Analytics (GA4 / Meta Pixel):** tab rápido — sessões, usuários ativos, bounce rate. Anomalia? Investigar.
5. **Uptime check:** abrir muuney.app + /hub/macro + /fundos em 3 navegadores. Ok? Segue dia.

**Critério de ativação:** qualquer ponto acima vermelho → abrir plano de ação imediato (seção 4).

### 2.2 Mid-day check (sugerido 13:00-13:15, 10 min)

1. **Inbox comms:**
   - Email lucas@muuney.com.br: respostas de beta testers, bug reports, curiosos
   - LinkedIn DM: novos interessados
   - WhatsApp: comms urgentes de clientes LPA (não necessariamente hub)
2. **Triage rápida:** responder em ≤2h se for support crítico, em 24h se for outreach.
3. **Novos signups:** rápido olho em `hub_user_tiers` recentes pra identificar perfis interessantes (pra eventualmente pedir feedback ativo).

### 2.3 Evening check (sugerido 18:30-19:00, 20 min)

1. **Sentry rerun:** erros do dia consolidados. Triagem final.
2. **Feedback widget:** se alguém reportou bug à noite, responde no dia seguinte (não no evening).
3. **Métricas do dia:**
   - Novos signups
   - Novas sessões
   - Pages/session média
   - Top módulo acessado
4. **Planejar amanhã:** 1-3 tasks prioritárias anotadas em CLAUDE.md ou TODO pessoal.

---

## 3. Weekly review (segundas 10:00-11:30)

### 3.1 Agenda sugerida

**Minuto 0-15 — Métricas quantitativas:**
- Signups D-7 → hoje (total + delta semana anterior)
- Retention D1/D7 (se já tem dados suficientes)
- Módulos mais acessados (ranking)
- Feedbacks submetidos (contagem + rating médio)
- Bugs reportados vs fixados
- Edge Functions latency p95

**Minuto 15-35 — Feedback qualitativo:**
- Ler ou rever todos os feedbacks da semana (widget + email + DM)
- Clusterizar em 3-4 temas (bugs, UX, dados, features pedidas)
- Identificar pattern: algo aparece ≥3 vezes = oportunidade real

**Minuto 35-55 — Ops & infra:**
- Supabase quota (auth + database + storage + edge function invocations)
- Vercel bandwidth
- Sentry errors/mês cumulativo
- Custos (mesmo zero enquanto em free tier)

**Minuto 55-75 — Decisões da semana:**
- 1-2 bugs a priorizar (roadmap sprint)
- 1 quick win UX a implementar
- 1 experiment a tentar (comms, pricing narrative, canal outbound)

**Minuto 75-90 — Comms & Growth:**
- 1-2 posts conteúdo a publicar na semana
- Outreach novo (AAIs novos a contactar)
- Update em waitlist/newsletter (se houver cadência)

### 3.2 Output

Arquivo semanal `ops/week-YYYY-WW-review.md` com:
```
# Week YYYY-WW (DD/MM → DD/MM)

## Métricas
[tabela]

## Top 3 aprendizados
1. ...
2. ...
3. ...

## Decisões da semana
- [ ] ...

## Bugs priorizados
- [ ] ...

## Feedback destaque (quote + autor)
> ...

## Ação pro próxima semana
1. ...
```

Arquivar em GitHub repo ou Notion pra histórico.

---

## 4. Incident playbook (6 cenários)

### 4.1 Cenário: "App não carrega (500/504 em /hub/*)"

**Sinais:** Sentry spike, Vercel dashboard error rate >2%, DMs de usuários "hub caiu"

**Runbook:**
1. Verificar último deploy Vercel (últimas 24h?). Se sim, `vercel rollback` imediato.
2. Verificar Supabase status page (status.supabase.com). Se incident upstream → aguardar + comunicar.
3. Se rollback não resolver: colocar banner "manutenção" em muuney.com.br (landing estática não depende do hub), comunicar em X/LinkedIn.

**Timeframe:** resolução em ≤30 min (rollback) ou ≤2h (hotfix).

**Comms:**
- D+0 até 15min: silêncio, investigando
- 15-30min: post X/LinkedIn "hub em manutenção, investigando"
- 30min-2h: update de status
- Resolvido: post "tudo normalizado. O que deu: [explicação breve]"

### 4.2 Cenário: "Edge Function específica retornando 500"

**Sinais:** logs hub-cvm-api (ou outra) com 500 em rate >10% requests

**Runbook:**
1. Olhar logs do endpoint via MCP Supabase `get_logs` (últimos 30min).
2. Identificar root cause: erro SQL, timeout, payload malformed, schema drift.
3. Hotfix local + deploy via MCP `deploy_edge_function` (nova versão).
4. Se não der pra fix em <30min: rollback Edge Function para versão anterior (não há "vercel rollback" pra Edge Function — precisa redeploy versão anterior via MCP).

**Comms:**
- Só comunica se impactar ≥20% dos usuários ativos (senão, silencioso).

### 4.3 Cenário: "Supabase auth quota estourada"

**Sinais:** novos signups falhando com "email rate limit exceeded", logs auth.users com throttle.

**Runbook:**
1. Dashboard Supabase → Auth → Rate Limits: checar se default (30 emails/hora tier free) foi atingido.
2. Temporariamente desabilitar email confirmation em Supabase Auth settings (usuário cadastra sem verificar email). Documentar ativação posterior.
3. Se volume sustentado: upgrade Supabase Team ($25/mês) → 100 emails/hora. Decisão de $/ROI.
4. Longo prazo: configurar SMTP próprio (Resend) via custom SMTP no Supabase.

**Comms:**
- "Signup temporariamente liberado sem email de confirmação" — não comunicar publicamente exceto se bugfix incidente crítico.

### 4.4 Cenário: "Bug LGPD detectado (user A vê dados user B)"

**Sinais:** DM de usuário relatando ver dados que não são dele, report via widget com categoria "bug" + menção a dados pessoais.

**Runbook:**
1. **STOP imediato:** rollback deploy pra versão estável conhecida. Sem negociação.
2. Investigar root cause: provável falha RLS, JWT leak, query sem filtro user_id.
3. Comunicar usuário afetado pessoalmente ("identificamos o issue, aqui está o que faremos").
4. Notificar ANPD em 2 dias úteis (Art. 48 LGPD) — email formal.
5. Auditoria completa pre-relaunch: RLS em TODAS tabelas com dados pessoais, testes automáticos de isolamento.
6. Comunicado público (quando já corrigido): transparente + factual.

**Não fazer:**
- Negar
- Minimizar
- Demorar pra comunicar

### 4.5 Cenário: "Viralização positiva imprevista (spike usuários)"

**Sinais:** Vercel analytics spike, Sentry sem erros mas latency aumentando, signups ≥10x normal.

**Runbook:**
1. Monitor Supabase quotas em tempo real (auth, database connections).
2. Se database connections saturar (free tier = 60): upgrade Supabase Team ($25/mês) em 5 min via dashboard.
3. Edge Functions têm auto-scaling Cloudflare — normalmente não é gargalo.
4. Vercel bandwidth monitoring: free tier 100 GB/mês. Se atingir, upgrade Pro.
5. Comunicação: post público agradecendo, prepare next content piece pra manter momentum.

**Risco real:** pessoa famosa compartilha → 10k visitantes em 1h → database cai → experiência ruim → backlash.

### 4.6 Cenário: "Data quality complaint"

**Sinais:** feedback "esse dado tá errado", usuário compara com outra fonte e aponta discrepância.

**Runbook:**
1. Responder em ≤24h: agradecer, pedir fonte comparativa (print, URL).
2. Investigar:
   - Diferença metodológica (ex: PL real time vs fechamento anterior)?
   - Bug no ETL (batch pulou, coluna errada)?
   - Atraso na ingestão (BACEN/CVM ainda não publicou)?
3. Se bug real: fix na próxima janela de ingestão (pg_cron jobs). Comunicar de volta em ≤48h.
4. Se diferença metodológica: tooltip no dado explicando fonte/momento da atualização. Inclui no FAQ.
5. Se dado faltando estruturalmente (ex: taxa_adm RCVM 175): disclaimer explícito "dado indisponível por limitação CVM, buscando parceria ANBIMA".

---

## 5. Customer support runbook

### 5.1 Canais de entrada

| Canal | SLA resposta | Observações |
|---|---|---|
| Email lucas@muuney.com.br | 24h úteis | Primary para qualquer issue formal |
| Widget feedback in-app | 48h | Envia pra hub_feedback, Lucas revê daily |
| LinkedIn DM | 48h | Profissional, network-building |
| Twitter DM / @menções | 24h | Público, reputação |
| WhatsApp (se der número) | 12h | Só para beta testers/VIPs |

### 5.2 Templates de resposta

**T1: Reportou bug**
```
Oi [nome],

Valeu por reportar! Já criei ticket interno e estou investigando.

[Se for fix rápido]: deploy saindo em [X h/dias]. Te aviso quando cair.
[Se for complexo]: preciso de mais detalhes — print da tela, horário 
aproximado, se acontece sempre ou intermitente.

Qualquer coisa me avisa.

Lucas
```

**T2: Pediu feature**
```
Oi [nome],

Anotei a sugestão. Faz muito sentido no contexto [de X / do Y uso].

[Se já está no roadmap]: tá previsto para [semana/mês]. Te aviso quando 
cair.
[Se não está]: vou considerar. Hoje to priorizando [A, B, C] — se 
outros 2-3 AAIs pedirem a mesma coisa, subo no roadmap.

Grande abraço,
Lucas
```

**T3: Crítica / insatisfeito**
```
Oi [nome],

Obrigado por reservar tempo pra escrever. Prefiro crítica direta do 
que silêncio.

[Espelhar o que ele disse]: "você sentiu que [X]".

[Resposta honesta]: 
- Se é fair crítica: "concordo, vou ajustar."
- Se é mal entendido: "o que quis dizer com [feature] é [Y]. Faz 
sentido? Se ainda não funciona pra você, me fala o que faltou."

Se topar, pode me ligar 15 min? Prefiro entender ao vivo.

Abraço
```

**T4: Pedido de upgrade antecipado**
```
Oi [nome],

Durante beta é tudo liberado (Pro incluído). Quando ativar cobrança, 
o acesso se mantém gratuito até fim do mês em curso.

Grande abraço
```

**T5: "Como compartilho com um colega?"**
```
Oi [nome],

Valeu demais! Melhor forma é:
- manda muuney.app pra ele + pede pra usar "Primeiro acesso" com 
email que ele usa no trabalho
- ou me manda o nome + email e eu libero acesso direto (tier beta pro)

Abraço
```

### 5.3 Pasta de tickets (pessoal)

Se não tiver helpdesk (Zendesk é caro), sugere manter `ops/tickets.md`:

```
## 2026-04-30

**Ticket #1** — João Silva (joao@x.com)
Canal: feedback widget
Categoria: bug
Reportado: "FIDC X mostra rentabilidade diferente da ANBIMA"
Status: investigando
Next: comparar com ANBIMA fonte, revisar ingest FIDC

---

**Ticket #2** — ...
```

---

## 6. LGPD operations

### 6.1 Rotinas mensais

1. **Audit RLS:** 1x/mês, usar `select_rls_policies` no Supabase e confirmar que tabelas com dados pessoais têm RLS ativo.
2. **Backup verification:** garantir Supabase automatic backup está funcionando (dashboard → Database → Backups).
3. **Data retention:** deletar usuários que pediram deleção em ≤30 dias (ainda não aconteceu, mas procedimento).

### 6.2 Direitos do titular (LGPD Art. 18)

**Pedido de acesso (confirmação + acesso aos dados):**
Resposta em até 15 dias úteis. Query:
```sql
SELECT * FROM auth.users WHERE email = 'xxx';
SELECT * FROM public.hub_user_tiers WHERE user_id = (SELECT id FROM auth.users WHERE email = 'xxx');
SELECT * FROM public.hub_feedback WHERE user_id = ...;
-- ...demais tabelas com user_id
```
Export pra CSV/JSON, enviar por email cifrado ou link protegido.

**Pedido de correção:** update direct via admin.
**Pedido de anonimização:** update `auth.users.email` para placeholder + zerar PII.
**Pedido de eliminação:** cascade delete via SQL (respeitando FK + RLS). Documentar o ato.
**Pedido de portabilidade:** mesmo export do pedido de acesso.

### 6.3 Log de tratamento

Criar tabela `lgpd_requests` se ainda não existe:
```sql
CREATE TABLE lgpd_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  email text not null,
  request_type text check (request_type in ('access', 'correction', 'anonymization', 'deletion', 'portability')),
  received_at timestamptz default now(),
  completed_at timestamptz,
  evidence_url text,
  notes text
);
```

---

## 7. CVM compliance operations

### 7.1 Disclaimer mandatório

Todas páginas com dados de fundos/ofertas/indicadores devem ter, em rodapé ou modal:
```
As informações apresentadas são baseadas em dados públicos da CVM, B3 e BACEN, 
destinadas exclusivamente a fins informativos e educacionais. Não constituem 
recomendação de investimento. Consulte seu assessor autônomo ou gestor qualificado 
antes de tomar decisões de investimento. Rentabilidade passada não é garantia de 
rentabilidade futura. Resolução CVM 19/2021.
```

Componente `CVMDisclaimer.tsx` (se ainda não existe) deve ser incluído em:
- Landing pages de módulos
- Lâminas de fundo (FundLamina, FidcLamina, FiiLamina)
- Página de ofertas públicas
- Footer global do hub

### 7.2 Comunicação pública

Ao fazer posts sobre dados (LinkedIn, Twitter, email), sempre adicionar no final:
> "Dados: BACEN/CVM/B3. Informativo — não recomendação de investimento."

### 7.3 Rotina mensal

- Review de 5-10 posts publicados no mês
- Confirmar que não há em nenhum: recomendação explícita de compra/venda, comparação que sugere superioridade, promessa de rentabilidade

---

## 8. Infrastructure ops

### 8.1 Deploys

- **Frontend (Vercel):** auto-deploy em push para `main`. Previews em PRs.
- **Edge Functions:** deploy manual via MCP Supabase após push (coordenar com deploy frontend se tem breaking change).
- **Migrations (Supabase):** `apply_migration` via MCP, nunca editar schema direto no dashboard (perde rastreabilidade).

### 8.2 Monitoring (ferramentas integradas)

| Camada | Ferramenta | Alert config |
|---|---|---|
| Frontend errors | Sentry | New issue → email Lucas |
| Backend errors | Supabase logs + Sentry server-side futuro | Manual review daily |
| Uptime | Vercel auto + manual check | Slack/email webhook (free tools) |
| Analytics | GA4 + Meta Pixel | Review weekly |
| Database health | Supabase dashboard | Manual review weekly |

### 8.3 Costs monitoring

Review mensal (1º de cada mês):
- Vercel usage: bandwidth (limite 100 GB free)
- Supabase usage: database size (limite 500 MB free), auth MAU (limite 50k free)
- Sentry usage: errors (limite 5k free), replays (limite 50 free)
- Vercel/Supabase free → upgrade decision:
  - DB >400 MB → Team $25/mês
  - Auth MAU >40k → Team $25/mês
  - Bandwidth >80 GB → Pro $20/mês Vercel

---

## 9. Cadência de comms contínua

| Frequência | Canal | Conteúdo |
|---|---|---|
| Diária | Widget feedback reply (se houver) | Reply manual Lucas |
| 2-3x/sem | LinkedIn | 1 post educacional + 1 update produto + 1 soft engagement |
| Semanal | Newsletter (se ativar Resend) | Review da semana + módulo destaque |
| Mensal | Newsletter analítica | KPI + learnings |
| Mensal | LPA Wealth clientes | Relatório macro + movimentos notáveis (via LPA) |

---

## 10. KPIs que Lucas deve olhar sempre (cheat sheet)

**Daily:**
- Novos signups (target: ≥2/dia após D+7)
- Erros Sentry (target: 0 novos críticos)
- Feedback widget submissions (target: ≥2/semana pós-D+7)

**Weekly:**
- Retention D1, D7 (target: 40%, 20% respectivamente)
- Top 3 módulos acessados (track)
- Feedback rating médio (target: ≥4/5)
- Latency p95 Edge Functions (target: <1.5s)

**Monthly:**
- Total signups acumulado
- Pro conversion rate (quando Stripe ativar)
- MRR (quando Stripe ativar)
- Churn

---

## 11. Escalation matrix (quando decidir contratar ajuda)

| Milestone | Ação |
|---|---|
| ≥500 usuários ativos semanais | Considerar freelance CS (part-time, 10h/sem) |
| ≥100 Pro pagantes | Contratar support especialista (stack financeiro) |
| ≥500 Pro pagantes | Time dedicado: 1 dev + 1 CS FT |
| Receita mensal ≥R$20k | Considerar CTO fracionário |

---

## 12. Arquivos ops a manter

Criar pasta `ops/` no repo ou Notion:

- `ops/daily-log.md` — diário do Lucas, append-only, 2-3 linhas/dia
- `ops/tickets.md` — todos support tickets com timeline
- `ops/week-YYYY-WW-review.md` — review semanal (aprendizados, decisões, próximos passos)
- `ops/incidents.md` — qualquer incident (mesmo resolved) pra referência futura
- `ops/lgpd-log.md` — solicitações LGPD recebidas e respondidas
- `ops/costs.md` — tracking mensal de gastos infra

---

## 13. Perguntas pendentes pro Lucas

1. **Você tem ferramenta de email marketing ativa (Resend, Mailchimp)?** Se não, Resend precisa ser setup ASAP (T8 comms depende). 
2. **Tem alguma política de SLA pública pra clientes LPA Wealth?** Se sim, alinhar SLA Muuney na mesma linha (resposta <24h p.ex.).
3. **Quer que eu monte template de newsletter (conteúdo recorrente)?** 4 posts/mês via automação Resend + trigger Claude.
4. **Quer documento complementar de LGPD Playbook?** (T12 ou separado — detalhando processos + RLS audit queries). Acho que sim mas esse arquivo aqui já cobre a essência.
5. **Quais tabelas do Supabase você considera crítico ter backup manual adicional (além automatic)?** Recomendação: auth.users + hub_user_tiers + hub_feedback + profiles.
6. **Tem plano de contingência caso Anthropic/Claude fique indisponível?** Várias automações (blog publisher, creative producer, weekly reports) dependem. Sugestão: humans-in-the-loop fallback documentado.
