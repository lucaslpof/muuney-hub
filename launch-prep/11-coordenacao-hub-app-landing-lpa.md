# T11 — Coordenação Muuney.hub × Muuney.app × Landing × LPA Wealth

**Objetivo:** mapear interfaces e coordenação entre as 4 superfícies do ecossistema para que o launch do hub (30/Abr) não crie fricção nem crie inconsistência de marca, dados ou messaging.
**Contexto:** Muuney.hub (intel de mercado, B2B AAI) é uma unidade distinta do app Muuney (PFM B2C mobile) e da landing institucional. LPA Wealth (consultoria) é entidade separada do ecossistema com Chinese Wall.
**Premissa:** Multi Cifras permanece siloed (não entra nessa coordenação).

---

## 1. TL;DR (Rule of 3)

- 4 superfícies, 3 audiências, 1 visual identity core com adaptações por persona.
- Hub (AAI) é Tech-Noir hardcore, App (Gen Z) é Tech-Noir soft, Landing é Tech-Noir institucional com prova, LPA é formal com Tech-Noir moderado.
- Coordenação operacional: compartilhar GA4, Supabase auth (SSO futuro), CRM (Pluggy/Resend), brand kit — isolar dados financeiros de clientes LPA (Chinese Wall ativo).

---

## 2. Mapeamento de superfícies

| Superfície | URL | Persona | Tier acesso | Status atual | Relevância launch |
|---|---|---|---|---|---|
| Muuney.hub | muuney.app/hub-dashboard | AAI / analista / investidor avançado | Free / Pro / Admin | 99% pronto | **Foco do launch** |
| Muuney app PFM | app.muuney.com.br (futuro) ou muuney.app/app | Gen Z/Millennial B2C | Free | Alpha interno, roadmap | Pós-launch hub (mês 2) |
| Landing institucional | muuney.com.br | Qualquer visitor curioso | Público | Produção | Adaptação necessária pré-launch |
| LPA Wealth portal | lpawealth.com.br (ou subdomain) | Cliente HNW da LPA | Restrito por convite | Privado | Cross-link soft |

---

## 3. Visual identity — unificação e variações

### 3.1 Core brand (compartilhado)

**Cores principais:**
- Primário: `#0B6C3E` (verde Muuney)
- Background escuro: `#0a0a0a`
- Texto principal: `#fafafa` (zinc-100)
- Texto secundário: `#a1a1aa` (zinc-400)
- Acento alerta: `#EC4899` (pink FII) / `#F97316` (orange FIDC) / `#3B82F6` (blue RF)

**Tipografia:**
- Display: Inter ou Satoshi (futuro refactor)
- Body: Inter system default
- Mono: JetBrains Mono (código/números)

**Logo:** Muuney wordmark + ícone "M" com gradiente verde (a finalizar se ainda usa versão antiga)

### 3.2 Variações por superfície

**Muuney.hub — Tech-Noir hardcore:**
- Dark mode only (sem light mode disponível)
- Densidade de informação alta (tabela, charts, dados)
- Componentes shadcn/ui com customização verde/zinc
- Sidebar + scroll narrativo em seções

**Muuney app PFM — Tech-Noir soft:**
- Dark mode default + light mode opcional (Gen Z varia)
- Densidade média, mais espaço vazio
- Ilustrações suaves, ícones minimalistas
- Mobile-first

**Landing muuney.com.br — Tech-Noir institucional:**
- Dark mode como principal, acentos coloridos
- Hero com vídeo/animação
- Cases, depoimentos, stats
- Trust signals (CGA + OAB + Pluggy partnership)
- CTAs claros: "Baixar app", "Entrar no Hub", "Waitlist"

**LPA Wealth portal — formal tech-noir:**
- Dark ou light default? (LPA tem identidade própria; confirmar com Pimentel)
- Densidade de informação: documentos, relatórios, due diligence
- Tipografia mais conservadora se preferirem (Serif para headings?)
- Sem animações exageradas

---

## 4. Messaging hierarquia

### 4.1 Umbrella narrative (ecossistema)

> "O ecossistema Muuney existe para que o dinheiro trabalhe com clareza — do primeiro aporte (app) até a carteira consolidada (LPA Wealth), com as ferramentas técnicas que profissionais usam no dia-a-dia (hub)."

### 4.2 Por superfície

| Superfície | Tagline | Promessa principal |
|---|---|---|
| Muuney.hub | "Inteligência de mercado, sem ruído" | Respostas em 5 min, dados sérios |
| Muuney app | "Seu dinheiro, claro. Sem esforço." | Controle financeiro sem planilha |
| Landing | "O ecossistema financeiro brasileiro" | Conhecer as 3 unidades |
| LPA Wealth | "Planejamento patrimonial independente" | Consultoria sem conflito |

### 4.3 Cross-references permitidas (respeitando Chinese Wall)

**Hub → App:** "Quer uma ferramenta de PFM pessoal? Baixe o Muuney." (CTA soft no footer ou onboarding)
**App → Hub:** "Você se interessa por mercado? Conheça o Muuney.hub (plataforma Pro)." (para upsell de perfil mais sofisticado)
**Landing → Hub/App:** CTAs principais (hero)
**Landing → LPA:** Seção "Consultoria patrimonial" com link
**Hub → LPA:** NÃO link direto (Chinese Wall — dados de cliente LPA não podem ser usados como prova em comm pública do hub).
**LPA → Hub:** Portal LPA pode ter seção "Ferramentas profissionais" mencionando Muuney.hub como ferramenta interna (soft, não comercial).

---

## 5. Landing muuney.com.br — atualizações pré-launch (D-7)

### 5.1 Hero atualizado

**Acima da dobra:**
```
Título: O ecossistema Muuney

Subtítulo: Ferramentas financeiras para controlar hoje, planejar 
amanhã e decidir com confiança.

3 CTAs lado a lado:
[Baixar app Muuney] [Entrar no Muuney.hub] [Waitlist Pro]
```

### 5.2 Seção "3 unidades do ecossistema"

```
### Muuney app
Seu dinheiro, claro. Sem esforço.
PFM pessoal integrado com seus bancos (Pluggy).
[Baixar na App Store] [Google Play]

### Muuney.hub — destaque
Inteligência de mercado, sem ruído.
29.491 fundos RCVM 175, Macro + Crédito + Renda Fixa + FIDC/FII 
deep + Ofertas Públicas.
Gratuito em beta.
[Entrar no Hub →]

### LPA Wealth
Consultoria patrimonial independente.
Wealth planning para patrimônios relevantes.
[Saiba mais]
```

### 5.3 Banner de launch (48h pré/pós)

Banner fino no topo:
```
🎉 Muuney.hub está no ar · 29k fundos + macro + crédito + ofertas · 
Acesso gratuito em beta → muuney.app
```

### 5.4 Seção cases / prova social

- Depoimentos beta testers (Aruan + 2-3 novos até launch)
- Stats: X signups, Y módulos, Z indicadores, W fundos
- Logos parceiros: Pluggy, BACEN (data source), CVM (data source)

### 5.5 SEO updates

- Meta title: "Muuney — Ecossistema financeiro brasileiro: PFM, inteligência de mercado e consultoria"
- Meta description: "Controle seu dinheiro (app), acompanhe o mercado (hub Pro) e planeje seu patrimônio (LPA Wealth). Tudo no ecossistema Muuney."
- Schema: Organization + sub-entities (WebSite × 3)

---

## 6. Hub navigation ↔ Landing

**No Hub:**
- Footer: link "Conheça o app Muuney" + "Sobre o ecossistema" (→ landing)
- Login screen: link "Ainda não tem conta? Volte para muuney.com.br e conheça"
- /upgrade: link para "Comparar com outros produtos Muuney"

**Na landing:**
- Navbar: "Hub" entry leva pra hub-dashboard ou login
- Hero CTA primário (ou secundário): "Entrar no Hub"
- Section dedicada ao hub com preview screenshots + CTA

---

## 7. Hub ↔ App PFM

**Estado atual:** app PFM ainda alpha. Não integrar cross-promo pesado no launch hub.

**Roadmap de integração:**
- **Mês 2 pós-launch hub:** app beta release → cross-CTA soft no hub ("Quer versão pessoal? Baixe o app")
- **Mês 4:** SSO compartilhado (1 login Muuney funciona em ambos)
- **Mês 6:** feature cruzada — app PFM importa insights do hub (ex: "Fundo X rebaixado para insuficiente, considere revisar")

---

## 8. Hub ↔ LPA Wealth (Chinese Wall)

**Princípio:** Lucas é CGA + OAB + pode operar nos dois, mas:
- Dados de cliente LPA não podem ser usados pra nada público/marketing do hub
- Feedback/insights do hub podem alimentar recomendação LPA (sem expor client data)
- LPA pode usar o hub como ferramenta interna (ferramenta → cliente, não contrário)

**Permitidos:**
- Portal LPA menciona "usamos Muuney.hub para due diligence" (soft, sem propaganda)
- Hub menciona "parte do ecossistema Muuney com Muuney app e LPA Wealth" (footer apenas, sem push de serviço)
- Pimentel (sócio LPA) pode apresentar contatos pra beta hub (rede pessoal, não lista de clientes)

**Proibidos:**
- Enviar email broadcast do hub pra lista de clientes LPA
- Usar case ou quote de cliente LPA no hub sem consentimento formal
- Hub executar operação financeira em nome de cliente LPA (muito pior: conflito de interesse)

**Auditoria trimestral:** verificar se Chinese Wall está sendo respeitado (log de cross-references)

---

## 9. Infraestrutura compartilhada vs isolada

### 9.1 Compartilhada

| Recurso | Uso compartilhado | Observações |
|---|---|---|
| Supabase project principal | ✓ Todas as unidades Muuney | RLS separa dados — clients LPA via role=client, hub users via tier system |
| Vercel | ✓ Mesma conta | Projetos separados (prj_3l9W...Hub, futuro app, futuro lpa-portal) |
| GA4 property | ✓ Compartilhado (G-FW3X3NEWRP) | Tracking unificado de jornada cross-surface |
| Meta Pixel | ✓ Compartilhado | Mesma conversion unificada |
| Resend (email) | ✓ Mesmo sender | Templates segmentados por unidade |
| GitHub | ✓ Mesma org | Repos separados |
| Sentry | ✓ Mesma org | Projetos separados (muuney-hub, muuney-app, lpa-portal) |
| Claude/Anthropic (automações) | ✓ Mesma conta | Subagents por área |

### 9.2 Isolado (Chinese Wall)

| Recurso | Por quê isolado |
|---|---|
| CRM de clientes LPA Wealth | Dados sensíveis patrimônio HNW |
| Contratos/due diligence LPA | Documento regulado por sigilo |
| Feedback widget (hub) | Pré-AAI / prospect — não misturar com cliente LPA |
| Operações financeiras | Diferentes responsabilidades fiduciárias |

---

## 10. SSO / Auth — Roadmap unificado

**Hoje:**
- Hub: Supabase Auth (email/password + reset) — funciona standalone
- App PFM: roadmap próprio, TBD provider
- LPA portal: roadmap TBD

**6 meses pós-launch:**
- Login unificado Muuney (1 email/senha funciona em hub + app)
- Supabase como IdP único
- LPA portal permanece separado (segurança + cliente HNW prefere)

**Arquitetura:**
```
Supabase Auth
  └─ hub_user_tiers (tier: free/pro/admin)
  └─ app_user_profiles (Gen Z/Millennial)
  └─ [LPA permanece isolado em clients table existente]

Cross-auth: JWT emitido Supabase válido em hub.muuney.app + app.muuney.com.br
```

---

## 11. Dados compartilhados vs isolados

### 11.1 Compartilhado safely

- Newsletter sign-up (marketing opt-in): pode ir pra mesma lista via Resend
- GA4 user properties: tier_hub, has_app, is_lpa_client (marcado anonimizado)
- Blog posts (CLAUDE.md menciona 15+ artigos já na tabela blog_posts) — podem ser lidos de qualquer superfície

### 11.2 Isolado estritamente

- `hub_user_portfolios` (carteira que user montou no hub) — NÃO misturar com LPA client portfolio
- `profiles` (LPA clients) — RLS garante que admin ≠ hub admin
- Dados bancários Pluggy (app PFM) — isolados em schema separado
- Contratos legais LPA — storage próprio (s3 protegido)

---

## 12. Email marketing coordenação

**Senders distintos:**
- hub@muuney.com.br (blasts hub-only, launch, pro onboarding)
- newsletter@muuney.com.br (newsletter editorial ecossistema)
- app@muuney.com.br (comms app PFM, quando ativar)
- lucas@muuney.com.br (individual, 1-on-1)

**Listas (Resend Audience):**
- `waitlist_hub` (pre-launch waiters)
- `beta_hub` (beta testers ativos)
- `pro_hub` (pagantes pós-Stripe)
- `waitlist_app` (quando app launch)
- `newsletter_general` (lê conteúdo geral)

**Frequência:**
- Hub: 1 email/sem (semanal de insights market) pós-launch estável
- App: 1 email/2sem (quando ativar)
- Newsletter geral: 1 email/mês institucional

**Unsubscribe:** respeitar granular (user pode unsub hub mas manter app).

---

## 13. Domínios e subdomínios

**Atual:**
- muuney.com.br → landing institucional
- muuney.app → domínio principal do hub + futuro app

**Proposto pós-launch:**
- muuney.com.br → permanece landing
- muuney.app → primary hub (muuney.app/hub-dashboard)
- app.muuney.com.br → app PFM (futuro)
- hub.muuney.com.br → alias hub (SEO, redirect 301 para muuney.app)
- lpawealth.com.br → LPA portal (separado)
- muuney.ai ou similar → reservar para brand protection

---

## 14. Analytics cross-surface

**GA4 events customizados unificados:**

Hub:
- `hub_module_view` (module, section)
- `hub_fund_lamina_view` (slug, classe)
- `hub_insight_click`
- `hub_upgrade_intent`

App PFM (futuro):
- `app_signup`
- `app_pluggy_connected`
- `app_category_reviewed`

Landing:
- `landing_cta_click` (destination: hub/app/lpa/waitlist)
- `landing_scroll_depth`

Esse modelo permite funnel cross-surface: visitor landing → signup hub → convert Pro, ou visitor landing → download app → engage → upsell hub.

---

## 15. Press/PR coordenação

Mesma narrativa institucional nos 3 canais:
- "Ecossistema Muuney: PFM B2C + Hub B2B + LPA Wealth consultancy"
- Launch do hub é o **primeiro release público formal** do ecossistema (app ainda alpha, landing é descritivo, LPA é semi-privado)

Se alguma imprensa cobrir o hub, ter pronto:
- Deck de 5-8 slides institucional
- Bio Lucas (CGA + OAB + fundador ecossistema)
- Factsheets por unidade

---

## 16. Roadmap coordenado 6 meses

| Mês | Milestone hub | Milestone app | Milestone landing | Milestone LPA |
|---|---|---|---|---|
| M0 (30/Abr) | Launch público | — | Adaptação hero + seção hub | Cross-link soft |
| M1 (Mai) | Sprint estabilização | Continua alpha | Iteração conversion | Rotina normal |
| M2 (Jun) | Pro tier ativa (Stripe) | Beta público | Seção Pro tier + pricing | Integração interna hub |
| M3 (Jul) | API pública roadmap | Release Store + featured | Landing v2 (cases) | Portal v2 (MFA) |
| M4 (Ago) | SSO unificado | SSO unificado | Section "login único" | Permanece isolado |
| M5 (Set) | Growth experiments | Feature cross com hub | Referral program | Relatórios Q3 |
| M6 (Out) | Reinvest scale | 10k usuários | SEO top 3 termos alvo | Recertificação anual |

---

## 17. Governança de brand assets

**Pasta compartilhada (Google Drive ou similar):**
- `/brand/logos/` — wordmark + ícone + variações
- `/brand/colors/` — hex, RGB, CMYK
- `/brand/fonts/` — arquivos + license
- `/brand/templates/` — PPT, doc, social
- `/brand/guidelines.pdf` — voice & tone, do/don't

**Updater único:** Lucas (proteger contra drift de identidade). Automações (Creative Producer) usam esses assets como source of truth.

---

## 18. KPI consolidado ecossistema (mensal)

| Métrica | Hub | App | Landing | LPA | Total eco |
|---|---|---|---|---|---|
| Usuários ativos mensais | X | Y | — (visitors) | Z | X+Y+Z |
| Conversão acquisition → signup | % hub | % app | % CTA click | % convite aceito | agregado |
| Revenue | Pro MRR | — | — | AUM managed × fee | consolidado |
| NPS/CSAT | hub survey | app survey | — | LPA survey | agregado |

Dashboard semanal LPA + bi-semanal Muuney (app+hub) + mensal consolidado.

---

## 19. Perguntas pendentes pro Lucas

1. **Landing muuney.com.br está pronta pra receber atualização pré-launch?** Quem atualiza: Lucas manual ou tem pessoa dedicada? Se Lucas, reservar 3-4h na semana pré-launch (agendar em 22-23/Abr).
2. **Existe hoje algum link do Hub para Landing ou vice-versa?** Se não, precisa adicionar (footer + navbar). Posso espec em ~30min se necessário.
3. **Pluggy partnership tá formalizada para aparecer como "parceiro oficial" no marketing?** Isso aumenta credibilidade na landing e em comms.
4. **LPA Wealth portal existe hoje ou ainda tá em planejamento?** Se existe, URL e stack atual. Se não, ignorar coordenação LPA por enquanto e focar em Hub × App × Landing.
5. **Quer planejar SSO unificado já pro sprint de junho (M2) ou adiar pro M4?** Antecipar cria complexidade mas reduz fricção do upsell app→hub.
6. **Tem algum signal negativo do mercado sobre "muitos produtos ao mesmo tempo"?** (ex: "o Lucas tá disperso"). Se sim, comms D-day precisa enfatizar foco: launch é do hub, o resto é roadmap.
