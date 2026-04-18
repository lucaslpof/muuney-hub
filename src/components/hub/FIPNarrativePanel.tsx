import { useFipOverview } from "@/hooks/useHubFundos";
import { formatPL } from "@/hooks/useHubFundos";

/**
 * FIPNarrativePanel — Market intelligence narrative for FIP sector
 * Displays: total FIPs, total PL, capital integration %, top tipo
 */
export function FIPNarrativePanel() {
  const { data: fipOverview } = useFipOverview();

  if (!fipOverview || !fipOverview.by_tipo || fipOverview.by_tipo.length === 0) {
    return null;
  }

  const topType = fipOverview.by_tipo.reduce((prev, curr) =>
    curr.pct_pl > prev.pct_pl ? curr : prev
  );

  const narrative = `${fipOverview.total_fips?.toLocaleString("pt-BR") || "—"} FIPs ativos com PL total de ${formatPL(fipOverview.total_pl || 0)}. Capital integralizado representa ${fipOverview.pct_integralizacao?.toFixed(1) || "—"}% do comprometido. Top tipo: ${topType.tp_fundo_classe}.`;

  return (
    <p className="text-[11px] text-zinc-400 font-mono border-l-2 border-[#06B6D4]/40 pl-3">
      {narrative}
    </p>
  );
}
