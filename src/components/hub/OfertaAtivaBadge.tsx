/**
 * OfertaAtivaBadge — Cross-ref badge "⚡ Oferta aberta" nas lâminas FIDC/FII.
 *
 * Quando o emissor (CNPJ) tem oferta com status=em_distribuicao em
 * hub_ofertas_publicas, renderiza badge inline linkando para a ficha
 * da oferta (/ofertas/:protocolo).
 *
 * Renderiza null silently se não há oferta ativa — usado inline no
 * header das lâminas como spice opcional.
 */

import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { useActiveOfertaForCnpj } from "@/hooks/useOfertasV2";
import { formatBRL } from "@/lib/format";

export interface OfertaAtivaBadgeProps {
  /** CNPJ do emissor (com ou sem máscara). */
  cnpj: string | null | undefined;
  /** Tamanho — md (default) cabe ao lado de ClasseBadge; sm para drawers. */
  size?: "sm" | "md";
}

export function OfertaAtivaBadge({ cnpj, size = "md" }: OfertaAtivaBadgeProps) {
  const { data: oferta } = useActiveOfertaForCnpj(cnpj ?? null);

  if (!oferta) return null;

  const sizeClasses =
    size === "sm"
      ? "text-[8px] px-1.5 py-0.5 gap-1"
      : "text-[9px] px-2 py-0.5 gap-1.5";

  return (
    <Link
      to={`/ofertas/${encodeURIComponent(oferta.protocolo)}`}
      className={`inline-flex items-center font-mono uppercase tracking-wider rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors ${sizeClasses}`}
      title={`Oferta ${oferta.tipo_ativo} em distribuição${oferta.valor_total ? ` — ${formatBRL(oferta.valor_total)}` : ""}`}
    >
      <Zap className={size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"} aria-hidden />
      Oferta aberta
    </Link>
  );
}

export default OfertaAtivaBadge;
