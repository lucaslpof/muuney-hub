import { Link } from "react-router-dom";
import { useAuth, UserTier } from "@/hooks/useAuth";

const TIER_RANK: Record<UserTier, number> = {
  free: 0,
  pro: 1,
  admin: 2,
};

interface RequireTierProps {
  tier: "pro" | "admin";
  children: React.ReactNode;
  /** Custom fallback; if omitted a default Paywall is shown */
  fallback?: React.ReactNode;
  /** Feature label used in default paywall messaging */
  feature?: string;
}

/**
 * Wraps a component/section requiring a minimum tier.
 * Free users see a Paywall CTA instead of the protected content.
 */
export function RequireTier({
  tier,
  children,
  fallback,
  feature = "este recurso",
}: RequireTierProps) {
  const { tier: userTier, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 rounded-full border-2 border-[#0B6C3E] border-t-transparent animate-spin" />
      </div>
    );
  }

  const userRank = TIER_RANK[userTier];
  const requiredRank = TIER_RANK[tier];

  if (userRank >= requiredRank) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return <InlinePaywall feature={feature} />;
}

export function InlinePaywall({ feature }: { feature: string }) {
  return (
    <div className="relative border border-[#0B6C3E]/30 bg-gradient-to-br from-[#0B6C3E]/5 to-transparent rounded-xl p-8 text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 mb-4">
        <svg
          className="w-3.5 h-3.5 text-[#0B6C3E]"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-[10px] text-[#0B6C3E] font-mono uppercase tracking-wider">
          Exclusivo Pro
        </span>
      </div>
      <h3 className="text-white text-lg font-semibold mb-2">
        Desbloqueie {feature}
      </h3>
      <p className="text-zinc-400 text-sm max-w-md mx-auto mb-6">
        Acesse insights avançados, screener multi-filtro, comparador cross-class
        e dados ilimitados com o plano Pro.
      </p>
      <Link
        to="/upgrade"
        className="inline-flex items-center gap-2 px-6 py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white font-medium rounded-lg transition-colors"
      >
        Fazer upgrade
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * BlurredPreview: shows content with blur + overlay CTA.
 * Used for features where we want to tease the Pro experience.
 */
export function BlurredPreview({
  children,
  feature = "este recurso",
  minTier = "pro",
}: {
  children: React.ReactNode;
  feature?: string;
  minTier?: "pro" | "admin";
}) {
  const { tier: userTier, loading } = useAuth();
  if (loading) return <>{children}</>;

  const userRank = TIER_RANK[userTier];
  const requiredRank = TIER_RANK[minTier];
  if (userRank >= requiredRank) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm opacity-60">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/60 backdrop-blur-sm rounded-xl">
        <InlinePaywall feature={feature} />
      </div>
    </div>
  );
}
