import { useQuery } from "@tanstack/react-query";
import { ScrollText, ExternalLink, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * FundAssembleiasPanel — atas de assembleia (AGO/AED) + editais + propostas.
 *
 * Fonte: v_hub_fund_atas (filtra hub_fundos_eventos por tp_doc IN AGO/AED/EDITAL AGO/PROPOSTA ADMINI).
 * Cobertura: 100% fundos com atas declaradas em CVM EVENTUAL (qualquer data).
 *
 * Categorias: edital (convocação) · ata_ago (ordinária) · ata_aed (extraordinária) · proposta.
 */

interface AtaRow {
  cnpj_fundo_classe: string;
  dt_comptc: string;
  dt_receb: string;
  tp_doc: string;
  nm_arq: string | null;
  link_arq: string | null;
  categoria: "edital" | "ata_ago" | "ata_aed" | "proposta" | "outro";
}

interface Props {
  cnpj: string | null;
  limit?: number;
  accent?: string;
}

const CATEGORY_LABEL: Record<AtaRow["categoria"], string> = {
  ata_ago: "AGO",
  ata_aed: "AED",
  edital: "Edital",
  proposta: "Proposta",
  outro: "Outro",
};

const CATEGORY_COLOR: Record<AtaRow["categoria"], string> = {
  ata_ago: "#10B981",
  ata_aed: "#F59E0B",
  edital: "#06B6D4",
  proposta: "#8B5CF6",
  outro: "#71717a",
};

function fmtDate(dt: string): string {
  return dt.split("-").reverse().join("/");
}

export function FundAssembleiasPanel({ cnpj, limit = 8, accent = "#0B6C3E" }: Props) {
  const { data: atas, isLoading } = useQuery<AtaRow[]>({
    queryKey: ["fund-atas", cnpj, limit],
    queryFn: async () => {
      if (!cnpj) return [];
      const { data, error } = await supabase
        .from("v_hub_fund_atas")
        .select("cnpj_fundo_classe, dt_comptc, dt_receb, tp_doc, nm_arq, link_arq, categoria")
        .eq("cnpj_fundo_classe", cnpj)
        .order("dt_comptc", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AtaRow[];
    },
    enabled: !!cnpj,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return <div className="h-32 bg-zinc-900/50 rounded-md animate-pulse" />;
  if (!atas || atas.length === 0) {
    return null; // silent — nem todo fundo tem assembleia ainda
  }

  return (
    <div
      className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-3"
      style={{ borderLeft: `3px solid ${accent}66` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <ScrollText className="w-4 h-4" style={{ color: accent }} />
        <h4 className="text-[10px] font-mono uppercase text-zinc-500 font-semibold">
          Assembleias & Editais ({atas.length})
        </h4>
      </div>

      <ul className="space-y-1.5">
        {atas.map((a, i) => {
          const color = CATEGORY_COLOR[a.categoria];
          return (
            <li key={i} className="flex items-start gap-2 text-[10px] font-mono">
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-semibold flex-shrink-0"
                style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}33` }}
              >
                {CATEGORY_LABEL[a.categoria]}
              </span>
              <span className="text-zinc-500 flex-shrink-0">{fmtDate(a.dt_comptc)}</span>
              <span className="text-zinc-300 flex-1 truncate" title={a.nm_arq ?? ""}>
                {a.nm_arq ?? a.tp_doc}
              </span>
              {a.link_arq && (
                <a
                  href={a.link_arq}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-500 hover:text-zinc-200 flex-shrink-0 inline-flex items-center gap-1"
                  title="Abrir documento CVM"
                >
                  <ExternalLink className="w-3 h-3" />
                  PDF
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-[9px] font-mono text-zinc-600 mt-2 flex items-center gap-1">
        <FileText className="w-2.5 h-2.5" />
        Fonte: CVM EVENTUAL · refresh diário · clique PDF para abrir documento original (rwww.gov.br/cvm).
      </p>
    </div>
  );
}
