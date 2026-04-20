# Smoke Test E2E — Muuney Hub Beta (30/04/2026)

**Objetivo:** validar ponta-a-ponta os fluxos críticos para os 4-10 beta testers AAI (Pedro + próximos).
**Escopo:** auth + navegação entre módulos + lâminas + deep-links + premium gates + onboarding + feedback + PDF export + mobile.
**Ambiente:** `https://hub.muuney.com.br` (produção Vercel), Supabase project `yheopprbuimsunqfaqbp`.
**Execução esperada:** ~35-45 minutos desktop + ~15 minutos mobile.

---

## Credenciais

- **Admin:** lucas.lpof@gmail.com (tier=admin) — valida acesso total
- **Beta tester:** pedroa.chacon@hotmail.com (tier=pro) — valida fluxo AAI
- **Free tier:** criar conta de teste ad-hoc para validar paywalls

## Browsers / dispositivos

- Chrome desktop 1440px (primário)
- Firefox desktop 1440px (smoke secundário)
- Safari iOS (iPhone 13+) — mobile crítico para AAIs em reuniões
- Android Chrome (tablet 800px) — AAIs no banco

---

## Fluxo 1 — Primeiro acesso (beta invite)

1. Abrir `/primeiro-acesso` em aba anônima.
2. Conferir que título da aba exibe "Primeiro acesso | muuney.hub".
3. Conferir que card central mostra aviso "Apenas emails convidados pelo time Muuney podem criar conta."
4. Digitar email de beta tester convidado → clicar "Configurar minha senha".
5. Verificar tela de sucesso com "Email enviado!" + endereço ecoado.
6. Conferir botão "Ir para o login" e link "Já tenho conta" (com acento) direcionam para `/login`.
7. Abrir caixa de entrada, clicar no link do email, confirmar que redireciona para `/reset-password?token_hash=...&type=recovery`.
8. Digitar nova senha (mín. 8 chars) duas vezes → "Redefinir senha".
9. Verificar redirect automático para `/dashboard`.

**Falha-bloqueante:** qualquer passo 1-9 falhar. Se email não chega em 60s, checar Supabase Logs → `send-email-sequence`.

## Fluxo 2 — Login standard + rate limit

1. `/login` em aba anônima → digitar credenciais válidas → "Entrar".
2. Verificar redirect para `/dashboard` (ou `location.state.from.pathname` se tinha deep-link).
3. Sair (botão no header HubLayout).
4. Tentar login com senha errada **5 vezes consecutivas**.
5. Após 5ª tentativa, verificar lockout exibe "Bloqueado (60s)" + disables botão.
6. Aguardar contador zerar → tentar novamente com senha correta → aceita.
7. Conferir links "Esqueci minha senha" e "Primeiro acesso" visíveis no rodapé do card.

**Falha-bloqueante:** lockout não ativa após 5 erros, ou botão não desabilita durante contagem.

## Fluxo 3 — Esqueci minha senha

1. `/forgot-password` → digitar email válido → "Enviar link de recuperação".
2. Verificar tela de sucesso com "Email enviado" + endereço ecoado + link "← Voltar ao login".
3. Abrir caixa de entrada → clicar link → `/reset-password` abre com token válido → trocar senha → redirect `/dashboard`.
4. Testar email inexistente: Supabase retorna sucesso igual (por segurança) — ok.
5. Testar rate limit: clicar 5x rapidamente → verificar mensagem pt-BR "Muitas tentativas. Aguarde alguns minutos e tente novamente."

## Fluxo 4 — Dashboard landing (autenticado)

1. `/dashboard` logado como admin.
2. Conferir KPI hero cards no topo: Selic / IPCA / PTAX / Ofertas Ativas / Alertas Fundos.
3. Clicar em "Ofertas Ativas" → redireciona para `/ofertas`.
4. Clicar em "Alertas Fundos" → redireciona para `/fundos` com ancoragem em insights.
5. Strip de insights (top 3): clicar em cada item → abre lâmina correta (FIDC slug / FII slug / regular).
6. Conferir alertas cards contextuais (se houver dados).

## Fluxo 5 — Módulo Macro

1. `/hub/macro` → sidebar top bar mostra 6 seções (Visão Geral, Atividade+Inflação+Monetária, Trabalho, Setor Externo, Expectativas, Analytics).
2. Clicar cada pill → scroll anima até seção + URL atualiza com `?section=<id>`.
3. Conferir COPOM markers (botão EV) aparecem em Selic/IPCA/PTAX charts da Visão Geral.
4. Period selector: trocar 6M → 1A → 2A → Tudo. URL atualiza com `?period=<val>`.
5. Charts: hover em ponto → tooltip mostra valores + unidade. Export CSV via botão: arquivo baixa com nome `muuney_hub_<serie>_YYYY-MM-DD.csv`, conteúdo separado por `;` + BOM UTF-8 + vírgula decimal.
6. Overlays SMA/EMA/Trend: ativar cada um → conferir linha superposta aparece.
7. Compartilhar link deep: copiar URL atual → colar em nova aba anônima (requer login) → após login, retorna para mesma seção + período.

**Falha-bloqueante:** crash em qualquer section (ver React error boundary → "Ocorreu um erro nesta seção").

## Fluxo 6 — Módulo Crédito

1. `/hub/credito` → 6 seções: Visão Geral, Volume, Preço, Risco, Operações, Analytics.
2. Rolar até "Operações" → CreditOperationsPanel query builder:
   - Selecionar Tipo: PF → Recurso: Livres → Modalidade: Cartão de crédito rotativo.
   - Chart deve mostrar **dados reais BACEN SGS** (não sintéticos). Se modalidade não tem série específica, tooltip explica fallback "Taxa agregada — BACEN SGS não publica taxa específica".
3. Clicar em linha da ComparisonTable → abre ModalityDetailDrawer (modal fullscreen) → ESC fecha.
4. Export CSV: Saldo / Taxa / Inadimplência — conferir 3 arquivos pt-BR.
5. Calendar heatmap (Visão Geral, série 21082 Inadim SFN): hover em célula → tooltip com delta vs mediana.
6. Rolling grid: 5 rows (Inad Total, Spread PF, Taxa PF, Concessões PF, Inadim PJ) com deltas direction-aware (vermelho ruim, verde bom).
7. Narrative sections: conferir prosa presente em **todas as 6 seções** + mini-stats derivados.

## Fluxo 7 — Módulo Renda Fixa

1. `/hub/renda-fixa` → 5 seções.
2. Cross-nav cards no topo de Visão Geral: clicar Macro/Monetária → redireciona para `/hub/macro?section=monetaria` **sem reload** (react-router Link).
3. Scroll Taxas & Curva → yield curve snapshot (9 vértices). Se janela sem dados, InlineEmpty "Vértices DI sem dados na janela atual — aguarde ingestão BACEN SGS".
4. NTN-B term structure (4 vencimentos) — mesmo padrão empty state.
5. TesouroSimulator: digitar prazo 1080 dias + valor R$ 10.000 → conferir 5 colunas (LFT/LTN/NTN-B/NTN-F/Poupança) com IR regressivo 15% (prazo >720d) + custódia B3 0.20% a.a.
6. RfPortfolioCalculator: adicionar 3 títulos (LFT 50% + NTN-B 30% + CDB 20%) → rentab líquida ponderada aparece + comparação vs CDI.
7. CreditoPrivadoDeepPanel (Crédito Privado section): conferir spreads AA/A side-by-side + cushion vs Selic.
8. COPOM overlay em 4 charts (toggle EV): Selic+CDI Visão Geral, DI 30d×360d, NTN-B 2029×2035, IMA-B Proxy Analytics.
9. Calendar heatmaps: NTN-B 2035 (Títulos) + Breakeven 3a (Analytics).

## Fluxo 8 — Módulo Fundos (Catálogo + Lâminas)

1. `/fundos` → FundsLandingHero 4 KPI cards (total fundos, PL agregado, última atualização, módulos ativos).
2. FundSearchBar global: digitar "selic" ou nome → autocomplete com ClasseBadge + PL inline.
3. Selecionar um fundo → lâmina `/fundos/:slug`.
4. Lâmina FundLamina: 5 seções (Resumo, Performance, Composição, Informações, Similares).
5. Conferir Rolling Returns Grid (1m/3m/6m/12m/24m/36m), Sharpe/Sortino/Vol/MaxDD KPIs, PeerBeatsPanel (top 5 peers batendo este fundo), DrawdownHeatmap (year×month).
6. Quota gate (free tier): abrir 3 lâminas → 4ª lâmina renderiza InlinePaywall com CTA /upgrade. Admin/Pro: acesso ilimitado.
7. Comparador section (HubFundos): adicionar até 6 fundos cross-class → Fund Score™ bar comparison. Export CSV 20 colunas.
8. PDF export: botão printer no header da lâmina → "Imprimir" nativo abre com layout `@media print` (A4, Tech-Noir flip ink-friendly, charts visíveis, PrintFooter com disclaimer).

## Fluxo 9 — FIDC Deep Module (Pro only)

1. `/fundos/fidc` → ProRoute gate (se free: redirect `/upgrade`).
2. Como admin/pro: FidcHub com 4 sections (Visão Geral, Rankings, Screener, Segmentos).
3. Rankings table: sortable columns (PL, rentab_fundo, rentab_subord, indice_pdd_cobertura, nr_cedentes, cotistas). URL persistence: trocar sort → colar URL em nova aba → mesmo estado.
4. Segment filter chips (lastros): clicar um → filtra rankings + URL atualiza.
5. SegmentStoryCard grid (Segmentos section): cada lastro mostra share % + top 3 fundos + trend MoM.
6. Clicar em fundo → `/fundos/fidc/:slug` → FidcLamina com 6 sections.
7. Conferir CDI benchmark nas performance charts usa compound formula `(1 + selic_annual/100)^(1/12) - 1` (não hardcoded 1.1%).

## Fluxo 10 — FII Deep Module (Pro only)

1. `/fundos/fii` → FiiHub com 4 sections.
2. Segment filter chips (segmentos): Logística, Lajes Corp, Shopping, etc.
3. Rankings: sortable inclui rentabilidade_patrimonial_mes + pct_despesas_adm.
4. Lâmina `/fundos/fii/:slug` → FiiLamina com 4 sections.
5. Conferir DYCalendarFII (year×month grid com intensity por DY%).
6. FiiPvpPayoutPanel (Performance section): VP/Cota + Payout proxy (ReferenceLine y=100) + Despesas Adm trend.

## Fluxo 11 — Ofertas Públicas Radar (Pro only)

1. `/ofertas` → 4 sections (Visão Geral, Timeline, Pipeline, Explorer).
2. Tabela Explorer: clicar linha "Emissor" → se estruturado (FIDC/FII) linka para lâmina (com ícone ExternalLink).
3. Filtros: tipo_oferta CVM 160/400/476, tipo_ativo, status, busca.
4. URL persistence nos filtros.

## Fluxo 12 — Portfolio Tracker (auth only)

1. `/portfolio` → criar nova carteira.
2. Adicionar 2-3 holdings (cnpj_fundo_classe, quantidade, preço médio).
3. Definir targets % por classe RCVM 175.
4. Conferir composition pie chart, drift bars, performance indexed base-100.
5. RLS: outra conta não vê suas carteiras.

## Fluxo 13 — Upgrade / Pricing

1. Como free: `/upgrade` → 2 pricing cards (Free / Pro R$49 mensal ou R$490 anual).
2. Feature matrix 16 itens visível.
3. Clicar "Assinar mensal" → loading → Stripe Checkout (se configurado) OU alert placeholder.
4. Query params `?status=success` ou `?status=cancelled` exibem banners.

## Fluxo 14 — Onboarding tour (primeira visita)

1. Limpar `localStorage.muuney_hub_onboarding_done` → recarregar `/dashboard`.
2. Modal overlay abre com Welcome → back/next navigation → 7 steps totais (Welcome, Macro, Crédito, Renda Fixa, Fundos, Ofertas, Feedback).
3. Cada step tem accent color do módulo + descrição pt-BR.
4. Progress bar atualiza.
5. Completar → `localStorage` set → não reabre em recarga.

## Fluxo 15 — Feedback widget

1. Em qualquer página Hub: conferir botão floating bottom-right (`sm:bottom-6 sm:right-6`).
2. Clicar → painel expande.
3. Conferir que prop `section` carrega label da seção ativa (ex: "Renda Fixa / Taxas & Curva") — usa `useHubSections()` context.
4. Categorias: Bug / Sugestão / UX / Dados / Outro com ícones.
5. Rating 1-5 estrelas + textarea.
6. Submit → success animation + gravação em `hub_feedback` table.
7. Conferir `metadata` inclui pathname + userAgent + viewport + timestamp.

## Fluxo 16 — Mobile responsiveness (Safari iOS + Android Chrome tablet)

1. Login mobile → dashboard.
2. Sidebar hamburger: abrir → overlay backdrop → clicar item → fecha.
3. Cada módulo: grids `grid-cols-2 md:grid-cols-4` ajustam (4 KPIs → 2 por linha em mobile).
4. Tables sortable: horizontal scroll ok?
5. FeedbackWidget: painel `w-[calc(100vw-2rem)] sm:w-80` preenche tela pequena sem overflow.
6. PDF export em mobile: "Imprimir" do browser abre — layout A4 preserva.

## Fluxo 17 — Erro/stale

1. Derrubar rede (devtools → Offline) → tentar navegar → NetworkStatus banner aparece.
2. Restaurar rede → banner some.
3. Forçar 500 em endpoint (via edge function fault) → conferir mensagem pt-BR amigável (via apiError.ts helper) em vez de stack trace bruto.
4. DataAsOfStamp: conferir staleness green (<24h), amber (<7d), red (>7d). Em Renda Fixa cadence=daily, em Crédito cadence=monthly.

## Fluxo 18 — Logout + sessão expirada

1. Clicar Sair no header HubLayout → redirect `/login`.
2. Conferir `localStorage` não persiste session token.
3. Tentar acessar `/dashboard` diretamente → ProtectedRoute redireciona para `/login`.

## Fluxo 19 — Verificar SEO/OG em aba anônima

1. Cada rota pública (`/`, `/login`, `/primeiro-acesso`, `/forgot-password`, `/reset-password`) deve ter:
   - `<title>...| muuney.hub</title>` único
   - `<meta name="description" content="...">` pt-BR
   - `<link rel="canonical" href="https://hub.muuney.com.br/...">`
   - `<meta name="robots" content="noindex, nofollow">` nas páginas `isProtected`
   - OG tags (og:title, og:description, og:url, og:image)
2. Abrir DevTools → Elements → `<head>` para validar.

## Fluxo 20 — Edge cases

1. Rota inexistente `/xyz123` → NotFound renderiza com "Voltar ao Hub" + HubSEO title "Página não encontrada".
2. URL com section inválida `?section=xyz` → página ignora + abre na Visão Geral.
3. URL com period inválido `?period=xyz` → fallback seguro.
4. JSON malformado em `localStorage.muuney_hub_onboarding_done` → sem crash, trata como primeira visita.

---

## Severidade / critérios de go/no-go

**BLOQUEADOR (no-go):** qualquer falha em Fluxos 1, 2, 4, 5, 6, 7, 8 ou 18. Auth e módulos core têm que funcionar.

**CRÍTICO (resolver antes 30/04):** falha em Fluxos 9, 10, 11, 14, 15, 16. Estas são features premium e experiência beta.

**MÉDIO (backlog pós-beta):** falha em Fluxos 3, 12, 13, 17, 19, 20. Pode lançar com fix pending se não afeta uso diário.

---

## Observações conhecidas (não reabrir)

- taxa_adm: cobertura 0.4% (structural CVM limitation). UI mostra "—" quando null. Fix via ANBIMA API — sprint pós-beta.
- FIDC 202603: dados CVM parciais upstream. pg_cron #16 auto-retry dia 8 próximo mês.
- Stripe: ainda não configurado no Dashboard Stripe. Alert placeholder no `/upgrade` é ok durante beta (sem cobrança).
- Legacy CVM 400/476 parser (ingest-cvm-ofertas): histórico congelado, parser Python pipeline usado.

## Pós-smoke

1. Documentar falhas em `hub_feedback` table via feedback widget durante o próprio smoke test.
2. Triar falhas por severidade → criar tickets prioritários no TodoList.
3. Compartilhar checklist completado (✓/✗) com Lucas antes de abrir beta público 30/04.

**Responsável:** Lucas + Pedro (primeiro beta tester)
**Tempo estimado:** 50-60 min desktop + 15 min mobile
**Última atualização:** 20/04/2026
