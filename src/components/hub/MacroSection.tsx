import { type ReactNode, forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface MacroSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  seriesCount?: number;
  children: ReactNode;
  /** Insight cards slot — rendered between header and content */
  insights?: ReactNode;
}

/**
 * Narrative block wrapper for HubMacro sections.
 * Provides consistent header, optional insight cards, and anchor target.
 */
export const MacroSection = forwardRef<HTMLDivElement, MacroSectionProps>(
  ({ id, title, subtitle, icon: Icon, seriesCount, children, insights }, ref) => {
    return (
      <motion.section
        ref={ref}
        id={id}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.3 }}
        className="scroll-mt-32"
      >
        {/* ─── Section header ─── */}
        <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-[#141414]">
          <div className="w-7 h-7 rounded-md bg-[#0B6C3E]/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-3.5 h-3.5 text-[#0B6C3E]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-zinc-200 font-mono tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{subtitle}</p>
            )}
          </div>
          {seriesCount !== undefined && (
            <span className="text-[9px] font-mono text-zinc-700 bg-[#111111] border border-[#1a1a1a] px-1.5 py-0.5 rounded">
              {seriesCount} séries
            </span>
          )}
        </div>

        {/* ─── Dynamic insights ─── */}
        {insights && <div className="mb-3">{insights}</div>}

        {/* ─── Section content ─── */}
        <div className="space-y-3">{children}</div>
      </motion.section>
    );
  }
);

MacroSection.displayName = "MacroSection";

/* ─── Sidebar navigation item ─── */
interface SidebarNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const MacroSidebar = ({
  items,
  activeId,
  onNavigate,
}: {
  items: SidebarNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}) => {
  return (
    <nav className="sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto space-y-0.5 pr-3 hidden md:block scrollbar-none">
      {items.map((item) => {
        const isActive = activeId === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            data-sidebar-id={item.id}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-all text-[11px] font-mono ${
              isActive
                ? "bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/20"
                : "text-zinc-600 hover:text-zinc-300 hover:bg-[#111111] border border-transparent"
            }`}
          >
            <Icon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
            {isActive && (
              <div className="ml-auto w-1 h-1 rounded-full bg-[#0B6C3E]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
