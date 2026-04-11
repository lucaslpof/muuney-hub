import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

const QUOTA_KEY = "muuney_hub_lamina_quota";
const FREE_DAILY_LIMIT = 3;

interface QuotaState {
  date: string; // YYYY-MM-DD
  viewed: string[]; // slugs viewed today
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readQuota(): QuotaState {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (!raw) return { date: today(), viewed: [] };
    const parsed = JSON.parse(raw) as QuotaState;
    if (parsed.date !== today()) return { date: today(), viewed: [] };
    return parsed;
  } catch {
    return { date: today(), viewed: [] };
  }
}

function writeQuota(state: QuotaState) {
  localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
}

/**
 * Enforces daily lâmina view quota for free users.
 * Pro/admin = unlimited. Free = 3 unique lâminas per day.
 *
 * Returns { allowed, remaining, registerView } — call registerView(slug) on
 * lâmina mount; allowed tells you whether to render content or paywall.
 */
export function useLaminaQuota(slug: string | undefined) {
  const { isPro, loading: authLoading } = useAuth();
  const [state, setState] = useState<QuotaState>(() => readQuota());
  const [registered, setRegistered] = useState(false);

  const registerView = useCallback(
    (viewSlug: string) => {
      if (isPro) return true;
      const current = readQuota();
      if (current.viewed.includes(viewSlug)) return true;
      if (current.viewed.length >= FREE_DAILY_LIMIT) return false;
      const next = { ...current, viewed: [...current.viewed, viewSlug] };
      writeQuota(next);
      setState(next);
      return true;
    },
    [isPro]
  );

  useEffect(() => {
    if (authLoading || !slug || registered) return;
    registerView(slug);
    setRegistered(true);
  }, [authLoading, slug, registered, registerView]);

  if (isPro) {
    return {
      allowed: true as const,
      remaining: Infinity,
      total: Infinity,
      isPro: true,
      registerView,
    };
  }

  const current = state;
  const alreadyViewed = slug ? current.viewed.includes(slug) : false;
  const atLimit = current.viewed.length >= FREE_DAILY_LIMIT;
  const allowed = alreadyViewed || !atLimit;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - current.viewed.length);

  return {
    allowed,
    remaining,
    total: FREE_DAILY_LIMIT,
    isPro: false,
    registerView,
  };
}
