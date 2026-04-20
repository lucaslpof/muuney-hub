import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";

export type UserTier = "free" | "pro" | "admin";

interface AuthState {
  user: User | null;
  session: Session | null;
  tier: UserTier;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  isPro: boolean;
  isAdmin: boolean;
  refreshTier: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Events that actually change the auth state and require a full reload
// (session + user + tier). TOKEN_REFRESHED is excluded because tier doesn't
// change on token rotation and re-fetching hub_user_tiers every hour is waste.
const AUTH_RELOAD_EVENTS: AuthChangeEvent[] = [
  "INITIAL_SESSION",
  "SIGNED_IN",
  "SIGNED_OUT",
  "USER_UPDATED",
  "PASSWORD_RECOVERY",
];

async function fetchTier(userId: string | undefined): Promise<UserTier> {
  if (!userId) return "free";
  try {
    const { data, error } = await supabase
      .from("hub_user_tiers")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return "free";
    return (data?.tier as UserTier) ?? "free";
  } catch {
    return "free";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    tier: "free",
    loading: true,
  });
  const abortRef = useRef<AbortController | null>(null);
  const currentUserIdRef = useRef<string | undefined>(undefined);
  // Flag set when signOut() is called by user action. Lets us distinguish
  // user-initiated sign-out from silent expirations (idle/revoked token).
  const userInitiatedSignOutRef = useRef(false);

  const loadSessionAndTier = useCallback(
    async (session: Session | null, signal?: AbortSignal) => {
      const user = session?.user ?? null;
      const tier = await fetchTier(user?.id);
      if (signal?.aborted) return;
      currentUserIdRef.current = user?.id;
      setState({ user, session, tier, loading: false });
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (signal.aborted) return;
      loadSessionAndTier(session, signal);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (signal.aborted) return;
      if (event === "SIGNED_OUT") {
        // If this wasn't triggered by signOut(), it's a silent expiration —
        // surface a toast so the user knows to log back in.
        if (!userInitiatedSignOutRef.current && currentUserIdRef.current) {
          toast({
            variant: "destructive",
            title: "Sessão expirada",
            description: "Por segurança, faça login novamente para continuar.",
          });
        }
        userInitiatedSignOutRef.current = false;
      }
      if (AUTH_RELOAD_EVENTS.includes(event)) {
        loadSessionAndTier(session, signal);
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Keep session fresh but don't re-fetch tier (it hasn't changed).
        setState((s) => ({ ...s, session, user: session.user ?? s.user }));
      }
    });

    // Refresh tier whenever the tab regains focus (covers Stripe checkout
    // returning to /upgrade or other cross-tab sync scenarios).
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const uid = currentUserIdRef.current;
      if (!uid) return;
      fetchTier(uid).then((tier) => {
        if (signal.aborted) return;
        setState((s) => (s.tier === tier ? s : { ...s, tier }));
      });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      controller.abort();
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [loadSessionAndTier]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    userInitiatedSignOutRef.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      userInitiatedSignOutRef.current = false;
      throw error;
    }
  }, []);

  const refreshTier = useCallback(async () => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const tier = await fetchTier(uid);
    if (abortRef.current?.signal.aborted) return;
    setState((s) => (s.tier === tier ? s : { ...s, tier }));
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signOut,
    isPro: state.tier === "pro" || state.tier === "admin",
    isAdmin: state.tier === "admin",
    refreshTier,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
