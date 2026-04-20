# T3 — Smoke Test E2E Checklist v1 (Muuney.hub)

**Objetivo:** bateria manual antes do launch 30/Abr. Cobrir todos os fluxos principais em desktop + mobile (375px). Cada step: `[ ]` pendente, `[✓]` passou, `[✗]` quebrou, `[N/A]` não aplicável.
**Tempo estimado total:** ~2h desktop + ~1h30 mobile.
**Pré-requisito:** ter 1 conta admin (lucas.lpof@gmail.com), 1 conta pro (Aruan ou outro beta), 1 conta free nova (criar email descartável pra esse teste).
**Bugs conhecidos (19/Abr):** hub-cvm-api v23 tem 500 em `monthly_overview`, `admin_rankings`, `gestora_rankings` — investigar antes de começar o smoke.

---

## 0. Setup do ambiente de teste

- [ ] Navegador Chrome em modo incognito (zero cache)
- [ ] DevTools aberto aba Network (detectar 4xx/5xx)
- [ ] DevTools aba Console (detectar JS errors)
- [ ] Mobile: Chrome DevTools Device Toolbar → iPhone 12 Pro (390×844) + Galaxy S20 (360×800) + iPad Air (820×1180)
- [ ] Limpar localStorage entre contas: `localStorage.clear()` no Console

---

## 1. Auth & primeiro acesso

### Desktop
- [ ] `/hub/login` carrega sem erro de console
- [ ] Login com credenciais erradas mostra mensagem amigável pt-BR
- [ ] Rate limit após 5 tentativas (lockout 60s com countdown)
- [ ] Login com credenciais válidas → redirect pra `/dashboard` (ou `/hub`)
- [ ] "Esqueci minha senha" → fluxo `/forgot-password` → email enviado (Resend ativo?) → `/reset-password` funciona
- [ ] `/primeiro-acesso` funciona pra email beta com convite ativo
- [ ] `/primeiro-acesso` rejeita email não convidado com mensagem clara
- [ ] Logout → sessão limpa, redirect `/login` ou homepage

### Mobile
- [ ] Form de login cabe em 375px sem overflow horizontal
- [ ] Teclado numérico em campo de código se aplicável
- [ ] Touch targets ≥ 44px (botões submit)
- [ ] Link "esqueci senha" é tapável sem ampliar zoom

**Bugs conhecidos a validar:**
- [ ] ⚠️ SITE_URL Supabase Auth = `https://muuney.app` (não localhost) → sem isso reset password quebra
- [ ] ⚠️ Redirect URLs inclui `https://muuney.app/**`
- [ ] Resend SMTP ativo ou Supabase default? (se default, alta chance de hotmail ir pra spam)

---

## 2. Onboarding tour (primeira visita logado)

- [ ] Modal aparece no primeiro login (localStorage vazio)
- [ ] Progress bar correto (1/7, 2/7, ...)
- [ ] Botão "Próximo" avança
- [ ] Botão "Voltar" volta
- [ ] Botão "Pular" encerra e seta `muuney_hub_onboarding_done = true`
- [ ] Step 2 (Macro) navega pra `/hub/macro` ao avançar
- [ ] Step 3 (Crédito) navega pra `/hub/credito`
- [ ] Step 4 (Renda Fixa) navega pra `/hub/renda-fixa`
- [ ] Step 5 (Fundos) navega pra `/fundos`
- [ ] Step 6 (Ofertas) navega pra `/ofertas` (se existe)
- [ ] Step 7 (Feedback reminder) termina no `/dashboard`
- [ ] Segundo login: tour NÃO reaparece (localStorage bloqueou)
- [ ] `useResetOnboarding()` no console: tour reaparece (testability)

---

## 3. Módulo Macro (`/hub/macro`)

### Navegação
- [ ] 6 sections renderizam (Visão Geral, Atividade+Inflação+Monetária, Trabalho, Externo, Expectativas, Analytics)
- [ ] Sidebar scroll sync com section visível
- [ ] Deep-link: `/hub/macro?section=trabalho&period=5y` abre na seção correta
- [ ] Lazy-load: seção só faz fetch ao entrar no viewport (conferir Network tab)
- [ ] SectionErrorBoundary: forçar erro via DevTools (bloquear request) → boundary com retry aparece

### Charts
- [ ] Charts Selic, IPCA, PTAX renderizam em Overview
- [ ] Auto-scale Y-axis: trocar período 1y → 5y → 10y → domain ajusta
- [ ] Smart formatting B/M/k aparece nos eixos grandes
- [ ] Overlay SMA: toggle liga/desliga linha suavizada
- [ ] Overlay EMA: idem
- [ ] Overlay Trendline (linear regression)
- [ ] Export CSV: baixa arquivo, header + dados corretos
- [ ] Export PNG: baixa imagem do gráfico

### Calculadoras
- [ ] InflationCalculator v2: inputs → purchasing power chart atualiza
- [ ] Period presets 6M/1A/2A/5A/Tudo
- [ ] Inflação anualizada calculada corretamente
- [ ] YieldCurveSimulator v2: Hawkish/Neutro/Dovish presets
- [ ] Shape analysis identifica Normal/Invertida/Corcova/Flat
- [ ] FiscalCalculator v2: 3 cenários (Base/Otim/Pess) + sensitivity heatmap 5×6

### COPOM/FOMC overlay (#14)
- [ ] Botão EV toggle no chart Selic acende markers
- [ ] Markers color-coded (hike vermelho, cut verde, hold cinza)
- [ ] Tooltip do marker mostra data + decisão + bps

### NarrativePanel
- [ ] Regime detection mostra 1 dos 7 regimes
- [ ] Cross-signals renderizam (min 2 signals visíveis)

### Mobile
- [ ] Sidebar vira hamburger ou top bar
- [ ] Charts scrollam horizontalmente se necessário (sem overflow)
- [ ] Calculadoras cabem em 1 coluna em 375px

---

## 4. Módulo Crédito (`/hub/credito`)

- [ ] 6 sections carregam (Visão Geral, Volume, Taxas & Spreads, Risco, Operações, Analytics)
- [ ] Deep-link `?section=risco` funciona
- [ ] CreditOverviewMensal 8 subseções renderizam
- [ ] Heatmap saldo × modalidade + inadimplência color-coded
- [ ] CreditProductPanel: 20 produtos carregados, sortable
- [ ] CreditOperationsPanel: 20 modalidades BACEN, filtros funcionam, 3 chart panels, CSV export
- [ ] InterestCalculator v2: Price + SAC, 3 cenários, heatmap sensibilidade
- [ ] DefaultRadar v2: presets 6M/1A/2A
- [ ] SpreadMonitor v2: tabela completa, alertas stress, CSV export
- [ ] NarrativePanel: 7 regimes + 7 cross-signals

### Mobile
- [ ] Tabela CreditOperationsPanel com scroll horizontal, sem corte
- [ ] Heatmap legível em 375px (pode ser simplificado)

---

## 5. Módulo Renda Fixa (`/hub/renda-fixa`)

- [ ] 5 sections (Visão Geral, Taxas & Curva, Títulos Públicos, Crédito Privado, Analytics)
- [ ] Curva DI 9 vértices renderiza (snapshot + shape label)
- [ ] NTN-B term structure 4 vencimentos
- [ ] BondCalculator v2: convexidade, comparador 3 títulos, heatmap sensibilidade 5×6
- [ ] YieldCurveSimulator v2: Parallel/Twist/Butterfly, DV01 estimado
- [ ] SpreadCreditoPrivado v2: regime detection + 4 cross-signals + CSV

---

## 6. `/fundos` (hub principal)

- [ ] 6 sections: Visão Geral, Estruturados, Gestoras & Admins, Métricas & Mensal, Composição & Comparador, Analytics
- [ ] FundSearchBar: autocomplete aparece, click fora fecha
- [ ] Digite "condo" → sugestões carregam (< 2s)
- [ ] Click em sugestão → navega pra `/fundos/:slug`
- [ ] GestoraRankingsTable: sortable por PL, fundos, taxa_adm média
  - [ ] ⚠️ Conferir 500 do endpoint `gestora_rankings` (hub-cvm-api v23 retornou 500 hoje)
- [ ] AdminRankingsTable: sortable
  - [ ] ⚠️ Conferir 500 do endpoint `admin_rankings`
- [ ] FundScreener: filtros classe_rcvm175, público, tributação, PL min/max, taxa_adm max, search
- [ ] FundScreener: paginação 25/page
- [ ] FundCategoryRankings: 6 categorias renderizam
- [ ] ComparadorSection v2: adicionar até 6 fundos cross-class
- [ ] Fund Score™ bar comparison + pillar table
- [ ] InsightsFeed: items paginados com severity + type badges
- [ ] InsightsFeed em usuário free: InlinePaywall aparece no lugar
- [ ] "Últimas Movimentações" overview: compact mode rende

**Bug ativo:** endpoint `monthly_overview` retorna 500 — conferir qual componente consome e se degrada graciosamente.

---

## 7. FundLamina (`/fundos/:slug`)

- [ ] 5 sections: Resumo, Performance, Composição, Informações, Similares
- [ ] KPI cards (Retorno, Vol, Sharpe, Max DD) carregam
- [ ] Chart base-100 renderiza (LineChart, indexed 100)
- [ ] Comparação com CDI overlay (se aplicável)
- [ ] Fund Score™ 4 pilares mostra (percentage + label Excelente/Bom/Regular/Fraco/Insuficiente)
- [ ] Composição CDA: donut + tabela
- [ ] 8 blocos CVM labeled corretamente (usar BLOCO_LABELS)
- [ ] Similares: min 3 fundos mesma classe
- [ ] Breadcrumbs: Home > Fundos > [nome do fundo]

### Quota free tier
- [ ] Usuário free: 3 lâminas/dia OK
- [ ] 4ª tentativa: InlinePaywall com CTA `/upgrade`
- [ ] Usuário pro/admin: quota bypass (sem paywall)

---

## 8. FIDC deep module (`/fundos/fidc`)

**Acesso restrito: tier=pro** — usuário free deve bater em RequireTier → InlinePaywall ou redirect.

- [ ] Usuário free → bloqueado com CTA upgrade
- [ ] Usuário pro acessa `/fundos/fidc`
- [ ] 4 sections: Visão Geral (KPIs + PieChart lastro), Rankings, Screener, Segmentos
- [ ] Overview: 4 KPI cards populados (total FIDCs, PL agregado, avg subordinação, avg inadimplência)
- [ ] PieChart por lastro renderiza
- [ ] Rankings: sortable (PL, subordinação, inadim, rentab), filtros (lastro, min_pl)
- [ ] Font table 9px não causa overflow em 375px (recente shrink)
- [ ] FidcLamina (`/fundos/fidc/:slug`): 6 sections, stacked bar capital, subordinação line, rentab lines, similar funds

### Data freshness
- [ ] Data da última atualização visível no overview (CVM pode ter parcial Mar/2026)
- [ ] EmptyState se algum fundo sem dados do mês

---

## 9. FII deep module (`/fundos/fii`)

- [ ] Tier pro requerido
- [ ] 4 sections: Visão Geral, Rankings, Screener, Segmentos
- [ ] Overview: total FIIs, PL, DY médio, rentab média
- [ ] PieChart por segmento
- [ ] Rankings sortable (PL, DY, rentab, cotistas, VP), filtros (segmento, tipo_gestao, min_dy)
- [ ] FiiLamina: 4 sections, LineChart rentab+DY 24 meses, PL over time, cotistas over time, fundos similares

---

## 10. Ofertas Radar (`/ofertas`)

- [ ] Tier pro requerido
- [ ] 4 sections: Visão Geral, Timeline, Pipeline, Explorer
- [ ] Overview KPIs + PieChart + breakdowns (tipo_ativo, status, tipo_oferta, modalidade, segmento)
- [ ] Timeline: BarChart dual-axis 12m + bucket cards
- [ ] Pipeline cards clicáveis (filtram Explorer ao click)
- [ ] Explorer: multi-filter table, sort, paginação
- [ ] StatusBadge colorido 7 estados
- [ ] Redirect `/fundos/ofertas` → `/ofertas` (backward-compat)

---

## 11. Portfolio (`/portfolio`)

**Nota beta:** portfolio está deprioritizado (AAIs usam plataforma do banco), mas precisa estar funcional pois o tour menciona.

- [ ] Criar novo portfolio
- [ ] Adicionar holding (busca fund → quantidade → preço médio → data)
- [ ] Composition pie chart renderiza
- [ ] Drift vs targets % calcula e mostra barras
- [ ] Performance indexed base-100 (LineChart)
- [ ] Empty state se portfolio vazio (EmptyState variant="portfolio-empty")

---

## 12. FeedbackWidget (todas as páginas Hub)

- [ ] Floating button bottom-right visível em desktop
- [ ] Bottom-4 right-4 em mobile (sm:bottom-6 sm:right-6)
- [ ] Click → expande painel contextual
- [ ] Category pills: bug, sugestão, UX, dados, outro
- [ ] Rating 1-5 stars clickable
- [ ] Textarea aceita texto
- [ ] Submit → mensagem sucesso animada
- [ ] `hub_feedback` recebe row (conferir via SQL: `SELECT * FROM hub_feedback ORDER BY created_at DESC LIMIT 1`)
- [ ] Metadata jsonb populada (pathname, userAgent, viewport, timestamp)
- [ ] Mobile: painel cabe em `w-[calc(100vw-2rem)]`

---

## 13. Premium gates matrix

| Recurso | Free | Pro | Admin |
|---|---|---|---|
| `/hub/macro` | ✓ | ✓ | ✓ |
| `/hub/credito` | ✓ | ✓ | ✓ |
| `/hub/renda-fixa` | ✓ | ✓ | ✓ |
| `/fundos` (overview + search) | ✓ | ✓ | ✓ |
| FundScreener | 🔒 RequireTier | ✓ | ✓ |
| InsightsFeed | 🔒 RequireTier | ✓ | ✓ |
| Comparador | 🔐 BlurredPreview | ✓ | ✓ |
| FundLamina | 🔒 3/dia + Paywall | ✓ | ✓ |
| `/fundos/fidc` | 🔒 Redirect | ✓ | ✓ |
| `/fundos/fii` | 🔒 Redirect | ✓ | ✓ |
| `/ofertas` | 🔒 Redirect | ✓ | ✓ |
| `/portfolio` | ? (confirmar) | ✓ | ✓ |
| `/upgrade` | ✓ (CTA) | ✓ (manage) | ✓ |

- [ ] Cada combinação acima validada em conta free + conta pro
- [ ] Badge de tier no header (Upgrade CTA / Pro green / Admin violet)

---

## 14. Mobile responsiveness audit

Fazer 3 viewports: 360px, 375px, 414px.

- [ ] Sem overflow horizontal em nenhuma página
- [ ] Sidebar colapsa pra hamburger ou top-nav
- [ ] Tabelas com muitas colunas: scroll horizontal com sombra indicativa
- [ ] Charts com `ResponsiveContainer` redimensionam
- [ ] Botões ≥ 44px height
- [ ] Links ≥ 44px tap target
- [ ] Font-size mínima 12px (exceto table dense 9-10px aceitável com zoom)
- [ ] Modais caberem em 90vh (não quebrar com teclado aberto)
- [ ] FeedbackWidget não sobrepõe CTAs críticos

---

## 15. Performance benchmarks (Chrome DevTools → Lighthouse)

- [ ] `/dashboard` (Hub landing): LCP < 2.5s, CLS < 0.1, FID < 100ms
- [ ] `/fundos`: LCP < 3s (dados pesados aceitável)
- [ ] `/fundos/:slug`: LCP < 3s
- [ ] Bundle total gzipped: conferir `vite build` output (target < 2 MB total, principais chunks < 300 kB)
- [ ] First render sem blocking JS (async/defer onde possível)

---

## 16. Tabela de bugs encontrados (preencher ao executar)

| # | Ambiente | Página | Passo | Comportamento esperado | Comportamento atual | Severidade | Screenshot/log |
|---|---|---|---|---|---|---|---|
| 1 | prod | /fundos | carregar Gestoras tab | Tabela renderiza | 500 hub-cvm-api gestora_rankings | **P0** (bloqueia feature) | logs Supabase |
| 2 | prod | /fundos | carregar Admins tab | Tabela renderiza | 500 hub-cvm-api admin_rankings | **P0** | idem |
| 3 | prod | /dashboard (se tiver) | carregar overview mensal | KPIs populam | 500 hub-cvm-api monthly_overview | **P0** | idem |
| 4 | ... | | | | | | |

**Severidade:**
- P0: bloqueia feature core, fixa antes do launch
- P1: degrada UX, fixa antes do launch se tempo
- P2: cosmético / edge case, backlog

---

## 17. Gate de aprovação pro launch

Antes de 30/Abr, **todos os itens P0 devem estar OK** e pelo menos **80% dos P1**.

Lista canônica de blockers:
- [ ] 3 bugs 500 do hub-cvm-api v23 fixados e redeployados
- [ ] SITE_URL + Redirect URLs Supabase OK
- [ ] Email reset password chega em hotmail/gmail/outlook (testar 3 contas)
- [ ] Onboarding tour completo end-to-end
- [ ] Mobile sem overflow horizontal em 5 páginas core
- [ ] Feedback widget persiste em hub_feedback
- [ ] Todos os 5 módulos renderizam sem JS errors no console

---

## 18. Perguntas pendentes pro Lucas

1. **Existe `/dashboard` ou só `/hub`?** CLAUDE.md menciona as duas — confirmar URL canônica.
2. **Portfolio tracker está em /portfolio ou só como section?** Deprioritizado pro beta mas precisa funcionar.
3. **`localStorage.clear()` é suficiente pra simular primeira visita, ou há cookies Supabase extras?**
4. **Fluxo de smoke test tem sentido executar sozinho ou delegar pra um dos betas (incentivo: Pro vitalício)?**
