# Sentry Setup — muuney.hub

**Status:** Code instrumented, DSN provisioning required.
**Owner:** Lucas (Sentry account) → Claude (already instrumented code).
**Last updated:** 21/Abr/2026

---

## What's already done (committed to repo)

- `src/lib/sentry.ts` — `initSentry()`, `setSentryUser()`, `forwardToSentry()`, `Sentry` re-export.
- `src/main.tsx` — calls `initSentry()` before `initErrorTracking()`, wraps `<App />` in `<Sentry.ErrorBoundary>` with Tech-Noir fallback UI.
- `src/lib/errorTracking.ts` — `logError()` forwards to Sentry (no-op if DSN unset).
- `src/hooks/useAuth.tsx` — `setSentryUser()` called on session load (correlates events to user ID + tier).
- `package.json` — `@sentry/react ^8.x` added as dep.
- `.env.example` — `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` documented.

**Without DSN**, Sentry is a silent no-op. No errors, no overhead, no noise.

---

## Lucas: 6 steps to activate (≈10 min)

### 1. Create Sentry project

- Login at https://sentry.io (use lucas.lpof@gmail.com or Anthropic SSO).
- New Project → Platform "React" → Alert frequency "Alert me on every new issue" → Team "muuney".
- Name it `muuney-hub`.

### 2. Copy DSN

- After create, Sentry shows a DSN like `https://abc123@o123456.ingest.sentry.io/789`.
- Dashboard anytime: Settings → Projects → muuney-hub → Client Keys (DSN).

### 3. Add to Vercel env vars

Vercel → Project `muuney-hub` → Settings → Environment Variables:

| Name | Value | Scope |
|---|---|---|
| `VITE_SENTRY_DSN` | `https://...` (paste from step 2) | Production, Preview |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Production |
| `VITE_SENTRY_ENVIRONMENT` | `preview` | Preview |
| `VITE_SENTRY_RELEASE` | `muuney-hub@${VERCEL_GIT_COMMIT_SHA}` | Production, Preview |

### 4. Redeploy

Trigger a Vercel redeploy (push any commit, or Deployments → Redeploy latest). First error will appear in Sentry within ~30s.

### 5. Optional: Source maps (for readable stack traces)

Install Sentry CLI locally once:

```bash
npm i -D @sentry/vite-plugin
```

Then add to `vite.config.ts`:

```ts
import { sentryVitePlugin } from "@sentry/vite-plugin";
// ...inside plugins array, after the React plugin:
sentryVitePlugin({
  org: "muuney",
  project: "muuney-hub",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { assets: "./dist/**" },
})
```

Add `SENTRY_AUTH_TOKEN` to Vercel env (Sentry → Settings → Auth Tokens → Create, scope: `project:releases`).

### 6. Set alerts

Sentry → Alerts → Create Alert Rule:
- **Trigger:** New issue in environment = production.
- **Action:** Send email to lucas.lpof@gmail.com + Slack if configured.
- **Ignore:** `ResizeObserver loop limit exceeded` (already in `ignoreErrors`).

---

## Edge Functions (deferred, optional)

Server-side Deno Edge Functions (stripe-checkout, stripe-webhook, hub-cvm-api, etc.) run separately from the React app. To capture their errors too:

1. Use `@sentry/deno` (not `@sentry/react`).
2. Init in each function: `Sentry.init({ dsn: Deno.env.get("SENTRY_DSN") })`.
3. Wrap handler in `Sentry.withScope(...)` or manually call `Sentry.captureException()` in catch blocks.
4. Set `SENTRY_DSN` as Supabase Edge Function secret (same DSN as frontend, or a separate project).

**Not launch-critical.** Current Edge Functions log to Supabase's `get_logs` and errors already surface there. Add when there's a recurring Edge issue to hunt down.

---

## What to watch first week post-launch

- **Error rate:** baseline should be < 10 errors/day across all users. Spike = deployment regression.
- **Top issues tab:** prioritize top 3 by user count, not event count.
- **User tier correlation:** errors on `pro` tier matter more than `free` (paying customers).
- **Transactions:** `tracesSampleRate: 0.1` in prod → 10% of navigation captured. Enough to spot slow routes (e.g., Renda Fixa chart > 3s).
- **Replays:** only 10% of sessions + 100% of error sessions. Watch replays of reported bugs before pinging user.

---

## Rollback

If Sentry costs blow up or noise is unbearable:

1. Remove `VITE_SENTRY_DSN` from Vercel env vars.
2. Redeploy → Sentry becomes silent no-op.
3. No code change needed.

---

## Pricing anchor

- **Developer plan (free):** 5K errors/mo, 10K transactions, 50 replays. Enough for beta (4-10 AAIs + Lucas/team).
- **Team plan ($26/mo):** 50K errors, 100K transactions, 500 replays. Upgrade if beta scales past 100 users.
- **Sampling:** `tracesSampleRate: 0.1` already conservative; reduce to `0.05` if quota pressure.

---

## Files changed

- `src/lib/sentry.ts` (new)
- `src/main.tsx` (init + ErrorBoundary wrap)
- `src/lib/errorTracking.ts` (forward to Sentry)
- `src/hooks/useAuth.tsx` (setSentryUser on auth change)
- `package.json` (+@sentry/react)
- `.env.example` (docs Sentry vars — already had commented entries)
