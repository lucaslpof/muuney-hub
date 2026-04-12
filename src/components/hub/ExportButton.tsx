/**
 * Reusable CSV export button for Hub tables.
 * Tech-Noir styled, compact.
 */
import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({ onClick, label = "CSV", disabled }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 bg-[#111111] border border-[#1a1a1a] rounded hover:border-[#0B6C3E]/40 hover:text-zinc-300 transition-all disabled:opacity-30"
      title={`Exportar ${label}`}
    >
      <Download className="w-3 h-3" />
      {label}
    </button>
  );
}
