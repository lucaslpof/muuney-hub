/**
 * Observability layer for muuney.hub
 * Lightweight error tracking + performance monitoring.
 * Ready for Sentry/LogRocket integration when budget allows.
 */

interface ErrorContext {
  componentStack?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

interface PerformanceEntry {
  name: string;
  duration: number;
  timestamp: number;
}

const ERROR_LOG_KEY = "muuney_hub_errors";
const MAX_STORED_ERRORS = 50;

/**
 * Log an error to console and persist to localStorage for debugging.
 * When Sentry is integrated, replace the body of this function.
 */
export function logError(error: Error, context?: ErrorContext): void {
  const entry = {
    message: error.message,
    stack: error.stack,
    source: context?.source ?? "unknown",
    componentStack: context?.componentStack,
    metadata: context?.metadata,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  // Console output (dev + prod)
  console.error("[muuney.hub] Error tracked:", entry);

  // Persist to localStorage for debug inspection
  try {
    const stored = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]") as unknown[];
    stored.unshift(entry);
    localStorage.setItem(
      ERROR_LOG_KEY,
      JSON.stringify(stored.slice(0, MAX_STORED_ERRORS))
    );
  } catch {
    // localStorage unavailable — silent fail
  }

  // TODO: Send to Sentry/external service
  // Sentry.captureException(error, { extra: context });
}

/**
 * Log a warning (non-fatal) — useful for degraded API responses.
 */
export function logWarning(message: string, metadata?: Record<string, unknown>): void {
  console.warn("[muuney.hub] Warning:", message, metadata);
}

/**
 * Track a performance metric.
 */
export function trackPerformance(name: string, duration: number): void {
  const entry: PerformanceEntry = {
    name,
    duration,
    timestamp: Date.now(),
  };

  if (import.meta.env.DEV) {
    console.debug("[muuney.hub] Perf:", entry);
  }

  // TODO: Send to analytics
}

/**
 * Global unhandled error & rejection listeners.
 * Call once in main.tsx.
 */
export function initErrorTracking(): void {
  window.addEventListener("error", (event) => {
    logError(event.error instanceof Error ? event.error : new Error(event.message), {
      source: "window.onerror",
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

    logError(error, { source: "unhandledrejection" });
  });

  // Web Vitals (if available)
  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          trackPerformance(entry.name, entry.duration);
        }
      });
      observer.observe({ entryTypes: ["largest-contentful-paint", "first-input", "layout-shift"] });
    } catch {
      // PerformanceObserver not fully supported — ignore
    }
  }
}

/**
 * Retrieve stored errors (for debug console).
 */
export function getStoredErrors(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || "[]") as unknown[];
  } catch {
    return [];
  }
}

/**
 * Clear stored errors.
 */
export function clearStoredErrors(): void {
  localStorage.removeItem(ERROR_LOG_KEY);
}
