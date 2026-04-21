/**
 * Sentry wire-up for muuney.hub React app.
 *
 * Activation:
 * 1. Lucas provisiona a conta Sentry (projeto "muuney-hub", platform "React").
 * 2. Copia o DSN para `.env` como `VITE_SENTRY_DSN=https://...`.
 * 3. Opcional: `VITE_SENTRY_ENVIRONMENT=production` (default: import.meta.env.MODE).
 * 4. Opcional: `VITE_SENTRY_RELEASE=<commit-sha>` para source-map correlation.
 *
 * Sem DSN, initSentry() vira no-op silencioso — não trava build, não polui console.
 * Toda captura de erro passa por logError() em errorTracking.ts, que chama
 * captureException() daqui se Sentry estiver inicializado.
 */
import * as Sentry from "@sentry/react";

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
  import.meta.env.MODE;
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined;

let initialized = false;

export function initSentry(): void {
  if (!DSN) {
    // Sem DSN — Sentry fica desligado. Não é erro.
    return;
  }
  if (initialized) return;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance: sample 10% das transações em prod, 100% em dev
    tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
    // Session replay: 10% de sessões, 100% de sessões com erro
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Rotas do hub incluídas nas transações
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/muuney\.app/,
      /^https:\/\/hub\.muuney\.com\.br/,
      /^https:\/\/yheopprbuimsunqfaqbp\.supabase\.co/,
    ],
    // Reduz ruído de erros conhecidos (extensões, ad-blockers)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      /Non-Error promise rejection captured/i,
      /Network request failed/i, // fallback: hub_feedback já captura
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],
  });

  initialized = true;
}

export function isSentryEnabled(): boolean {
  return initialized;
}

/**
 * Forward para Sentry.captureException se inicializado. No-op caso contrário.
 * Chamado por logError() em errorTracking.ts.
 */
export function forwardToSentry(
  error: Error,
  context?: { source?: string; componentStack?: string; metadata?: Record<string, unknown> }
): void {
  if (!initialized) return;
  Sentry.captureException(error, {
    tags: { source: context?.source ?? "unknown" },
    contexts: context?.metadata ? { custom: context.metadata } : undefined,
    extra: context?.componentStack ? { componentStack: context.componentStack } : undefined,
  });
}

/**
 * Identifica usuário autenticado para correlation. Chamado pelo AuthProvider.
 */
export function setSentryUser(user: { id: string; email?: string; tier?: string } | null): void {
  if (!initialized) return;
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email, segment: user.tier });
  } else {
    Sentry.setUser(null);
  }
}

export { Sentry };
