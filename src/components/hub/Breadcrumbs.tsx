import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Tech-Noir breadcrumb navigation for deep module pages.
 * Last item renders as current (no link, white text).
 */
export const Breadcrumbs = ({ items, className = "" }: BreadcrumbsProps) => (
  <nav
    aria-label="Breadcrumb"
    className={`flex items-center gap-1 text-[10px] font-mono ${className}`}
  >
    <Link
      to="/dashboard"
      className="text-zinc-600 hover:text-zinc-400 transition-colors shrink-0"
      title="Dashboard"
    >
      <Home className="w-3 h-3" />
    </Link>
    {items.map((item, i) => {
      const isLast = i === items.length - 1;
      return (
        <span key={i} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
          {isLast || !item.to ? (
            <span className="text-zinc-300 truncate">{item.label}</span>
          ) : (
            <Link
              to={item.to}
              className="text-zinc-500 hover:text-zinc-300 transition-colors truncate"
            >
              {item.label}
            </Link>
          )}
        </span>
      );
    })}
  </nav>
);
