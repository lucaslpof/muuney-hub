/**
 * OnboardingTour — First-visit guided tour for beta testers.
 * Shows a sequence of tooltip-like steps with spotlight highlighting on target elements.
 * Uses localStorage to track if tour has been completed.
 * Syncs completion status to Supabase profiles table.
 * Tech-Noir aesthetic with green accent.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  X, ArrowRight, ArrowLeft,
  TrendingUp, BarChart3, Landmark, PieChart, ScrollText, Banknote, MessageSquarePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TOUR_KEY = "muuney_hub_onboarding_done";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  route?: string;
  targetSelector?: string; // CSS selector for spotlight element
  placement?: "top" | "bottom" | "left" | "right"; // tooltip placement relative to target
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
    targetSelector: 'a[href="/macro"]',
    placement: "right",
  },
  {
    title: "Módulo de Crédito",
    description: "Spreads, inadimplência, concessões por modalidade, heatmaps e análise de risco do SFN com 73 séries BACEN.",
    icon: <BarChart3 size={24} className="text-[#10B981]" />,
    route: "/credito",
    targetSelector: 'a[href="/credito"]',
    placement: "right",
  },
  {
    title: "Renda Fixa",
    description: "Curva DI, NTN-B, Tesouro Direto, crédito privado — com simuladores de yield curve e calculadora de bonds.",
    icon: <Banknote size={24} className="text-[#6366F1]" />,
    route: "/renda-fixa",
    targetSelector: 'a[href="/renda-fixa"]',
    placement: "right",
  },
  {
    title: "Módulo Fundos",
    description: "29.491 classes de fundos RCVM 175. Lâminas, screener multi-filtro, comparador cross-class com Fund Score™, deep modules FIDC e FII.",
    icon: <PieChart size={24} className="text-[#F59E0B]" />,
    route: "/fundos",
    targetSelector: 'a[href="/fundos"]',
    placement: "right",
  },
  {
    title: "Ofertas Públicas",
    description: "Pipeline de emissões CVM — debêntures, CRI, CRA, FIDCs, FIIs e ações. Timeline, filtros avançados e estatísticas por tipo de ativo.",
    icon: <ScrollText size={24} className="text-amber-400" />,
    route: "/ofertas",
    targetSelector: 'a[href="/ofertas"]',
    placement: "right",
  },
  {
    title: "Seu feedback é essencial",
    description: "Use o botão verde no canto inferior direito para reportar bugs, sugerir melhorias ou avaliar qualquer seção. Sua opinião molda o produto.",
    icon: <MessageSquarePlus size={24} className="text-[#0B6C3E]" />,
    targetSelector: 'button[data-tour="feedback"]',
    placement: "top",
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
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

  const completeTour = useCallback(async () => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {
      // noop
    }
    // Sync to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_done: true })
          .eq("id", user.id);
      }
    } catch {
      // silent fail — localStorage is primary
    }
  }, []);

  const dismiss = useCallback(async () => {
    setVisible(false);
    await completeTour();
  }, [completeTour]);

  const next = useCallback(async () => {
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (STEPS[nextStep].route && location.pathname !== STEPS[nextStep].route) {
        navigate(STEPS[nextStep].route!);
      }
    } else {
      await completeTour();
      setVisible(false);
    }
  }, [step, navigate, completeTour, location.pathname]);

  const prev = useCallback(() => {
    if (step > 0) {
      const prevStep = step - 1;
      setStep(prevStep);
      if (STEPS[prevStep].route && location.pathname !== STEPS[prevStep].route) {
        navigate(STEPS[prevStep].route!);
      }
    }
  }, [step, navigate, location.pathname]);

  // Update spotlight when step or target selector changes
  useEffect(() => {
    setTargetRect(null);
    const current = STEPS[step];
    if (!current.targetSelector) return;

    const timeoutId = setTimeout(() => {
      const el = document.querySelector(current.targetSelector!);
      if (el) {
        // Only scroll and spotlight on desktop (viewport >= 768px)
        if (window.innerWidth >= 768) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            const rect = el.getBoundingClientRect();
            setTargetRect(rect);
          }, 300);
        }
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [step]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const getCardStyle = (): React.CSSProperties => {
    if (!targetRect || isMobile) return {}; // centered via flexbox on mobile
    const gap = 16;
    switch (current.placement) {
      case "right":
        return {
          position: "fixed",
          top: Math.max(16, targetRect.top + targetRect.height / 2 - 60),
          left: targetRect.right + gap,
          zIndex: 61,
        };
      case "bottom":
        return {
          position: "fixed",
          top: targetRect.bottom + gap,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 450)),
          zIndex: 61,
        };
      case "top":
        return {
          position: "fixed",
          top: Math.max(16, targetRect.top - gap - 220),
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 450)),
          zIndex: 61,
        };
      case "left":
        return {
          position: "fixed",
          top: Math.max(16, targetRect.top + targetRect.height / 2 - 60),
          right: window.innerWidth - targetRect.left + gap,
          zIndex: 61,
        };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div className="fixed inset-0 bg-black/60 z-[60] transition-opacity" onClick={dismiss} />

      {/* Spotlight highlight for target element */}
      {targetRect && !isMobile && (
        <div
          className="fixed z-[60] rounded-lg ring-4 ring-[#0B6C3E]/50 animate-pulse"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.75)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Tour card */}
      <div
        className="w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] transition-all duration-200"
        style={getCardStyle()}
      >
        {!targetRect || isMobile ? (
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[61]">
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
        ) : (
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
        )}
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
