import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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

const CHECKOUT_FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? "https://yheopprbuimsunqfaqbp.supabase.co"}/functions/v1/stripe-checkout`;

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
  const { tier, isPro, isAdmin, refreshTier } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState(false);
  const [cancelledBanner, setCancelledBanner] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmTimeout, setConfirmTimeout] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle checkout return — poll for tier upgrade with timeout
  useEffect(() => {
    const status = searchParams.get("status");
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
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
            <p className="text-[#0B6C3E] text-xs mb-6">
              ou R$ 490/ano (2 meses grátis)
            </p>
            {isPro ? (
              <button
                disabled
                className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-lg font-medium cursor-not-allowed"
              >
                Plano atual
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => startCheckout("monthly")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === "monthly" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecionando…
                    </>
                  ) : (
                    "Assinar mensal — R$ 49/mês"
                  )}
                </button>
                <button
                  onClick={() => startCheckout("yearly")}
                  disabled={loading !== null}
                  className="w-full py-3 bg-transparent hover:bg-[#0B6C3E]/10 border border-[#0B6C3E]/50 disabled:opacity-60 disabled:cursor-not-allowed text-[#0B6C3E] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === "yearly" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecionando…
                    </>
                  ) : (
                    "Assinar anual — R$ 490/ano"
                  )}
                </button>
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
