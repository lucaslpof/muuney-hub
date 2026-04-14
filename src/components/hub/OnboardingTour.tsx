/**
 * OnboardingTour — First-visit guided tour for beta testers.
 * Shows a sequence of tooltip-like steps highlighting key modules.
 * Uses localStorage to track if tour has been completed.
 * Tech-Noir aesthetic with green accent.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X, ArrowRight, ArrowLeft,
  TrendingUp, BarChart3, Landmark, PieChart, ScrollText, Banknote, MessageSquarePlus,
} from "lucide-react";

const TOUR_KEY = "muuney_hub_onboarding_done";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  route?: string;
  highlight?: string; // optional element selector to point at
}

const STEPS: TourStep[] = [
  {
    title: "Bem-vindo ao Muuney.hub",
    description: "Seu terminal de inteligência de mercado com dados oficiais BACEN e CVM. Vamos conhecer os módulos disponíveis.",
    icon: <Landmark size={24} className="text-[#0B6C3E]" />,
    route: "/dashboard",
  },
  {
    title: "Panorama Macro",
    description: "Selic, IPCA, câmbio, PIB, mercado de trabalho e expectativas Focus — tudo em tempo real com regime detection e cross-signals.",
    icon: <TrendingUp size={24} className="text-[#0B6C3E]" />,
    route: "/macro",
  },
  {
    title: "Módulo de Crédito",
    description: "Spreads, inadimplência, concessões por modalidade, heatmaps e análise de risco do SFN com 73 séries BACEN.",
    icon: <BarChart3 size={24} className="text-[#10B981]" />,
    route: "/credito",
  },
  {
    title: "Renda Fixa",
    description: "Curva DI, NTN-B, Tesouro Direto, crédito privado — com simuladores de yield curve e calculadora de bonds.",
    icon: <Banknote size={24} className="text-[#6366F1]" />,
    route: "/renda-fixa",
  },
  {
    title: "Módulo Fundos",
    description: "29.491 classes de fundos RCVM 175. Lâminas, screener multi-filtro, comparador cross-class com Fund Score™, deep modules FIDC e FII.",
    icon: <PieChart size={24} className="text-[#F59E0B]" />,
    route: "/fundos",
  },
  {
    title: "Ofertas Públicas",
    description: "Pipeline de emissões CVM — debêntures, CRI, CRA, FIDCs, FIIs e ações. Timeline, filtros avançados e estatísticas por tipo de ativo.",
    icon: <ScrollText size={24} className="text-amber-400" />,
    route: "/ofertas",
  },
  {
    title: "Seu feedback é essencial",
    description: "Use o botão verde no canto inferior direito para reportar bugs, sugerir melhorias ou avaliar qualquer seção. Sua opinião molda o produto.",
    icon: <MessageSquarePlus size={24} className="text-[#0B6C3E]" />,
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_KEY);
      if (!done) {
        // Small delay to let the dashboard render first
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage blocked — skip tour
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // noop
    }
  }, []);

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (STEPS[nextStep].route && location.pathname !== STEPS[nextStep].route) {
        navigate(STEPS[nextStep].route!);
      }
    } else {
      dismiss();
    }
  }, [step, navigate, dismiss, location.pathname]);

  const prev = useCallback(() => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      if (STEPS[prevStep].route && location.pathname !== STEPS[prevStep].route) {
        navigate(STEPS[prevStep].route!);
      }
    }
  }, [step, navigate, location.pathname]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[60] transition-opacity" onClick={dismiss} />

      {/* Tour card */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px]">
        <div className="bg-zinc-900/50 border border-[#0B6C3E]/30 rounded-2xl shadow-2xl shadow-[#0B6C3E]/10 overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-[#1a1a1a]">
            <div
              className="h-full bg-[#0B6C3E] transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Close */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <X size={16} />
            </button>

            {/* Icon + Step indicator */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#0a0a0a] border border-zinc-800/50 flex items-center justify-center">
                {current.icon}
              </div>
              <span className="text-[9px] text-zinc-600 font-mono uppercase tracking-wider">
                {step + 1} de {STEPS.length}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">
              {current.title}
            </h2>

            {/* Description */}
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              {current.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={dismiss}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 font-mono transition-colors"
              >
                Pular tour
              </button>
              <div className="flex gap-2">
                {step > 0 && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#222] text-zinc-400 text-xs font-medium hover:border-zinc-600 transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Anterior
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-[#0B6C3E] text-white text-xs font-medium hover:bg-[#0B6C3E]/80 transition-colors"
                >
                  {isLast ? "Começar" : "Próximo"}
                  {!isLast && <ArrowRight size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Hook to reset the onboarding tour (for testing) */
export function useResetOnboarding() {
  return () => {
    try {
      localStorage.removeItem(TOUR_KEY);
      window.location.reload();
    } catch {
      // noop
    }
  };
}
