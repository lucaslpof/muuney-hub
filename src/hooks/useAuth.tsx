import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

  const loadSessionAndTier = useCallback(async (session: Session | null) => {
    const user = session?.user ?? null;
    const tier = await fetchTier(user?.id);
    setState({ user, session, tier, loading: false });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadSessionAndTier(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadSessionAndTier(session);
    });

    return () => subscription.unsubscribe();
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const refreshTier = useCallback(async () => {
    if (!state.user?.id) return;
    const tier = await fetchTier(state.user.id);
    setState((s) => ({ ...s, tier }));
  }, [state.user?.id]);

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
