import { NavLink } from "react-router-dom";
import {
  BarChart3, TrendingUp, Landmark, Building2, GraduationCap,
  LayoutDashboard, ChevronLeft, ChevronRight, X, Menu, Banknote, Briefcase, ScrollText, Gem,
} from "lucide-react";
import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { getMainSiteUrl } from "@/lib/domain";
import symbolGreen from "@/assets/symbol-green.png";

/* ─── Sidebar context for layout offset ─── */
interface SidebarContextType {
  collapsed: boolean;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  mobileOpen: false,
  setMobileOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

/* ─── Provider wraps entire Hub layout ─── */
const SIDEBAR_KEY = "muuney_hub_sidebar_collapsed";

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch { /* noop */ }
  }, [collapsed]);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, setMobileOpen }}>
      {/* Desktop sidebar */}
      <aside
        className={`no-print hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[#0a0a0a] border-r border-zinc-800/50 z-40 transition-all duration-200 ${
          collapsed ? "w-16" : "w-52"
        }`}
      >
        <SidebarContent collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute bottom-14 right-0 translate-x-1/2 w-5 h-5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors z-50"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`no-print fixed left-0 top-0 h-screen w-64 bg-[#0a0a0a] border-r border-zinc-800/50 z-50 md:hidden flex flex-col transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent collapsed={false} onClose={() => setMobileOpen(false)} />
      </aside>

      {children}
    </SidebarContext.Provider>
  );
};

/* ─── Hooks ─── */
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
};

/* ─── Module definitions — routes are at root (no prefix) ─── */
const MODULES = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/macro", label: "Panorama Macro", icon: TrendingUp },
  { path: "/credito", label: "Overview Crédito", icon: BarChart3 },
  { path: "/renda-fixa", label: "Renda Fixa", icon: Banknote },
  { path: "/fundos", label: "Fundos", icon: Landmark },
  { path: "/ofertas", label: "Ofertas Públicas", icon: ScrollText, badge: "PRO" },
  { path: "/alternativos", label: "Alternativos", icon: Gem, badge: "NOVO" },
  { path: "/portfolio", label: "Portfolio", icon: Briefcase, badge: "NEW" },
  { path: "#", label: "Empresas", icon: Building2, disabled: true, badge: "Q3" },
  { path: "#", label: "Educacional", icon: GraduationCap, disabled: true, badge: "Q3" },
];

/* ─── Sidebar Content (shared between desktop & mobile) ─── */
const SidebarContent = ({
  collapsed,
  onClose,
}: {
  collapsed: boolean;
  onClose?: () => void;
}) => {
  const mainSiteUrl = getMainSiteUrl("/");

  return (
    <>
      {/* Logo */}
      <div className="h-11 flex items-center justify-between px-4 border-b border-zinc-800/50">
        <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          {!collapsed ? (
            <>
              <img src={symbolGreen} alt="muuney" className="w-6 h-6 rounded object-cover" />
              <span className="text-sm font-semibold text-zinc-200 tracking-tight">muuney.hub</span>
              <span className="text-[8px] bg-[#0B6C3E]/20 text-[#0B6C3E] px-1 py-0.5 rounded font-mono">BETA</span>
            </>
          ) : (
            <img src={symbolGreen} alt="muuney" className="w-7 h-7 rounded object-cover mx-auto" />
          )}
        </a>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="p-2 space-y-0.5 mt-1 flex-1">
        {MODULES.map((mod) => (
          <NavLink
            key={mod.path + mod.label}
            to={mod.disabled ? "#" : mod.path}
            onClick={(e) => {
              if (mod.disabled) e.preventDefault();
              else onClose?.();
            }}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 group ${
                mod.disabled
                  ? "opacity-30 cursor-not-allowed"
                  : isActive
                  ? "bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/20"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 border border-transparent"
              }`
            }
          >
            <mod.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate text-[13px]">{mod.label}</span>
                {mod.badge && (
                  <span className="text-[8px] bg-zinc-800 text-zinc-600 px-1 py-0.5 rounded font-mono">
                    {mod.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Back to main site */}
      {!collapsed && (
        <div className="px-3 mb-2">
          <a
            href={mainSiteUrl}
            className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors rounded-md hover:bg-zinc-900/50"
          >
            <ChevronLeft className="w-3 h-3" />
            <span>muuney.com.br</span>
          </a>
        </div>
      )}

      {/* CVM Disclaimer */}
      {!collapsed && (
        <div className="px-3 pb-3">
          <p className="text-[7px] text-zinc-700 leading-tight">
            Dados de fontes primárias oficiais (BACEN/CVM). Conteúdo informativo, não constitui recomendação de investimento.
          </p>
        </div>
      )}
    </>
  );
};

/* ─── Hamburger button for mobile top bar ─── */
export const MobileMenuButton = () => {
  const { setMobileOpen } = useSidebar();
  return (
    <button
      onClick={() => setMobileOpen(true)}
      className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors md:hidden"
      aria-label="Abrir menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
};
