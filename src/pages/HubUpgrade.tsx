import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X, Sparkles, Loader2, AlertCircle, Settings, Calendar, Clock, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HubSEO } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { pickFromListOrNull } from "@/lib/queryParams";

interface BillingStatus {
  plan: "monthly" | "yearly" | null;
  subscription_status: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86_400_000);
}

const STATUS_LABELS: Record<string, { label: string; tone: "emerald" | "amber" | "red" | "zinc" }> = {
  active: { label: "Ativa", tone: "emerald" },
  trialing: { label: "Período de teste", tone: "emerald" },
  past_due: { label: "Pagamento pendente", tone: "amber" },
  unpaid: { label: "Não paga", tone: "red" },
  canceled: { label: "Cancelada", tone: "red" },
  incomplete: { label: "Incompleta", tone: "amber" },
  incomplete_expired: { label: "Expirada", tone: "red" },
  paused: { label: "Pausada", tone: "amber" },
};

const TONE_CLASSES: Record<string, string> = {
  emerald: "bg-[#0B6C3E]/10 border-[#0B6C3E]/40 text-[#0B6C3E]",
  amber: "bg-amber-500/10 border-amber-500/40 text-amber-400",
  red: "bg-red-500/10 border-red-500/40 text-red-400",
  zinc: "bg-zinc-800 border-zinc-700 text-zinc-400",
};

const CHECKOUT_STATUSES = ["success", "cancelled"] as const;
type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];

interface Feature {
  label: string;
  free: boolean | string;
  pro: boolean | string;
}

const FEATURES: Feature[] = [
  { label: "Dashboard executivo", free: true, pro: true },
  { label: "Módulo Macro (73 séries BACEN)", free: true, pro: true },
  { label: "Módulo Crédito (73 séries + heatmaps)", free: true, pro: true },
  { label: "Módulo Renda Fixa (30 indicadores)", free: true, pro: true },
  { label: "Calculadoras financeiras", free: true, pro: true },
  { label: "Lâminas de fundos", free: "3 por dia", pro: "Ilimitadas" },
  { label: "Comparador de fundos", free: "2 fundos", pro: "Até 6 fundos cross-class" },
  { label: "Fund Score™ (4 pilares)", free: "Básico", pro: "Completo + benchmarks" },
  { label: "Insights & alertas automáticos", free: false, pro: true },
  { label: "Screener multi-filtro", free: false, pro: true },
  { label: "Módulo FIDC Deep (4.300 fundos)", free: false, pro: true },
  { label: "Módulo FII Deep (1.250 fundos)", free: false, pro: true },
  { label: "Módulo FIP Deep (2.190 fundos)", free: false, pro: true },
  { label: "Composição CDA completa", free: false, pro: true },
  { label: "Export CSV / PDF", free: false, pro: true },
  { label: "Priority support", free: false, pro: true },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://yheopprbuimsunqfaqbp.supabase.co";
const CHECKOUT_FN_URL = `${SUPABASE_URL}/functions/v1/stripe-checkout`;
const PORTAL_FN_URL = `${SUPABASE_URL}/functions/v1/stripe-portal`;

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <div className="flex items-center justify-center">
        <Check className="w-5 h-5 text-[#0B6C3E]" strokeWidth={2.5} />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex items-center justify-center">
        <X className="w-5 h-5 text-zinc-700" strokeWidth={2} />
      </div>
    );
  }
  return (
    <div className="text-center text-xs text-zinc-400 font-medium">{value}</div>
  );
}

export default function HubUpgrade() {
  const { user, tier, isPro, isAdmin, refreshTier } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState(false);
  const [cancelledBanner, setCancelledBanner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmTimeout, setConfirmTimeout] = useState(false);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch billing status for Pro users (not needed for admins — they bypass billing)
  useEffect(() => {
    if (!user?.id || !isPro || isAdmin) {
      setBilling(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: fetchErr } = await supabase
        .from("hub_user_tiers")
        .select("plan, subscription_status, current_period_end, trial_ends_at, cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchErr) {
        console.warn("Failed to fetch billing status:", fetchErr);
        return;
      }
      if (data) {
        setBilling({
          plan: (data.plan as BillingStatus["plan"]) ?? null,
          subscription_status: data.subscription_status ?? null,
          current_period_end: data.current_period_end ?? null,
          trial_ends_at: data.trial_ends_at ?? null,
          cancel_at_period_end: Boolean(data.cancel_at_period_end),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isPro, isAdmin, tier]);

  // Handle checkout return — poll for tier upgrade with timeout
  useEffect(() => {
    const status: CheckoutStatus | null = pickFromListOrNull(
      searchParams.get("status"),
      CHECKOUT_STATUSES,
    );
    if (status === "success") {
      setSuccessBanner(true);
      setConfirming(true);
      setConfirmTimeout(false);

      // Initial refresh after 2s (give webhook a head start)
      const initialDelay = setTimeout(() => {
        refreshTier();
      }, 2000);

      // Poll every 3s until tier becomes pro or 30s elapse
      pollRef.current = setInterval(() => {
        refreshTier();
      }, 3000);

      // Hard timeout at 30s
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setConfirming(false);
        setConfirmTimeout(true);
      }, 30_000);

      return () => {
        clearTimeout(initialDelay);
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollRef.current = null;
        timeoutRef.current = null;
      };
    }
    if (status === "cancelled") {
      setCancelledBanner(true);
    }
  }, [searchParams, refreshTier]);

  // Stop polling when tier upgrades successfully
  useEffect(() => {
    if (confirming && (tier === "pro" || tier === "admin")) {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      pollRef.current = null;
      timeoutRef.current = null;
      setConfirming(false);
    }
  }, [tier, confirming]);

  async function startCheckout(plan: "monthly" | "yearly") {
    setError(null);
    setLoading(plan);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;
      if (!jwt) {
        setError("Sessão expirada. Faça login novamente.");
        setLoading(null);
        return;
      }

      const res = await fetch(CHECKOUT_FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Checkout error: ${res.status}`);
      }

      const { url } = await res.json();
      if (!url) throw new Error("URL de checkout não retornada");

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(null);
    }
  }

  async function openBillingPortal() {
    setError(null);
    setPortalLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;
      if (!jwt) {
        setError("Sessão expirada. Faça login novamente.");
        setPortalLoading(false);
        return;
      }

      const res = await fetch(PORTAL_FN_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Portal error: ${res.status}`);
      }

      const { url } = await res.json();
      if (!url) throw new Error("URL do portal não retornada");

      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <HubSEO
        title="Upgrade Pro"
        description="Upgrade para muuney.hub Pro: lâminas ilimitadas, comparador 6 fundos, FIDC/FII Deep Modules, insights & alertas. R$49/mês ou R$490/ano."
        path="/upgrade"
        keywords="muuney pro, assinatura fintech, fundos premium, FIDC, FII, lâminas fundos"
        isProtected={true}
      />
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16">
        {/* Status banners */}
        {successBanner && confirming && (
          <div className="mb-8 px-4 py-3 bg-[#0B6C3E]/10 border border-[#0B6C3E]/40 rounded-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-[#0B6C3E] shrink-0 animate-spin" />
            <div>
              <p className="text-sm text-[#0B6C3E] font-semibold">Confirmando pagamento…</p>
              <p className="text-xs text-zinc-400">Estamos ativando seu acesso Pro. Isso costuma levar até 30 segundos.</p>
            </div>
          </div>
        )}
        {successBanner && !confirming && !confirmTimeout && (isPro || isAdmin) && (
          <div className="mb-8 px-4 py-3 bg-[#0B6C3E]/10 border border-[#0B6C3E]/40 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-[#0B6C3E] shrink-0" />
            <div>
              <p className="text-sm text-[#0B6C3E] font-semibold">Acesso Pro ativado ✓</p>
              <p className="text-xs text-zinc-400">Tudo pronto. Aproveite os módulos avançados do Hub.</p>
            </div>
          </div>
        )}
        {successBanner && confirmTimeout && (
          <div className="mb-8 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-amber-400 font-semibold">Pagamento processado, confirmação demorando</p>
              <p className="text-xs text-zinc-400 mt-1">
                Atualize a página em alguns minutos. Se o acesso não for liberado, escreva para{" "}
                <a href="mailto:contato@muuney.com.br" className="text-amber-300 underline">
                  contato@muuney.com.br
                </a>{" "}
                — vamos resolver na hora.
              </p>
              <button
                onClick={() => {
                  setConfirmTimeout(false);
                  setConfirming(true);
                  refreshTier();
                  pollRef.current = setInterval(() => refreshTier(), 3000);
                  timeoutRef.current = setTimeout(() => {
                    if (pollRef.current) clearInterval(pollRef.current);
                    pollRef.current = null;
                    setConfirming(false);
                    setConfirmTimeout(true);
                  }, 30_000);
                }}
                className="mt-2 text-xs text-amber-300 hover:text-amber-200 underline font-medium"
              >
                Tentar verificar novamente
              </button>
            </div>
          </div>
        )}
        {cancelledBanner && (
          <div className="mb-8 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm text-amber-400 font-semibold">Checkout cancelado</p>
              <p className="text-xs text-zinc-400">Nada foi cobrado. Você pode tentar novamente quando quiser.</p>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-8 px-4 py-3 bg-red-500/10 border border-red-500/40 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Billing status card (Pro only, non-admin) */}
        {isPro && !isAdmin && billing && (
          <div className="mb-8 bg-[#111111] border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                    Sua assinatura
                  </span>
                  {billing.subscription_status && STATUS_LABELS[billing.subscription_status] && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider ${
                        TONE_CLASSES[STATUS_LABELS[billing.subscription_status].tone]
                      }`}
                    >
                      {STATUS_LABELS[billing.subscription_status].label}
                    </span>
                  )}
                  {billing.cancel_at_period_end && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 border-amber-500/40 text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      Cancelamento agendado
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">
                      Plano
                    </p>
                    <p className="text-white font-medium">
                      {billing.plan === "yearly" ? "Pro Anual · R$ 490/ano" : billing.plan === "monthly" ? "Pro Mensal · R$ 49/mês" : "Pro"}
                    </p>
                  </div>
                  {billing.subscription_status === "trialing" && billing.trial_ends_at && (
                    <div>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Teste termina
                      </p>
                      <p className="text-[#0B6C3E] font-medium">
                        {formatDate(billing.trial_ends_at)}
                        {(() => {
                          const d = daysBetween(billing.trial_ends_at);
                          return d != null && d >= 0 ? (
                            <span className="text-zinc-500 text-xs ml-1.5">
                              ({d} {d === 1 ? "dia" : "dias"})
                            </span>
                          ) : null;
                        })()}
                      </p>
                    </div>
                  )}
                  {billing.current_period_end && (
                    <div>
                      <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {billing.cancel_at_period_end ? "Acesso até" : "Próxima cobrança"}
                      </p>
                      <p className="text-zinc-200 font-medium">
                        {formatDate(billing.current_period_end)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={openBillingPortal}
                disabled={portalLoading}
                className="shrink-0 py-2 px-4 bg-transparent hover:bg-[#0B6C3E]/10 border border-[#0B6C3E]/50 disabled:opacity-60 disabled:cursor-not-allowed text-[#0B6C3E] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Abrindo…
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4" />
                    Gerenciar
                  </>
                )}
              </button>
            </div>
            {billing.cancel_at_period_end && billing.current_period_end && (
              <p className="mt-4 text-xs text-amber-400/80">
                Sua assinatura foi cancelada e seu acesso Pro vai até {formatDate(billing.current_period_end)}.
                Você pode reativar a qualquer momento em "Gerenciar".
              </p>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#0B6C3E]" />
            <span className="text-[10px] text-[#0B6C3E] font-mono uppercase tracking-wider">
              muuney.hub Pro
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Inteligência de mercado,
            <br />
            <span className="text-[#0B6C3E]">sem limites.</span>
          </h1>
          <p className="text-zinc-400 text-base md:text-lg max-w-2xl mx-auto">
            Acesso ilimitado a dados CVM, insights automáticos, screener avançado
            e módulos deep de FIDC, FII e FIP.
          </p>
          {isAdmin && (
            <div className="mt-4 inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/30 rounded-full">
              <span className="text-xs text-violet-400 font-mono">
                Você é ADMIN — acesso total liberado
              </span>
            </div>
          )}
          {isPro && !isAdmin && (
            <div className="mt-4 inline-block px-3 py-1 bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 rounded-full">
              <span className="text-xs text-[#0B6C3E] font-mono">
                Você já é Pro ✓
              </span>
            </div>
          )}
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* FREE */}
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-8">
            <div className="mb-6">
              <h2 className="text-white text-xl font-semibold mb-1">Free</h2>
              <p className="text-zinc-500 text-sm">Para explorar o mercado</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold text-white">R$ 0</span>
              <span className="text-zinc-500 text-sm ml-2">/mês</span>
            </div>
            {tier === "free" ? (
              <button
                disabled
                className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-lg font-medium cursor-not-allowed"
              >
                Plano atual
              </button>
            ) : (
              <Link
                to="/dashboard"
                className="block w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-center rounded-lg font-medium transition-colors"
              >
                Continuar grátis
              </Link>
            )}
          </div>

          {/* PRO */}
          <div className="relative bg-gradient-to-br from-[#0B6C3E]/10 to-transparent border-2 border-[#0B6C3E]/50 rounded-2xl p-8">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#0B6C3E] text-white text-[10px] font-mono uppercase tracking-wider rounded-full">
              Recomendado
            </div>
            <div className="mb-6">
              <h2 className="text-white text-xl font-semibold mb-1">Pro</h2>
              <p className="text-zinc-500 text-sm">Para investidores sérios</p>
            </div>
            <div className="mb-2">
              <span className="text-4xl font-bold text-white">R$ 49</span>
              <span className="text-zinc-500 text-sm ml-2">/mês</span>
            </div>
            <p className="text-[#0B6C3E] text-xs mb-3">
              ou R$ 490/ano (2 meses grátis)
            </p>
            {!isPro && (
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 mb-4">
                <Sparkles className="w-3 h-3 text-[#0B6C3E]" />
                <span className="text-[10px] text-[#0B6C3E] font-mono uppercase tracking-wider">
                  14 dias grátis
                </span>
              </div>
            )}
            {isPro ? (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-lg font-medium cursor-not-allowed"
                >
                  Plano atual
                </button>
                {!isAdmin && (
                  <button
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                    className="w-full py-3 bg-transparent hover:bg-[#0B6C3E]/10 border border-[#0B6C3E]/50 disabled:opacity-60 disabled:cursor-not-allowed text-[#0B6C3E] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {portalLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Abrindo…
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4" />
                        Gerenciar assinatura
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => startCheckout("monthly")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex flex-col items-center justify-center gap-0.5"
                >
                  {loading === "monthly" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecionando…
                    </span>
                  ) : (
                    <>
                      <span>Começar 14 dias grátis</span>
                      <span className="text-[11px] text-white/70 font-normal">Depois R$ 49/mês</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => startCheckout("yearly")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-transparent hover:bg-[#0B6C3E]/10 border border-[#0B6C3E]/50 disabled:opacity-60 disabled:cursor-not-allowed text-[#0B6C3E] rounded-lg font-medium transition-colors flex flex-col items-center justify-center gap-0.5"
                >
                  {loading === "yearly" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecionando…
                    </span>
                  ) : (
                    <>
                      <span>Começar 14 dias grátis (anual)</span>
                      <span className="text-[11px] text-[#0B6C3E]/80 font-normal">Depois R$ 490/ano · 2 meses grátis</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
                  Cartão cobrado apenas após o trial. Cancele a qualquer momento.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Feature matrix */}
        <div className="bg-[#111111] border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_120px] md:grid-cols-[2fr_160px_160px] border-b border-zinc-800">
            <div className="px-4 md:px-6 py-4 text-xs text-zinc-500 uppercase tracking-wider font-mono">
              Recurso
            </div>
            <div className="px-4 py-4 text-xs text-zinc-500 uppercase tracking-wider font-mono text-center">
              Free
            </div>
            <div className="px-4 py-4 text-xs text-[#0B6C3E] uppercase tracking-wider font-mono text-center">
              Pro
            </div>
          </div>
          {FEATURES.map((feature, idx) => (
            <div
              key={feature.label}
              className={`grid grid-cols-[1fr_120px_120px] md:grid-cols-[2fr_160px_160px] ${
                idx !== FEATURES.length - 1 ? "border-b border-zinc-900" : ""
              }`}
            >
              <div className="px-4 md:px-6 py-3 text-sm text-zinc-300">
                {feature.label}
              </div>
              <div className="px-4 py-3">
                <FeatureCell value={feature.free} />
              </div>
              <div className="px-4 py-3">
                <FeatureCell value={feature.pro} />
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center mt-12">
          <p className="text-zinc-500 text-sm">
            Dúvidas? Fale com a gente em{" "}
            <a
              href="mailto:contato@muuney.com.br"
              className="text-[#0B6C3E] hover:underline"
            >
              contato@muuney.com.br
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
