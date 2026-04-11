import { Link } from "react-router-dom";
import { Check, X, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  const { tier, isPro, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16">
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
              <button
                onClick={() => {
                  // TODO: integrate Stripe/Pagar.me checkout
                  alert(
                    "Checkout em breve. Deixe seu email em contato@muuney.com.br para early-access."
                  );
                }}
                className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white rounded-lg font-medium transition-colors"
              >
                Fazer upgrade
              </button>
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
