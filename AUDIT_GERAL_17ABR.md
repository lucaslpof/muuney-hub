# Muuney.hub — Audit Geral & Plano de Ação Pré-Launch

**Data:** 17/04/2026 · **Launch público:** 30/04/2026 (13 dias) · **Beta ativo:** 1 tester (Pedro)
**Escopo:** revisão geral, otimização, refactor, bug hunt, UX/UI polish
**Modo:** Audit primeiro → aprovação → implementação faseada
**Premissa:** maximizar impacto sem destabilizar (sem refactor agressivo a 13 dias do launch)

---

## TL;DR — Decisão executiva

O codebase está em **estado de produção sólido**. Não há bugs catastróficos nem dívida técnica que impeça o launch. O que existe é:

- **5 bugs P0 ativos** que causam render quebrado em edge cases reais (Math.max em array vazio, race condition Stripe, sparkline NaN). **Total: ~3h de fix.**
- **3 quick wins de performance** com 5–60 min de esforço cada, ganho perceptível (cache miss, animação chart, lazy chunk recharts).
- **5 wins de UX/UI consistência** (tipografia caótica, mobile gaps, a11y) com alto impacto visual e baixo risco. **Total: ~10h.**
- **Refactors maiores** (split useHubFundos, extrair ComparadorSection, splittar páginas 1000+ linhas) **devem ir pós-launch** — risco/benefício negativo a 13 dias.

**Recomendação:** executar os 3 sprints abaixo (S1/S2/S3) que somam ~25h de trabalho, distribuídos pelos 13 dias, deixando margem para feedback dos beta testers + deploy + smoke test.

---

## 🚨 P0 — Bugs ativos que afetam beta testers AGORA

| # | Arquivo:linha | Bug | Fix | Esforço |
|---|---|---|---|---|
| 1 | `src/pages/HubFundos.tsx:449` | `Math.max(...vals)` em array vazio renderiza **"-Infinity"** na pillar table do Comparador quando <2 fundos selecionados | Guard: `vals.length > 0 ? Math.max(...vals) : 0` | 5min |
| 2 | `src/components/hub/KPICard.tsx:32` | Sparkline divisão por zero quando `vals.length === 1` → path com NaN | `const step = vals.length > 1 ? w / (vals.length - 1) : 0` | 5min |
| 3 | `src/lib/statistics.ts:177` | `Math.min(...components.map(c => c.data.length))` em array vazio retorna `Infinity` → `healthIndex()` retorna scores inválidos | Guard antes do spread | 5min |
| 4 | `src/pages/HubUpgrade.tsx:68` | Race condition: `setTimeout(refreshTier, 3000)` assume webhook em 3s. Se Stripe demorar, user paga e vê "Free" → confusion → abre ticket | Polling `until tier === 'pro' \|\| 30s timeout` | 30min |
| 5 | `src/pages/HubResetPassword.tsx:62` | `useEffect` sem cleanup chama `setValidToken` em componente desmontado se user navega antes do OTP verificar | `useRef(true)` + check antes do setState | 15min |

**P0 adicional (latente, mesma classe):**
- `src/components/hub/MacroChart.tsx:52-53`, `CreditProductPanel.tsx:101-103`, `HubDashboard.tsx:180/214/248` — todos usam `Math.max(...spread)` sem guard. Se feed BACEN cair, renderiza "-Infinity" no Dashboard. **Fix em batch (1h).**

**Total P0:** ~3h.

---

## ⚡ Quick Wins — Performance (alto impacto, baixo esforço)

| # | Arquivo:linha | Issue | Fix | Esforço | Ganho |
|---|---|---|---|---|---|
| P1 | `src/hooks/useHubFundos.ts:818` | `useInsightsFeed` usa objeto literal `params` na queryKey → cache miss a cada render | `JSON.stringify(params)` ou destructure | 2min | ~100ms/render + reduz carga API |
| P2 | `src/components/hub/MacroChart.tsx` | Animações Recharts em datasets >200pts causam jank (200–400ms) | `isAnimationActive={data.length > 200 ? false : true}` | 10min | 200–400ms/render de chart |
| P3 | `vite.config.ts` + chart imports | Chunk `vendor-charts` = **424KB** (42% do vendor JS), bloqueia LCP em páginas sem chart (login, landing, settings) | Dynamic import recharts + chunk strategy | 45min | ~150ms LCP em rotas leves |

**Bundle atual (saudável, mas pode melhorar):**
- JS total: 1.9 MB minificado (~550KB gzip)
- 15/17 rotas lazy-loaded ✓
- Vendors splittados ✓

---

## 🎨 UX/UI Polish — Consistência (alto impacto visual)

| # | Issue | Arquivos | Fix | Esforço |
|---|---|---|---|---|
| U1 | **Tipografia caótica:** 14 sizes únicos, inclui `text-[9px]`, `text-[10px]`, `text-[11px]` em 545+ ocorrências. KPI numbers inconsistentes. | Cross-cutting | Definir 6 tiers no Tailwind config (xs=10/sm=12/base=14/lg=16/xl=18/2xl=20). Replace arbitrários. | 2h |
| U2 | **Tabelas overflow no mobile sem indicação:** 5 tabelas com `min-w-[600px]` sem `overflow-x-auto` (CreditProductPanel, FIDCPanel, FIIPanel, etc) | 5 componentes | Wrap em `overflow-x-auto` + gradient hint à direita | 1.5h |
| U3 | **Grids não responsivos:** `grid-cols-4` sem `md:` em ~8 lugares — mobile vê coluna única apertada | HubFundos, FundLamina | `grid-cols-1 sm:grid-cols-2 md:grid-cols-4` | 45min |
| U4 | **A11y: 15+ icon-only buttons sem `aria-label`** (Settings, sidebar collapse, MacroChart export, OnboardingTour close) | HubLayout, HubSidebar, MacroChart, OnboardingTour | Adicionar `aria-label` pt-BR | 45min |
| U5 | **Focus rings inconsistentes:** `focus-visible:` usado 1x no codebase. HubLogin tem padrão bom — replicar em todos os inputs | Cross-cutting forms | `focus:ring-1 focus:ring-[#0B6C3E]/50` em inputs | 1h |
| U6 | **Cores hardcoded:** 15+ hex fora dos brand tokens (#34d399, #10B981, #EC4899, #F59E0B, etc). 4 variantes de "preto" (#0a0a0a, #0c0c0c, #0d0d0d, #111) | Tailwind config + tsx | Adicionar semantic tokens (success/destructive/info/warning) e replace | 3h |
| U7 | **Hover/transition inconsistentes:** padrões variados (table rows, links, buttons) | Cross-cutting | Definir 3 padrões: link, table-row, button | 2h |

**Total UX/UI Sprint:** ~11h.

---

## 🧱 Code Quality (P1 — pode esperar pós-launch, mas vale flagar)

| # | Issue | Local | Esforço | Quando |
|---|---|---|---|---|
| C1 | **`useHubFundos.ts` monolítico (1348 linhas, 52 exports)** — splittar em useFundos / useFidcV4 / useFiiV4 / useFipV4 | `src/hooks/useHubFundos.ts` | 2–3h | **Pós-launch** (risco refactor central) |
| C2 | **ComparadorSection inline (335 linhas) em HubFundos** — extrair para componente próprio | `HubFundos.tsx:240–574` | 1–2h | Pode ser pré-launch (puro presentacional) |
| C3 | **Naming inconsistente:** `FIDCPanel` vs `FidcHub` vs `FidcLamina` — caps mistas | 2 arquivos + ~5 imports | 30min | Pós-launch (touch ~30 linhas, low risk) |
| C4 | **32 ocorrências de `: any`** concentradas em FidcLamina (12) + FiiLamina (6) — risco de runtime errors | Lamina pages | 1.5h | Pós-launch |
| C5 | **Lamina KPI grids duplicados** (16+ instances de pattern similar entre FidcLamina/FiiLamina/FundLamina) — não usam `SimpleKPICard` | 3 arquivos | 1h | Pós-launch |
| C6 | **Direct Supabase calls fora de hooks:** `EarlyAccessForm.tsx` (landing) | 1 arquivo | 30min | Pós-launch |

---

## 📐 Plano de Sprint (3 sprints × 13 dias)

### Sprint S1 — Stabilization (3 dias: 18–20/04)
**Goal:** zero bugs P0 + ganhos de performance imediatos.
- ✅ Fix 5 bugs P0 (Math.max em vazio, sparkline NaN, healthIndex Infinity, Stripe race, ResetPassword leak) + batch fix Math.max em outros 5 arquivos — **~4h**
- ✅ Quick wins perf P1+P2+P3 (useInsightsFeed key, chart animation guard, recharts chunk split) — **~1h**
- ✅ Smoke test: login → todos módulos → lâminas → comparador → portfolio
- ✅ Deploy + monitor 24h

**Saída:** Build estável, beta tester sem bugs visíveis.

### Sprint S2 — UX/UI Polish (5 dias: 21–25/04)
**Goal:** transformar "beta" em "production-ready polish" — consistência visual.
- ✅ U1 Tipografia: 6 tiers padronizados — 2h
- ✅ U2 Tabelas overflow mobile + gradient hint — 1.5h
- ✅ U3 Grids responsive prefixes — 45min
- ✅ U4 A11y aria-labels icon buttons — 45min
- ✅ U5 Focus rings consistentes — 1h
- ✅ U6 Color tokens semânticos — 3h
- ✅ U7 Hover/transition patterns — 2h
- ✅ Mobile audit on real device (Pedro pode testar)

**Saída:** Visual coerente, mobile-friendly, acessível.

### Sprint S3 — Launch Prep (5 dias: 26–30/04)
**Goal:** items remanescentes da Semana 3 do beta sprint + go-live.
- ✅ Dashboard hero (KPIs consolidados na landing Hub)
- ✅ Smoke test E2E completo
- ✅ SEO/OG meta tags páginas Hub
- ✅ Error tracking (Sentry ou similar)
- ✅ Convidar 9 beta testers restantes (Edge Function `invite-beta-user` já pronta)
- ✅ Beta feedback quick fixes
- ✅ Verificar SITE_URL Supabase Auth + Redirect URLs wildcard
- ✅ Deploy production + monitoring
- ✅ Launch público 30/04

---

## 📦 Pós-Launch (Maio — sprint qualidade técnica)

Refactors maiores que valem mas não devem ser feitos no sprint final:
- C1: Split `useHubFundos.ts` em 4 hooks (2–3h)
- C2: Extrair `ComparadorSection` (1–2h, pode adiantar para S2 se houver folga)
- C3: Renomear FIDCPanel/FIIPanel para PascalCase consistente
- C4: Eliminar 32 `any` types em Laminas (1.5h)
- C5: Consolidar Lamina KPI grids em `LaminaKPIGrid` shared (1h)
- Mover EarlyAccessForm Supabase calls para hook
- Refactor páginas 1000+ linhas (HubFundos 1398, OfertasRadar 1442, HubPortfolio 1121) — split em sections

---

## 📊 Métricas do Audit

| Métrica | Valor |
|---|---|
| Páginas auditadas | 20 |
| Componentes hub | 51 |
| Linhas de código TSX (src/pages) | ~12.000 |
| Edge Functions | 12 |
| Bugs P0 confirmados | 5 (+5 latentes mesma classe) |
| Bugs P1 latentes | 5 |
| Wins de perf P0/P1 | 3 quick + 7 médio |
| Wins de UX/UI consistência | 7 |
| Refactors P2 (pós-launch) | 6 |
| `: any` no codebase | 32 (concentrados em 2 arquivos) |
| Componentes dead | 0 ✓ |
| Files > 600 linhas | 11 |
| Bundle JS gzip | ~550 KB ✓ |
| Lazy-loaded routes | 15/17 ✓ |

---

## 🎯 Top 3 Decisões para Lucas

1. **Aprovar Sprint S1 hoje** (~5h de trabalho) — bugs P0 + 3 quick wins perf. Risco baixíssimo, retorno alto.
2. **Aprovar Sprint S2 (UX polish, ~11h) para semana 21–25/04** — transforma percepção do produto sem mexer em arquitetura.
3. **Adiar refactors C1/C2/C4/C5 para sprint pós-launch (Maio)** — não vale o risco a 13 dias do launch público.

---

**Estimativa total pré-launch:** ~16h de trabalho técnico + tempo de feedback/teste/deploy. Cabe nos 13 dias com folga.
