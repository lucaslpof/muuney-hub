import type { ReactNode } from "react";

/**
 * NarrativeSection — padroniza o padrão "prosa + mini-analytics + conteúdo"
 * extraído de OfertasRadar (AUDIT_FUNDOS_PROFUNDO_18ABR.md §5).
 *
 * Estrutura:
 * 1. Prosa de abertura (border-l-2 accent, com numbers inline e regime reference)
 * 2. Mini-analytics cards (3-6 KPIs secundários derivados, com cor opcional e sublabel)
 * 3. children — KPIs principais / visualização / tabela
 */

export interface MiniStat {
  label: string;
  value: string;
  sublabel?: string;
  color?: string; // text-emerald-400 / text-red-400 / text-amber-400 / text-zinc-200...
  tooltip?: string;
}

export interface NarrativeSectionProps {
  prose: ReactNode;
  miniStats?: MiniStat[];
  accent?: string; // border-l accent color, default #0B6C3E
  children?: ReactNode;
  className?: string;
}

export const NarrativeSection = ({
  prose,
  miniStats,
  accent = "#0B6C3E",
  children,
  className = "",
}: NarrativeSectionProps) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Prosa de abertura */}
      <p
        className="text-[11px] text-zinc-400 font-mono leading-relaxed border-l-2 pl-3"
        style={{ borderLeftColor: `${accent}66` /* ~40% opacity */ }}
      >
        {prose}
      </p>

      {/* Mini-analytics cards */}
      {miniStats && miniStats.length > 0 && (
        <div
          className={`grid grid-cols-1 gap-3 ${
            miniStats.length >= 6
              ? "sm:grid-cols-3 lg:grid-cols-6"
              : miniStats.length >= 4
              ? "sm:grid-cols-2 lg:grid-cols-4"
              : "sm:grid-cols-3"
          }`}
        >
          {miniStats.map((stat, i) => (
            <div
              key={i}
              className="bg-[#111111] border border-[#1a1a1a] rounded p-2.5"
              title={stat.tooltip}
            >
              <div className="text-[8px] text-zinc-600 uppercase tracking-wider font-mono">
                {stat.label}
              </div>
              <div
                className={`text-sm font-mono font-semibold ${
                  stat.color ?? "text-zinc-200"
                }`}
              >
                {stat.value}
              </div>
              {stat.sublabel && (
                <div className="text-[8px] text-zinc-600 font-mono">
                  {stat.sublabel}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conteúdo principal (KPIs + chart + tabela) */}
      {children}
    </div>
  );
};

/**
 * Helper: format a delta number with sign + color class.
 * Returns { text, color } — use color for MiniStat.color.
 */
export const formatDelta = (
  value: number | null | undefined,
  opts: {
    suffix?: string;
    digits?: number;
    inverted?: boolean; // true when positive = bad (e.g. inadimplência)
  } = {},
): { text: string; color: string } => {
  if (value == null || !Number.isFinite(value)) {
    return { text: "—", color: "text-zinc-500" };
  }
  const { suffix = "", digits = 2, inverted = false } = opts;
  const sign = value > 0 ? "+" : "";
  const text = `${sign}${value.toFixed(digits)}${suffix}`;
  const isGood = inverted ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 0.01;
  const color = isNeutral
    ? "text-zinc-400"
    : isGood
    ? "text-emerald-400"
    : "text-red-400";
  return { text, color };
};
