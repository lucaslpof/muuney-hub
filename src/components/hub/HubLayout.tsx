import { Outlet, useNavigate, Link } from "react-router-dom";
import { SidebarProvider, MobileMenuButton, useSidebar } from "./HubSidebar";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { FeedbackWidget } from "./FeedbackWidget";
import { OnboardingTour } from "./OnboardingTour";

const HubMain = () => {
  const { collapsed } = useSidebar();
  const { user, tier, isPro, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

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
      className={`min-h-screen transition-all duration-200 ${
        collapsed ? "md:ml-16" : "md:ml-52"
      }`}
    >
      {/* Top bar */}
      <header className="h-14 border-b border-zinc-800/50 flex items-center justify-between px-4 md:px-6 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <MobileMenuButton />
          <span className="text-[10px] text-zinc-600 font-mono hidden sm:inline">
            Fontes: BACEN SGS &middot; PTAX &middot; CVM
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-zinc-600 font-mono">
            {new Date().toLocaleDateString("pt-BR")}
          </span>
          <div
            className="w-2 h-2 rounded-full bg-[#0B6C3E] animate-pulse"
            title="Dados ativos"
          />
          {user && (
            <>
              {tierBadge}
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
      <div className="p-4 md:p-6">
        <Outlet />
      </div>

      {/* Beta feedback widget */}
      <FeedbackWidget />

      {/* First-visit onboarding tour */}
      <OnboardingTour />
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
        <SidebarProvider>
          <HubMain />
        </SidebarProvider>
      </div>
    </>
  );
};
