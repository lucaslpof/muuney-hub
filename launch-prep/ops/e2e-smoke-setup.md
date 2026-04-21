# Playwright E2E Smoke Setup — muuney.hub

**Status:** Tests written, CI workflow ready, secrets provisioning pending.
**Owner:** Lucas (GitHub secrets) → Claude (already wrote tests + CI).
**Last updated:** 21/Abr/2026

---

## What's already done (committed to repo)

- `playwright.config.ts` — chromium, pt-BR, São Paulo TZ, `PLAYWRIGHT_BASE_URL` env support.
- `e2e/smoke.spec.ts` — 5 tests:
  - `landing pública renderiza e expõe SEO tags` (always runs)
  - `login page renderiza formulário` (always runs)
  - `Dashboard hero KPIs renderizam` (skips if no creds)
  - `navega Macro → Crédito → Renda Fixa → Fundos → Ofertas` (skips if no creds)
  - `logout encerra sessão e volta para login` (skips if no creds)
- `.github/workflows/e2e-smoke.yml` — runs on PR + push to main + manual dispatch.
- `package.json` scripts: `npm run e2e`, `npm run e2e:ui`, `npm run e2e:install`.

Tests **skip gracefully** when `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` are unset — PRs from external contributors won't fail, only authenticated flows are skipped.

---

## Lucas: 3 steps to activate CI (≈5 min)

### 1. Create a dedicated beta tester account

Don't use your admin account (`lucas.lpof@gmail.com`) — CI would flip tiers + pollute feedback. Create:

```
Email: ci-smoke@muuney.com.br    (or any email you control)
Password: <strong random>
Tier: pro (via invite-beta-user Edge Function)
```

Use the invite Edge Function (from browser console logged as admin):

```js
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/invite-beta-user', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ emails: ['ci-smoke@muuney.com.br'], redirect_to: 'https://muuney.app/reset-password' })
});
await res.json();
```

Then set the password via the email flow or directly via Supabase Dashboard → Auth → Users.

### 2. Add GitHub secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|---|---|
| `E2E_USER_EMAIL` | `ci-smoke@muuney.com.br` |
| `E2E_USER_PASSWORD` | `<the password from step 1>` |

### 3. Trigger the workflow

- Push any commit to a PR branch → workflow runs automatically.
- Or manually: Actions tab → E2E Smoke → Run workflow → choose base URL.

Check Playwright HTML report in the Actions run artifacts (retained 14 days).

---

## Running locally

```bash
# Install Playwright browsers once
npm run e2e:install

# Run against production (default)
npm run e2e

# Run against local dev server
PLAYWRIGHT_BASE_URL=http://localhost:5173 npm run e2e

# Run against Vercel preview deploy
PLAYWRIGHT_BASE_URL=https://muuney-hub-git-branch-lucas.vercel.app npm run e2e

# Debug mode with Playwright UI
E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npm run e2e:ui
```

---

## What to add next (deferred)

- **Trial signup flow:** test Stripe checkout redirect (don't complete payment).
- **Portfolio create/add holding:** validates hub_user_portfolios RLS.
- **FIDC/FII lâmina** specific screenshots → visual regression.
- **Webhook replay:** separate workflow that hits `/functions/v1/stripe-webhook` with a test signature to validate the handler.

---

## Troubleshooting

- **Tests timeout on login:** Supabase Auth may have rate limits on the CI runner IP. Reduce test frequency or add retry logic.
- **Screenshots upload fails:** Check artifact size (> 500 MB gets truncated). Our config only keeps `on-failure`, should stay small.
- **BaseURL mismatch:** default is `https://muuney.app` — if prod moves to `hub.muuney.com.br` make it primary, update default.
- **Selectors break:** our smoke uses role-based + text locators (`getByRole`, `getByLabel`, `getByText`). Resilient to style refactors, fragile only to literal copy changes. If `Sair|logout` button label changes, update test.

---

## Files changed

- `playwright.config.ts` (new)
- `e2e/smoke.spec.ts` (new)
- `.github/workflows/e2e-smoke.yml` (new)
- `package.json` (+@playwright/test, +scripts)
- `.gitignore` (+playwright-report/, test-results/)
