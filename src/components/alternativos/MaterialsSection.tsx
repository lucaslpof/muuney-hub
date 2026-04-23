import { useState } from "react";
import {
  FileText,
  Download,
  Lock,
  ShieldCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  MATERIAL_TIPO_LABELS,
  useRequestMaterialSignedUrl,
  type AltMaterial,
  type AltMaterialTier,
} from "@/hooks/useAlternativos";
import { toast } from "@/hooks/use-toast";

interface MaterialsSectionProps {
  materials: AltMaterial[];
  hasInterestRegistered: boolean;
  /**
   * Callback chamado quando o usuário clica no CTA para registrar interesse
   * (a partir de um item de material gated por "interesse_registrado").
   */
  onRequestInterest?: () => void;
}

const TIER_ORDER: AltMaterialTier[] = ["publico", "pro", "interesse_registrado"];

const TIER_META: Record<
  AltMaterialTier,
  { label: string; desc: string; accent: string; icon: React.ReactNode }
> = {
  publico: {
    label: "Disponíveis publicamente",
    desc: "Teasers e documentos abertos — sem registro necessário.",
    accent: "#10B981",
    icon: <FileText className="w-3.5 h-3.5" />,
  },
  pro: {
    label: "Exclusivo muuney.hub Pro",
    desc: "Decks, term sheets e materiais sensíveis — acesso Pro é suficiente.",
    accent: "#0B6C3E",
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
  },
  interesse_registrado: {
    label: "Após registro de interesse",
    desc: "Documentos de due diligence — liberados após o formulário de interesse ser enviado à gestora.",
    accent: "#F59E0B",
    icon: <Lock className="w-3.5 h-3.5" />,
  },
};

/**
 * MaterialsSection — lista gated de materiais de uma oportunidade.
 *
 * Agrupa por tier_acesso (publico/pro/interesse_registrado) e renderiza botão
 * de download que chama useRequestMaterialSignedUrl (signed URL TTL 5min,
 * watermarked quando aplicável).
 *
 * Materiais `interesse_registrado` ficam bloqueados com CTA "Registrar interesse"
 * até o AAI submeter o InterestForm.
 */
export function MaterialsSection({
  materials,
  hasInterestRegistered,
  onRequestInterest,
}: MaterialsSectionProps) {
  const grouped: Record<AltMaterialTier, AltMaterial[]> = {
    publico: [],
    pro: [],
    interesse_registrado: [],
  };
  for (const m of materials) {
    grouped[m.tier_acesso].push(m);
  }
  // Sort each bucket by ordem asc, then versão desc
  for (const tier of TIER_ORDER) {
    grouped[tier].sort((a, b) => {
      if (a.ordem !== b.ordem) return a.ordem - b.ordem;
      return b.versao - a.versao;
    });
  }

  const nonEmptyTiers = TIER_ORDER.filter((t) => grouped[t].length > 0);

  if (nonEmptyTiers.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-6 text-center">
        <FileText className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-xs text-zinc-500">
          Nenhum material publicado ainda. A gestora disponibilizará deck e term sheet nos próximos dias.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {nonEmptyTiers.map((tier) => {
        const meta = TIER_META[tier];
        const locked = tier === "interesse_registrado" && !hasInterestRegistered;
        return (
          <section
            key={tier}
            className="rounded-lg border border-zinc-800/60 bg-[#0c0c0c] overflow-hidden"
          >
            <header
              className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-zinc-800/60"
              style={{ background: `${meta.accent}08` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full"
                  style={{ background: `${meta.accent}15`, color: meta.accent }}
                >
                  {meta.icon}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-mono uppercase tracking-wider"
                    style={{ color: meta.accent }}
                  >
                    {meta.label}
                  </div>
                  <div className="text-[10px] text-zinc-600 truncate">{meta.desc}</div>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-600 flex-shrink-0">
                {grouped[tier].length} {grouped[tier].length === 1 ? "item" : "itens"}
              </span>
            </header>

            {locked && (
              <div className="px-4 py-3 bg-amber-500/5 border-b border-amber-500/20">
                <div className="flex items-start gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-amber-300/90 leading-relaxed">
                    Para acessar estes documentos, registre interesse nesta oportunidade. A gestora
                    libera o acesso após revisar a sinalização.
                  </div>
                  {onRequestInterest && (
                    <button
                      type="button"
                      onClick={onRequestInterest}
                      className="ml-auto text-[10px] font-mono uppercase tracking-wider text-amber-200 hover:text-amber-100 whitespace-nowrap"
                    >
                      Registrar interesse →
                    </button>
                  )}
                </div>
              </div>
            )}

            <ul className="divide-y divide-zinc-800/60">
              {grouped[tier].map((material) => (
                <MaterialRow
                  key={material.id}
                  material={material}
                  locked={locked}
                  onRequestInterest={onRequestInterest}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function MaterialRow({
  material,
  locked,
  onRequestInterest,
}: {
  material: AltMaterial;
  locked: boolean;
  onRequestInterest?: () => void;
}) {
  const req = useRequestMaterialSignedUrl();
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setError(null);
    try {
      const { signed_url, expires_in_seconds, watermark_enabled } = await req.mutateAsync({
        material_id: material.id,
      });
      window.open(signed_url, "_blank", "noopener,noreferrer");
      toast({
        title: watermark_enabled ? "Documento com marca d'água" : "Download liberado",
        description: `Link expira em ${Math.round(expires_in_seconds / 60)} min. O acesso foi registrado em auditoria.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gerar link de download.";
      setError(msg);
      toast({
        title: "Não foi possível liberar o download",
        description: msg,
        variant: "destructive",
      });
    }
  };

  return (
    <li className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/30">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-md bg-[#0a0a0a] border border-zinc-800 flex items-center justify-center">
          <FileText className="w-4 h-4 text-zinc-500" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 rounded border border-zinc-800 px-1.5 py-0.5">
            {MATERIAL_TIPO_LABELS[material.tipo]}
          </span>
          <h4 className="text-xs font-semibold text-zinc-100 truncate">{material.titulo}</h4>
          {material.watermark_enabled && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-amber-400/80">
              · marca d'água
            </span>
          )}
          <span className="text-[9px] font-mono text-zinc-600">v{material.versao}</span>
        </div>
        {material.descricao && (
          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">{material.descricao}</p>
        )}
        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-600">
          {material.mime_type && <span>{shortMime(material.mime_type)}</span>}
          {material.file_size_bytes != null && material.file_size_bytes > 0 && (
            <>
              <span>·</span>
              <span>{formatFileSize(material.file_size_bytes)}</span>
            </>
          )}
        </div>
        {error && (
          <div className="mt-1 text-[10px] text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>

      <div className="flex-shrink-0">
        {locked ? (
          <button
            type="button"
            onClick={onRequestInterest}
            disabled={!onRequestInterest}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 text-amber-300 hover:bg-amber-500/10 text-[11px] font-mono uppercase tracking-wider px-2.5 py-1.5 disabled:opacity-50"
            title="Registre interesse para acessar"
          >
            <Lock className="w-3 h-3" />
            Bloqueado
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={req.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-[11px] font-mono uppercase tracking-wider px-2.5 py-1.5 disabled:opacity-50"
          >
            {req.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            {req.isPending ? "Liberando…" : "Baixar"}
            {!req.isPending && <ExternalLink className="w-2.5 h-2.5 opacity-70" />}
          </button>
        )}
      </div>
    </li>
  );
}

/* ─── Helpers ─── */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function shortMime(mime: string): string {
  if (!mime) return "";
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "XLSX";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "PPTX";
  if (mime.includes("word") || mime.includes("msword")) return "DOCX";
  if (mime.includes("zip")) return "ZIP";
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase();
  return mime.split("/").pop()?.toUpperCase() ?? mime;
}
