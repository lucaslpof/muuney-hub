import { Outlet, useNavigate, Link } from "react-router-dom";
import { SidebarProvider, MobileMenuButton, useSidebar } from "./HubSidebar";
import { Helmet } from "react-helmet-async";
import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackWidget } from "./FeedbackWidget";
import { OnboardingTour } from "./OnboardingTour";
import { Toaster } from "@/components/ui/Toaster";
import { NetworkStatus } from "./NetworkStatus";
import { MobileNav } from "@/components/layout/MobileNav";
import {
  HubSectionsProvider,
  useHubSections,
} from "@/contexts/HubSectionsContext";

/**
 * Top-bar horizontal section navigator.
 * Picks up sections registered by the current page via MacroSidebar →
 * HubSectionsContext. When no sections are registered (e.g. landing/dashboard),
 * renders nothing.
 */
const TopBarSectionNav = () => {
  const ctx = useHubSections();
  if (!ctx || ctx.sections.length === 0) return null;

  return (
    <nav
      className="flex-1 min-w-0 overflow-x-auto scrollbar-none"
      aria-label="Navegação de seções da página"
    >
      <div className="flex gap-1.5 min-w-max">
        {ctx.sections.map((item) => {
          const isActive = ctx.activeId === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => ctx.navigate(item.id)}
              data-sidebar-id={item.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-[#0B6C3E]/15 text-[#0B6C3E] border border-[#0B6C3E]/30"
                  : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

const HubMain = () => {
  const { collapsed } = useSidebar();
  const { user, tier, isPro, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const sectionsCtx = useHubSections();
  const activeSectionLabel = sectionsCtx?.sections.find((s) => s.id === sectionsCtx.activeId)?.label;

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const tierBadge = isAdmin ? (
    <span className="hidden sm:inline-block px-1.5 py-0.5 bg-violet-500/10 border border-violet-500/30 rounded text-[9px] text-violet-400 font-mono uppercase tracking-wider">
      Admin
    </span>
  ) : isPro ? (
    <span className="hidden sm:inline-block px-1.5 py-0.5 bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 rounded text-[9px] text-[#0B6C3E] font-mono uppercase tracking-wider">
      Pro
    </span>
  ) : (
    <Link
      to="/upgrade"
      className="hidden sm:inline-block px-2 py-0.5 bg-zinc-800 hover:bg-[#0B6C3E]/20 border border-zinc-700 hover:border-[#0B6C3E]/50 rounded text-[9px] text-zinc-400 hover:text-[#0B6C3E] font-mono uppercase tracking-wider transition-colors"
    >
      Upgrade
    </Link>
  );

  return (
    <main
      className={`min-h-screen flex flex-col transition-all duration-200 ${
        collapsed ? "md:ml-16" : "md:ml-52"
      }`}
    >
      {/* Top bar — holds per-page section navigator */}
      <header className="no-print h-11 border-b border-zinc-800/50 flex items-center gap-3 px-4 md:px-6 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-30">
        <MobileMenuButton />

        {/* Section navigator (replaces static "Fontes:" label) */}
        <TopBarSectionNav />

        <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
          <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
            {new Date().toLocaleDateString("pt-BR")}
          </span>
          <div
            className="w-2 h-2 rounded-full bg-[#0B6C3E] animate-pulse"
            title="Dados ativos"
          />
          {user && (
            <>
              {tierBadge}
              <Link
                to="/configuracoes"
                className="inline-flex items-center justify-center w-7 h-7 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70 transition-colors"
                title={`Configurações da conta${user.email ? ` — ${user.email}` : ""}`}
                aria-label="Configurações da conta"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <button
                onClick={handleLogout}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-mono transition-colors ml-1"
                title={`${user.email ?? ""} (${tier}) — Sair`}
              >
                Sair
              </button>
            </>
          )}
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 p-4 md:p-6 overflow-x-hidden">
        <Outlet />
      </div>

      {/* Footer — subtle sources attribution */}
      <footer className="no-print px-4 md:px-6 py-3 border-t border-zinc-900/70 text-[9px] text-zinc-700 font-mono flex items-center justify-between gap-2 flex-wrap">
        <span>Fontes: BACEN SGS &middot; PTAX &middot; CVM</span>
        <span className="text-zinc-800">muuney.hub &middot; {new Date().getFullYear()}</span>
      </footer>

      {/* Beta feedback widget */}
      <div className="no-print">
        <FeedbackWidget section={activeSectionLabel} />
      </div>

      {/* First-visit onboarding tour */}
      <div className="no-print">
        <OnboardingTour />
      </div>

      {/* Mobile bottom navigation (hidden on md+) */}
      <div className="no-print">
        <MobileNav />
      </div>
    </main>
  );
};

export const HubLayout = () => {
  return (
    <>
      <Helmet>
        <title>muuney.hub | Inteligência de Dados Financeiros</title>
        <meta
          name="description"
          content="Terminal de inteligência de mercado com dados BACEN e CVM. Macro, crédito, fundos e empresas."
        />
      </Helmet>
      <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
        <div className="no-print">
          <NetworkStatus />
        </div>
        <SidebarProvider>
          <HubSectionsProvider>
            <HubMain />
          </HubSectionsProvider>
        </SidebarProvider>
        <div className="no-print">
          <Toaster />
        </div>
      </div>
    </>
  );
};
