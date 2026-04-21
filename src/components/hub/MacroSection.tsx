import { type ReactNode, forwardRef, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useHubSections } from "@/contexts/HubSectionsContext";

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
        className="scroll-mt-44"
      >
        {/* ─── Section header ─── */}
        <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-zinc-800/30">
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
            <span className="text-[9px] font-mono text-zinc-700 bg-zinc-900/50 border border-zinc-800/50 px-1.5 py-0.5 rounded">
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

/**
 * MacroSidebar — back-compat shim.
 *
 * Historically rendered a vertical sidebar (desktop) + horizontal pills (mobile).
 * The Hub now renders a single horizontal navigator in the HubLayout top bar,
 * fed by HubSectionsContext. This component stays as the page-side registration
 * point and renders nothing visually.
 */
export const MacroSidebar = ({
  items,
  activeId,
  onNavigate,
}: {
  items: SidebarNavItem[];
  activeId: string;
  onNavigate: (id: string) => void;
}) => {
  const ctx = useHubSections();

  useEffect(() => {
    if (!ctx) return;
    ctx.registerSections(items, activeId, onNavigate);
    return () => ctx.clearSections();
  }, [items, activeId, onNavigate, ctx]);

  return null;
};
