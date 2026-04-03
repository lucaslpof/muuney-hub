import { Outlet } from "react-router-dom";
import { SidebarProvider, MobileMenuButton, useSidebar } from "./HubSidebar";
import { Helmet } from "react-helmet-async";

const HubMain = () => {
  const { collapsed } = useSidebar();

  return (
    <main
      className={`min-h-screen transition-all duration-200 ${
        collapsed ? "md:ml-16" : "md:ml-52"
      }`}
    >
      {/* Top bar */}
      <header className="h-14 border-b border-[#1a1a1a] flex items-center justify-between px-4 md:px-6 sticky top-0 bg-[#0a0a0a]/90 backdrop-blur-md z-30">
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
        </div>
      </header>

      {/* Page content */}
      <div className="p-4 md:p-6">
        <Outlet />
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
        <SidebarProvider>
          <HubMain />
        </SidebarProvider>
      </div>
    </>
  );
};
