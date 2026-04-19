# Meta Ads B2C — Setup Playbook (muuney.app)

**Objeto:** ativar e escalar campanha de aquisição paga no ecossistema Meta (Instagram + Facebook + WhatsApp Ads) para o **muuney.app** (PFM B2C).
**Data:** 18/04/2026
**Status:** 🟡 Draft para aprovação Lucas
**Orçamento proposto:** R$ 300/mês (teste 30d) → escalar a R$ 1.000/mês após validação

> **Escopo importante:** Este playbook é **exclusivamente para muuney.app** (produto B2C).
> O muuney.hub (B2B AAI) tem jornada de aquisição distinta (LinkedIn orgânico + outbound +
> referral de AAI), fora do escopo deste documento.

---

## 1. Pré-requisitos (verificar antes de investir qualquer R$)

### 1.1 Assets já prontos ✅
- Pixel Meta instalado: `1601597777561652` (ver `index.html`).
- Domínio `muuney.com.br` já tem tráfego do blog (15+ artigos).
- Landing principal: `https://muuney.app`.
- Landing SEO: `https://muuney.app/gestao-financeira-automatica` (OG image dedicada).
- Landing waitlist Pro: `https://muuney.app/waitlist-pro`.
- Nurture 5-email já configurado (Edge Function `send-email-sequence` + Resend).

### 1.2 Pendências antes do primeiro R$ investido ⚠️
| Item | Status | Ação | Responsável | SLA |
|------|--------|------|-------------|-----|
| Meta Business Manager criado | ❓ Verificar | Em business.facebook.com, confirmar BM vinculado ao Pixel 1601597777561652 | Lucas | 20/04 |
| Domínio muuney.com.br **verificado** no BM | ❓ Verificar | Business Settings → Brand Safety → Domains → adicionar + meta tag em `<head>` | Lucas | 20/04 |
| Conta de anúncios (BR, BRL) | ❓ Verificar | Criar dentro do BM, configurar método pagamento (cartão corporativo) | Lucas | 20/04 |
| Conversions API (CAPI) | ❌ Não instalado | Edge Function Supabase relay evento server-side para dedup com Pixel | Lucas + Claude | Pós-launch hub |
| Política de Privacidade + Termos visíveis | ✅ Na landing | Verificar link no footer | — | OK |
| Cookie banner LGPD | ❓ Verificar | Se ausente, adicionar (afeta elegibilidade Advantage+) | Lucas | 22/04 |
| Cópias do app em stores (Apple/Play) | ❌ App ainda em beta privada | Usar criativos de landing/produto enquanto app não está público | — | — |

---

## 2. Objetivo da campanha de teste (30 dias)

**Objetivo de negócio:** gerar aprendizado qualificado de custo por waitlist signup + sinal inicial
de retenção do nurture 5-email, antes de ampliar investimento.

**North Star Metric do teste:** CPL (Cost per Lead — waitlist signup + double opt-in e-mail).
**Meta**: CPL ≤ R$ 6,00 (benchmark fintech PFM BR early-stage).

**Métricas secundárias:**
- CTR link → Landing ≥ 1,5%.
- Taxa conversão landing → signup ≥ 6%.
- Cost per Mille (CPM) ≤ R$ 28 (Instagram feed/stories BR).
- Tempo médio na página ≥ 40s.
- Abertura do email #1 ≥ 48%.

**Anti-metas (não otimizar por):** downloads de app (ainda não lançado), cliques (vanity),
impressions.

---

## 3. Estrutura de contas (Business Manager)

```
Meta Business Manager
├── Muuney (Business)
│   ├── Ad Account: "Muuney BR" (BRL)
│   ├── Pixel: 1601597777561652
│   ├── Página: @muuney (IG + FB)
│   ├── Catálogos: —
│   └── Conversions API: muuney-capi.supabase.co (futuro)
└── Pessoas
    ├── Lucas Pimentel (Admin)
    └── Agência / freelancer (quando houver)
```

---

## 4. Eventos de conversão (Pixel + CAPI futuro)

Configurar via Events Manager → Aggregated Event Measurement → priorizar até 8 eventos
por domínio:

| Prioridade | Evento | Fonte | Quando dispara |
|-----------|--------|-------|----------------|
| 1 (principal) | `Lead` | Pixel + CAPI | submit waitlist confirmado por e-mail |
| 2 | `CompleteRegistration` | Pixel + CAPI | signup muuney.app (app launch) |
| 3 | `Subscribe` | Pixel | assinatura Pro (pós-monetização) |
| 4 | `ViewContent` | Pixel | pageview landing principal |
| 5 | `ViewContent:artigoblog` | Pixel custom | scroll 60% em artigo do blog |
| 6 | `InitiateCheckout` | Pixel | entrada em fluxo Pro (futuro) |
| 7 | `AddToCart` | Pixel | clicar CTA "Entrar na waitlist" (não submeter) |
| 8 | `Contact` | Pixel | clicar "Fale conosco" |

**Mapear no site (se ainda não estiver):**
```html
<!-- no submit handler do waitlist form -->
fbq('track', 'Lead', {
  content_name: 'Muuney Waitlist',
  content_category: 'pfm_signup',
  value: 0,
  currency: 'BRL'
});
```

---

## 5. Audiências (para lançar)

### 5.1 Cold (prospecção)
1. **PFM Interest Core** — BR, 18-35, interesses: "Finanças pessoais", "Nubank", "Inter", "C6 Bank", "Investimento", "Educação financeira", "Me Poupe". Exclui fans da página Muuney.
2. **Lookalike Waitlist 1%** — quando waitlist ≥ 500 seeds; BR, 18-35.
3. **Lookalike PageView 60s 1%** — BR, 18-35.
4. **PFM Broad** (Advantage+ audience) — BR, 18-45, sem exclusões — deixa a Meta otimizar.

### 5.2 Retargeting (warm)
5. **Visitou landing ≤ 14d & não submeteu** — exclui eventos `Lead`.
6. **Abriu artigo do blog ≤ 30d & não submeteu**.
7. **Engajou Instagram ≤ 30d**.

### 5.3 Custom (próprias)
8. **Waitlist signups** — para nurture + CAPI.
9. **Já cliente muuney.app (pós-launch)** — para exclusão em prospecção e futuras campanhas de upsell Pro.

---

## 6. Criativos (para o sprint 30d)

### 6.1 Princípios
- **Tech-Noir na landing, "Amigável + Otimista + Acessível" nos ads.** O ad não pode intimidar Gen Z.
- **Rosto humano em 50% dos criativos** (UGC-style aumenta CTR 20-40% em fintech BR).
- Hook nos primeiros 3 segundos obrigatório em vídeo.
- CTA único por criativo: "Entrar na waitlist".
- Sem jargão regulatório (AAI, CVM) nos ads B2C.

### 6.2 Matriz inicial (6 criativos por ad set, 2 vencedores escalam)

| # | Formato | Hook | Oferta |
|---|---------|------|--------|
| 1 | Reels 15s UGC | "Não sei pra onde vai meu dinheiro todo mês." | "Muuney mostra em 3 toques." |
| 2 | Reels 20s screen-capture | "Conectei minhas contas e a Muuney já categorizou tudo." | "Beta aberto, entre na fila." |
| 3 | Static carousel 4 slides | "5 apps de PFM testados. Muuney venceu em…" | "Entre na waitlist e teste grátis." |
| 4 | Static feed | "Seu extrato parece um enigma?" | "A Muuney decifra pra você." |
| 5 | Reels 30s "day-in-the-life" | "Acordei, abri a Muuney, vi que estourei em delivery." | "Primeira dose de consciência financeira." |
| 6 | Static story vertical | "Quer terminar o ano com +R$ 5.000?" | "Comece sabendo pra onde seu dinheiro vai." |

### 6.3 Onde produzir
- **Canva Brand Kit**: kAGsNxuueRk (já existe, automação `muuney-creative-producer` toda segunda).
- **Vídeos UGC**: gravação informal com iPhone, sem precisar de estúdio. Custo zero nas primeiras versões.
- **Screen capture**: OBS Studio + demo account do app.

---

## 7. Estrutura de campanha (primeiro ciclo 30d)

```
Campanha: Muuney-BR-Test-2026Abr
  Objetivo: Leads (Conversions)
  Budget: R$ 300 / 30 dias = R$ 10/dia (CBO ligado)
  Bid strategy: Lowest Cost (sem cap inicial — deixa Meta calibrar)
  Attribution: 7-day click, 1-day view

  ├── Ad Set 1: PFM-Interest-Core
  │   Audiência #1 (PFM Interest Core)
  │   Placements: Advantage+ (auto)
  │   Optimization: Lead event
  │   Budget: CBO (dinâmico)
  │   Criativos: #1, #2, #3, #4 (rodar 4 primeiro)
  │
  ├── Ad Set 2: Advantage-Plus-Broad
  │   Audiência #4 (Broad + Advantage+)
  │   Placements: Advantage+
  │   Criativos: #2, #5, #6
  │
  └── Ad Set 3: Retargeting-Warm
      Audiência #5 + #6 + #7 (combinadas com OU)
      Placements: Advantage+
      Criativos: #1, #3, #5
      Frequency cap: 3/semana
```

**Budget split sugerido:**
- Ad Set 1 (Interest): 40% → R$ 120
- Ad Set 2 (Advantage+ Broad): 40% → R$ 120
- Ad Set 3 (Retargeting): 20% → R$ 60

**Regra de kill:** qualquer criativo com CPL > R$ 15 e ≥ 500 impressões em 72h → pausar.
**Regra de escala:** qualquer criativo com CPL ≤ R$ 5 e ≥ 1.000 impressões em 7d → +30% orçamento.

---

## 8. Cronograma

### Semana 1 (21-25/Abr)
- **D-0 (21/Abr)**: Lucas valida este playbook → go/no-go.
- **D+1 (22)**: Criar/ajustar BM + Ad Account + verificar domínio (4h).
- **D+2 (23)**: Produzir 4 criativos iniciais via Canva + gravação UGC (4h).
- **D+3 (24)**: Subir campanha em modo "rascunho". Reunião de 30 min para revisar em conjunto.
- **D+4 (25)**: Publicar. Primeiros 5 dias = learning phase (não ajustar nada).

### Semana 2 (28/Abr - 02/Mai)
- Monitorar diário sem intervir. Relatório no fim da semana.
- Kill de criativos ruins conforme regra.

### Semana 3-4 (05-16/Mai)
- Escalar vencedores. Produzir iterações dos top 2.
- Relatório final 30d (dia 25/Mai).

### Semana 5 (19-23/Mai) — decisão
- Se CPL ≤ R$ 6 e taxa email #1 aberta ≥ 48% → aprovar aumento para R$ 1.000/mês.
- Se CPL entre R$ 6-10 → manter R$ 300 + iterar criativo 2 ciclos.
- Se CPL > R$ 10 → pausar, voltar ao planejamento orgânico (blog + SEO + social).

---

## 9. Relatórios

### 9.1 Diário (automático, auto-gerado)
- Via plugin `growth-dashboard:growth-report` (toda segunda 9h já existente) — adicionar seção "Meta Ads".
- Métricas: Spend, Impressions, Clicks, CTR, CPC, CPL, Leads, Revenue Ad Return ROAS (não aplicável no teste).

### 9.2 Semanal (sexta 8h)
- Relatório executivo (Lucas lê em 5 min).
- Incluir: top 3 criativos, CPL por ad set, taxa conv landing, abertura email #1, NPS qualitativo.

### 9.3 Post-mortem 30d
- Decisão de escalar / manter / pausar.
- Aprendizados de copy / público / formato para rodar Campanha-2.

---

## 10. Riscos & guardrails

### 10.1 Compliance / Marca
- **Não usar "investimento garantido", "rendimento", "rentabilidade"** — muuney.app é PFM, não plataforma de investimento. Qualquer promessa de retorno viola CVM + CONAR + Meta Ads Policy.
- **Não posicionar a Muuney como banco** (regulatório Bacen).
- **Não usar dados pessoais fictícios de celebridades**.
- **Respeitar LGPD**: cookie banner ativo antes de disparar Pixel; opt-out honrado.

### 10.2 Orçamento
- Cartão corporativo com limite diário de R$ 50 (evita runaway).
- Alerta no Meta BM se spend > R$ 15/dia.
- Stop automático se billing > R$ 400 no mês.

### 10.3 Dependências técnicas
- Pixel precisa funcionar sem adblock (implementar CAPI para resiliência, pós-launch hub).
- Nurture Resend precisa estar 100% (testar com opt-in real antes de subir).

---

## 11. Decisão a tomar (Lucas — 21/Abr)

- [ ] **Go** → Claude sobe draft campanha D+2 (23/Abr) e agenda revisão.
- [ ] **Wait** → adiar para maio (pós-launch hub 30/04). Justificativa: foco total no beta.
- [ ] **No-go** → canal Meta Ads não prioritário em 2026 H1; investir o R$ 300/mês em SEO paid (Google) ou conteúdo patrocinado.

**Recomendação Claude:** **Wait até 02/Mai**. Razão: Pedro + 9 beta testers + launch 30/Abr =
alta carga operacional nas próximas 2 semanas. Subir Meta Ads **em paralelo** com o launch
dilui foco e aumenta risco de bug em produção não pego por falta de bandwidth. Subir
Meta Ads na primeira semana de maio, após o hub estar estável, garante melhor execução.

---

## 12. Quando "Go": referência rápida de assets já existentes

- Pixel ID: `1601597777561652`
- GA4: `G-FW3X3NEWRP`
- Landing principal: `https://muuney.app`
- Landing SEO: `https://muuney.app/gestao-financeira-automatica` (melhor OG image)
- Landing waitlist Pro: `https://muuney.app/waitlist-pro`
- Brand Kit Canva: `kAGsNxuueRk`
- Creative automation: `muuney-creative-producer` (seg 11h)
- Email nurture: Edge Function `send-email-sequence` + Resend
- Tagline: "Seu dinheiro, claro. Sem esforço."
- Cores: `#0a0a0a` (bg), `#0B6C3E` (accent)
- Público-alvo: Gen Z + Millennials 18-35, BR
