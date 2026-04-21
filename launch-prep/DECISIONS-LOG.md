# Muuney.hub — Decisions Log

**Última atualização:** 21/Abr/2026 (D-9) — 3ª rodada (Stripe Live ativação + ES256 fix)
**Status:** respostas de Lucas às rodadas D-11→D-7 (bloqueantes launch) + D-4 (alto impacto) + D-9 (Stripe)

---

## 1. Decisões 🔴 Esta semana — REGISTRADAS

### Técnico

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 1 | 3 bugs hub-cvm-api v23 | **Procurar e corrigir** ✅ FECHADO 20/Abr/2026 | Bug-triage documentado + Lucas autorizou "Executar o fix completo" → migration `create_gestora_and_admin_rankings_rpcs` aplicada + hub-cvm-api v24 deployed (monthly_overview orderCol fix + catch block refactor) + smoke test 3/3 endpoints HTTP 200 em prod. Ver `ops/bug-triage.md` para detalhe. |
| 1.5 | Stripe Live ativação + ES256 JWT fix | **Ativar Live + redeploy verify_jwt=false** ✅ PARCIAL 21/Abr/2026 | Stripe Dashboard Passos 1-6 do runbook concluídos (conta BR Live, 2 prices, Billing Portal, webhook 5 events, 6 secrets Supabase, Edge Functions via MCP). ES256 JWT bug descoberto: platform verifier rejeita ES256 com UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM. Fix: stripe-checkout v2 + stripe-portal v2 redeployed via MCP com `verify_jwt=false` (funções já validam token internamente via SERVICE_ROLE_KEY). Smoke test E2E: checkout session create 200 OK + customer Live criado; payment finalization pendente (Lucas abandonou primeira session sem submeter cartão). Nova session cs_live_b1JYO... aguardando submissão de cartão real. Ver `ops/stripe-setup-runbook.md` + `ops/stripe-next-steps-post-smoke.md`. |
| 2 | Feature flag Dashboard Hero via env var Vercel | **OK** | Usar `VITE_DASHBOARD_HERO_ENABLED=true/false` — rollback < 5 min via Vercel env update + redeploy |
| 3 | Sentry conta + DSN | **OK** | Lucas cria conta Sentry esta semana, compartilha DSN via env var Vercel (`VITE_SENTRY_DSN`) |
| 4 | SITE_URL no Supabase Auth | **OK** | Confirmado `https://muuney.app` (não localhost) |
| 5 | Redirect URLs Supabase Auth | **OK** | Confirmado inclui `https://muuney.app/**` (wildcard) |

### Regulatório

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 6 | CGA CVM Nº + OAB Nº em disclaimer | **Retirar por agora** | Remover referência a registros profissionais no disclaimer padrão. Manter apenas texto genérico "informacional, não é recomendação de investimento". |
| 7 | Lucas nome completo para PR/bio | **Lucas Pimentel** | Usar "Lucas Pimentel" em press release, bio footer, landing about e assinatura comms |
| 8 | Changelog público em `/changelog` | **Confirmar com Lucas** (resposta ambígua) | Interpretação provisória: manter changelog público (argumento velocity > copycat). Confirmar antes de implementar. |

### Comms + Marcas

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 9 | Email sender oficial | **`contato@muuney.com.br`** | Usar `contato@muuney.com.br` como sender único (Resend + Supabase Auth templates). Simplifica infra: 1 inbox vs múltiplos senders. |
| 10 | IG handle `@muuney` | **Não respondido** | Pendente — confirmar se `@muuney` existe ou precisa criar/assegurar outra variação (`@muuneyhub`, `@muuney_oficial`). |
| 11 | Tagline hub consolidada | **"Dados CVM + BACEN em um só painel"** | Confirmado. Usar esta tagline em toda comm pública + og:description. |
| 12 | Headline + sub hero landing /hub | **Headline: "Inteligência de dados e Analytics do mercado financeiro"**. Resto mantém. | Atualizar landing `/hub` hero com nova headline. Sub-headline mantém a versão proposta em T11. |

### Beta

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 13 | Permissão contatar 4 beta testers via WhatsApp/email | **Sim** | Liberado usar templates T2 com os 4 testers (Aruan, Pedro + 2). Contatos assumidos atualizados — Lucas confirmou implicitamente. |
| 14 | Autorização nome + depoimento via reply email | **Sim** | Coletar depoimentos via email com reply `"Autorizo uso do meu nome + depoimento em materiais públicos do Muuney.hub"`. Arquivar reply como prova no Gmail/pasta legal. |

---

## 2. Atualizações derivadas das decisões

### 2.1 Disclaimer padrão (nova versão — retirar CGA+OAB)

**Versão pré-launch (sem registros pessoais):**
```
Conteúdo informacional baseado em dados públicos da CVM, BACEN e B3. 
Não constitui recomendação de investimento. Consulte seu assessor 
qualificado antes de decidir. Rentabilidade passada não garante 
rentabilidade futura.
```

Usar em:
- CVMDisclaimer component (hub footer)
- Todas as lâminas de fundo
- Rodapé de emails via Resend
- FAQ de respostas públicas
- Press release (substituir seção "CGA+OAB" por "equipe com background regulatório" ou omitir)

**Reverter decisão pós-launch se necessário:** registros profissionais reforçam confiança para público HNW; vale reavaliar em D+30.

### 2.2 Bio footer oficial

```
Lucas Pimentel
Fundador Muuney
muuney.app
```

Usar em:
- Press release (T8 seção 8)
- LinkedIn post assinatura
- Email broadcast assinatura
- Bio `/about` da landing

### 2.3 Sender email unificado

**Decisão operacional:** `contato@muuney.com.br` é único endereço de comunicação do Muuney.hub.

Configuração:
- **Resend domain verification:** verificar `muuney.com.br` no Resend (se ainda não) → criar sender `contato@muuney.com.br`
- **Supabase Auth email templates:** atualizar "From" para `contato@muuney.com.br`
- **Forward setup:** garantir que `contato@muuney.com.br` encaminha para Gmail Lucas pessoal (ou mailbox ativa Lucas)
- **Signature auto em replies:**
```
Lucas Pimentel
Muuney.hub
muuney.app
```

### 2.4 Landing /hub — headline atualizada

**Hero (novo):**
- Headline: **"Inteligência de dados e Analytics do mercado financeiro"**
- Sub-headline (manter): _"Dados CVM + BACEN em um só painel. Fundos, macro, crédito, ofertas — grátis para começar."_
- CTA primário (manter): "Entrar grátis" → `/signup`
- CTA secundário (manter): "Ver como funciona" → scroll para diferenciais

Atualizar:
- `src/pages/HubLanding.tsx` (se existir) ou equivalente
- OG title (T4) com headline nova
- Tagline `<meta name="description">` usar sub-headline

### 2.5 Feature flag Dashboard Hero (T6)

**Implementação:**

```ts
// src/pages/HubDashboard.tsx
const HERO_ENABLED = import.meta.env.VITE_DASHBOARD_HERO_ENABLED === "true";

export default function HubDashboard() {
  return (
    <Suspense fallback={<SkeletonPage />}>
      <div className="w-full px-4 py-6 md:px-8 md:py-8">
        {HERO_ENABLED ? <HubDashboardHero /> : <LegacyDashboardCards />}
      </div>
    </Suspense>
  );
}
```

**Vercel env var setup:**
- Production: `VITE_DASHBOARD_HERO_ENABLED=true` (ativar no D-1 após smoke test)
- Preview: `VITE_DASHBOARD_HERO_ENABLED=true` (testes internos)
- Rollback: flip para `false` + redeploy (5 min)

### 2.6 Beta testers — contato liberado

**Ação imediata (hoje 20/Abr):**
1. Enviar Template A WhatsApp (T2 seção 1) para os 4 testers que não logaram: Pedro Chacon, Pedro Ivo, Felipe Rodrigues, MMmath10
2. Enviar Template prioritário para Aruan (T2 seção 2) pedindo 3 respostas rápidas
3. Preencher tracking table (T2 seção 5) conforme respostas

**Autorização depoimento:**
- Se Aruan ou outro tester der feedback positivo, responder: _"[Nome], posso usar seu nome + essa frase em um post no LinkedIn sobre o launch do Muuney.hub dia 30/04? Se sim, só me responde com 'Autorizo'."_
- Arquivar replies em pasta Gmail `muuney/authorizations/`

---

## 3. Decisões 🟠 D-4 (Sex 24/Abr) — REGISTRADAS

### Operacional

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 15 | Contato backup se Lucas indisponível em incidente crítico | **Ninguém por agora** | Documentar single-point-of-failure (T10 + T12-R2). Em launch week (D-3→D+7), Lucas mantém WhatsApp ON 24/7. Playbook de incidente inclui "se Lucas offline > 2h → user-facing status page com `contato@muuney.com.br`, sem promessa de SLA". |
| 16 | Budget emergência (Supabase Pro US$ 25→599, CS freelancer R$ 1.500/mês) | **Sim** | Autorizado gatilhar upgrade Supabase Pro (US$ 25) se latência > 3s sustentada ou RLS policy alert. CS freelancer (R$ 1.500/mês) autorizado se volume suporte > 10 tickets/dia por > 3 dias. Registrar gastos como "Launch contingency" no controle financeiro. |
| 17 | Pausar 1 rotina durante launch week | **OK** | **Pausar:** `muuney-competitor-pulse` (Sex D-3→D+7) e `muuney-creative-producer` (Seg D+3). Manter: blog publisher (diário), growth dashboard (Seg), multichannel adapter (Seg). Retomar D+14. |
| 18 | Deputy regulatório Pimentel (< 48h) + backup advogado | **Sim** | Pimentel confirmado como escalation para CVM/ANPD (< 48h). Registrar em T10 crisis comms + T12-R3 como contato secundário. Reavaliar necessidade de advogado externo se demanda > 2h/semana Pimentel pós-launch. |

### Recrutamento

| # | Item | Decisão Lucas | Ação |
|---|------|---------------|------|
| 19 | Press list qualificada existe? | **Não existe — montar esta semana** | Agente monta lista nesta semana (D-10→D-5). Target: 30-50 contatos (jornalistas + newsletters + podcasters fintech BR). Entregável: `13-press-list-muuney-hub.md` com nome, veículo, contato, ângulo recomendado, histórico de cobertura. Deadline draft: D-6 (24/Abr Sex). Lucas valida D-5. |
| 20 | Cold outreach 30-40/semana viável sozinho? | **Não — precisa reduzir meta, só com ajuda** | Meta revisada: Lucas faz **10-15 outreach/semana pessoais** (qualidade > quantidade), agente produz **restante via templates personalizados** por persona (T9). Fluxo: agente gera 20 drafts/semana com contexto de cada prospect → Lucas revisa em batch 30min (seg de manhã) → envia via LinkedIn/email. Primeiro batch: semana D-10 → D-5. |

---

## 4. Atualizações derivadas (2ª rodada)

### 4.1 Launch week — pausa de rotinas

**Rotinas pausadas D-3 (27/Abr Seg) → D+7 (07/Mai Qua):**
- `muuney-competitor-pulse` (Sex 7h)
- `muuney-creative-producer` (Seg 11h)

**Comando sugerido:**
```bash
# via scheduled-tasks MCP (ou UI Cowork)
update scheduled_task muuney-competitor-pulse status=paused until=2026-05-07
update scheduled_task muuney-creative-producer status=paused until=2026-05-07
```

**Retomada:** D+14 (14/Mai Qua) — rollout automático ou manual.

### 4.2 Single-point-of-failure acknowledged

**Documentar em T10 ops-playbook (seção Incidents):**
```
⚠️ Single-point-of-failure: Lucas Pimentel é o único contato técnico 
durante launch week. Em caso de indisponibilidade > 2h:
  1. Status page automático via Vercel (manutenção programada)
  2. Reply automático em contato@muuney.com.br: 
     "Estamos acompanhando. Retorno em até 24h."
  3. Sem promessa de SLA durante beta/launch fase 1.
```

Reavaliar pós-D+30: contratar CS freelancer ou deputy técnico se volume justificar.

### 4.3 Press list — nova entrega D-6

**Ação imediata:** agente inicia montagem de `13-press-list-muuney-hub.md` esta semana.

**Estrutura esperada:**
- **Tier 1 (5-8 contatos):** jornalistas senior fintech em Valor Econômico, Brazil Journal, NeoFeed, Exame Invest
- **Tier 2 (10-15 contatos):** newsletters nicho (The News, FinRise, Market Makers, Do Zero ao Topo)
- **Tier 3 (10-15 contatos):** podcasters fintech/investimentos (Stock Pickers, Inside, Market Makers pod, Mercado ao Ponto)
- **Tier 4 (bonus 5):** influencers LinkedIn fintech BR

Cada contato com: nome, veículo, email/Twitter/LinkedIn, ângulo recomendado, última matéria relevante, notas pessoais.

### 4.4 Outreach reduzido — templates por persona

**Fluxo revisado (meta: 20 outreach/semana total):**

1. **Seg (agente gera):** 20 drafts personalizados — 5 por persona ICP (T9: AAI pipeline crescendo, gestora boutique, family office, analista senior)
2. **Seg 10h-10:30 (Lucas revisa):** batch review 30min, aprova/edita/pula
3. **Seg 14-17h (Lucas envia):** LinkedIn/email personalizado (~4min/envio × 15 = 1h)
4. **Qua (agente acompanha):** drafts follow-up para quem não respondeu em 48h

**Tracking:** tabela Notion/Google Sheets com status por prospect (enviado, respondido, call marcada, declinou, cadastrado, convertido).

Reajustar meta conforme taxa resposta real (benchmark inicial: 15-25% reply rate em ICP frio LinkedIn).

---

## 5. Pendências 🟡 residuais (não bloqueiam, mas confirmar antes D-3)

| # | Item | Status | Ação sugerida |
|---|------|--------|---------------|
| 8 | Changelog público `/changelog` | Aguardando confirmação | Lucas confirmar Sim/Não até D-5 |
| 10 | IG `@muuney` existe? | Não respondido | Lucas verificar + reservar handle até D-3 |

---

## 6. Próxima ação do agente (hoje 20/Abr)

1. ✅ **Investigar 3 bugs hub-cvm-api v23** — concluído. Ver `ops/bug-triage.md`. 3 bugs confirmados + 1 meta-bug (serialização de erro). RPCs `gestora_rankings_rpc` e `admin_rankings_rpc` não existem no Postgres; `monthly_overview` falha por `fetchAllByDate` ordenar por coluna `id` inexistente em `hub_fundos_diario`. Fix ~2h. Lucas deploya v24.
2. **Atualizar disclaimer** em todos os deliverables afetados (T8 comms, T10 ops playbook, T11 coordenação) removendo referência CGA+OAB
3. **Atualizar landing /hub spec** (T11) com nova headline "Inteligência de dados e Analytics do mercado financeiro"
4. **Consolidar assinatura unificada** `Lucas Pimentel / Muuney.hub / muuney.app` nos templates T8
5. **Pausar rotinas** `muuney-competitor-pulse` + `muuney-creative-producer` no D-3 (27/Abr)
6. **Montar press list** (entregar `13-press-list-muuney-hub.md` até D-6, Sex 24/Abr)
7. **Preparar 1º batch outreach** (20 drafts personalizados por persona ICP até D-7, Seg)

---

## 7. Log de alterações

| Data | Item | Alteração |
|------|------|-----------|
| 20/Abr/2026 | Disclaimer | Retirada referência CGA CVM + OAB (por orientação Lucas) |
| 20/Abr/2026 | Nome oficial | "Lucas Pimentel" |
| 20/Abr/2026 | Email sender | `contato@muuney.com.br` (único) |
| 20/Abr/2026 | Tagline | "Dados CVM + BACEN em um só painel" |
| 20/Abr/2026 | Headline landing | "Inteligência de dados e Analytics do mercado financeiro" |
| 20/Abr/2026 | Beta outreach | Liberado contato Aruan + Pedro + Pedro Ivo + Felipe + MMmath10 |
| 20/Abr/2026 | Backup incident | Single-point-of-failure aceito — Lucas sozinho durante launch week, sem SLA |
| 20/Abr/2026 | Budget emergência | Autorizado Supabase Pro (US$ 25) e CS freelancer (R$ 1.500/mês) se triggers ativarem |
| 20/Abr/2026 | Rotinas launch week | Pausar competitor-pulse + creative-producer D-3 → D+7, retomar D+14 |
| 20/Abr/2026 | Deputy regulatório | Pimentel confirmado como escalation CVM/ANPD (< 48h) |
| 20/Abr/2026 | Press list | Não existe — agente monta até D-6 (13-press-list-muuney-hub.md) |
| 20/Abr/2026 | Cold outreach | Meta revisada 30-40→15-20/semana com agente gerando drafts personalizados |
| 20/Abr/2026 | Bug triage v23 | 3 bugs 500 confirmados + 1 meta-bug serialização (ops/bug-triage.md) |
| 21/Abr/2026 | Stripe Live ativação | Stripe Dashboard Passos 1-6 concluídos (conta BR Live + Pro Mensal R$49 + Pro Anual R$490 + Billing Portal + webhook 5 events + 6 secrets Supabase) |
| 21/Abr/2026 | ES256 JWT fix | stripe-checkout v2 + stripe-portal v2 redeployed via MCP com verify_jwt=false — platform verifier rejeita ES256, funções validam internamente via SERVICE_ROLE_KEY |
| 21/Abr/2026 | Pix BR deferido | Stripe BR ainda não aprovou Pix — launch 30/Abr só com cartão, Pix ativado em follow-up pós-launch |
| 21/Abr/2026 | Smoke test parcial | Checkout session create 200 OK + customer Live criado; payment finalization pendente (Lucas abandonou 1ª session). Nova session cs_live_b1JYO... aguardando. Ver ops/stripe-next-steps-post-smoke.md |
