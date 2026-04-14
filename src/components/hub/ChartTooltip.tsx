/**
 * Shared Tech-Noir tooltip for Recharts charts (PieChart, BarChart, etc.)
 * Mirrors the style of MacroChart's RichTooltip for visual consistency.
 */
interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  /** Format value for display — defaults to pt-BR locale */
  formatValue?: (val: number | string, entry: TooltipEntry) => string;
  /** Optional label to show above entries */
  labelKey?: string;
}

const defaultFormat = (val: number | string): string => {
  if (typeof val === "number") {
    if (Math.abs(val) >= 1_000_000_000)
      return `R$ ${(val / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}B`;
    if (Math.abs(val) >= 1_000_000)
      return `R$ ${(val / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
    if (Math.abs(val) >= 1_000)
      return `R$ ${(val / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
    return val.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  return String(val);
};

export const ChartTooltip = ({
  active,
  payload,
  label,
  formatValue,
  labelKey,
}: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;

  const fmt = formatValue || defaultFormat;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 shadow-lg max-w-[220px]">
      {label && (
        <p className="text-[9px] text-zinc-400 font-mono mb-1.5 uppercase tracking-wider">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const name =
            labelKey && entry.payload
              ? String(entry.payload[labelKey] ?? entry.name ?? "")
              : entry.name ?? "";
          return (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || "#0B6C3E" }}
              />
              <span className="text-zinc-400 truncate font-mono">{name}</span>
              <span className="ml-auto text-zinc-100 font-mono font-medium whitespace-nowrap">
                {fmt(entry.value ?? 0, entry)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Percentage tooltip - shows "name: value%" */
export const PercentTooltip = (props: ChartTooltipProps) => (
  <ChartTooltip
    {...props}
    formatValue={(val) =>
      `${typeof val === "number" ? val.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : val}%`
    }
  />
);

/** Count tooltip - shows "name: value" with no currency */
export const CountTooltip = (props: ChartTooltipProps) => (
  <ChartTooltip
    {...props}
    formatValue={(val) =>
      typeof val === "number"
        ? val.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
        : String(val)
    }
  />
);
