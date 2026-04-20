# muuney.hub

B2B market intelligence platform for agentes autônomos de investimentos (AAIs).
Built by **FLUXX CASH TECNOLOGIA LTDA** on BACEN SGS + CVM regulatory feeds.

**Live:** https://hub.muuney.com.br
**Beta launch:** 30/04/2026

---

## Quick Start

Prerequisites: Node 20+, npm, a Supabase anon key for project `yheopprbuimsunqfaqbp`.

```bash
# Install
npm install

# Configure env
cp .env.example .env.local
# Edit .env.local with your VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY

# Run dev server (http://localhost:5173)
npm run dev

# Type-check + build
npx tsc --noEmit
npm run build

# Preview production build
npm run preview
```

Environment variables are documented in `.env.example`. Only `VITE_*` keys are
exposed to the browser bundle. Edge Function secrets (Stripe, Resend, service
role) live in the Supabase dashboard — never in `.env.local`.

---

## Stack

- React 18 + TypeScript strict + Vite 5
- Tailwind CSS 3.4 + shadcn/ui + Recharts
- Supabase (auth, Postgres, Edge Functions, RLS)
- React Query (staleTime-tuned per domain)
- Vercel (auto-deploy on push to `main`)

---

## Key Directories

```
src/
  components/hub/   — shared hub primitives (MacroChart, KPICard, SkeletonLoader…)
  contexts/         — HubSectionsContext, auth, etc.
  hooks/            — useAuth, useHubData, useHubFundos, useFeedback, …
  integrations/     — supabase client
  lib/              — pure utilities (statistics, fundScore, csvExport, kpiHints…)
  pages/            — 30+ routes (Hub*, Fundo*, Fidc*, Fii*, Ofertas…)
supabase/
  functions/        — Edge Functions (hub-cvm-api, hub-fidc-api, stripe-*, …)
  migrations/       — Postgres migrations (ordered)
```

---

## Beta Access

Beta testers are pre-provisioned via the `invite-beta-user` Edge Function
(admin-only). Invitees hit `/primeiro-acesso`, set a password, and are
auto-promoted to `tier=pro` via the `auto_promote_beta_invitee` DB trigger.

Full auth + premium gates: see "Auth & Premium Gates" in `CLAUDE.md`.

---

## Deployment

Vercel auto-deploys on push to `main`. Branch previews are not currently enabled.
SPA routing is handled by `vercel.json` (catch-all rewrite to `index.html`).

After merging, verify in this order:
1. Vercel deployment succeeded (https://vercel.com/dashboard)
2. Smoke-check auth flow at https://hub.muuney.com.br/login
3. Spot-check a Pro-gated page (e.g. /fundos/fidc)

---

## Docs

- `CLAUDE.md` — full project context + history (private)
- `SMOKE_TEST_BETA_30ABR.md` — pre-launch E2E checklist
- `AUDIT_*.md` — module-specific deep audits (Fundos, Crédito, Renda Fixa, Macro)
- `SPEC_*.md` — product specs for major features
- `launch-prep/` — operational playbooks + launch-week runbooks

---

## Aesthetic

Tech-Noir: `#0a0a0a` background, `#0B6C3E` primary accent, JetBrains Mono for
numeric/data UI. High contrast, minimal chrome, dense information design.
