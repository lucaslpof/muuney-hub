import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck, Loader2, X, AlertTriangle } from "lucide-react";
import {
  useAckSuitability,
  useAltSuitability,
  type AltDeclaredProfile,
} from "@/hooks/useAlternativos";
import { toast } from "@/hooks/use-toast";

interface SuitabilityGateProps {
  /**
   * Conteúdo protegido. Só é renderizado quando o usuário tem aceite válido
   * da versão atual dos termos.
   */
  children: ReactNode;
  /**
   * Se true, renderiza o modal automaticamente quando o usuário não tem aceite.
   * Se false, o caller controla quando abrir via `promptIfMissing`.
   */
  autoPrompt?: boolean;
}

const PROFILES: { value: AltDeclaredProfile; label: string; desc: string }[] = [
  {
    value: "profissional",
    label: "Investidor Profissional",
    desc:
      "Pessoa com patrimônio declarado > R$ 10M e certificações (CVM 30) ou instituições financeiras / gestoras.",
  },
  {
    value: "qualificado",
    label: "Investidor Qualificado",
    desc:
      "Pessoa com patrimônio > R$ 1M ou com certificações equivalentes (ANBIMA CEA/CGA, CVM 30).",
  },
  {
    value: "varejo_ciente",
    label: "Varejo — ciente das restrições",
    desc:
      "Estou ciente de que parte das oportunidades é restrita a Investidores Qualificados/Profissionais.",
  },
];

/**
 * SuitabilityGate — bloqueia acesso ao conteúdo até o AAI aceitar os termos
 * de uso do módulo Alternativos (CVM 178/35, CVM 160/476, LGPD).
 *
 * Aceite é versionado (CURRENT_TERMS_VERSION no backend). Quando a versão muda,
 * o usuário precisa re-aceitar.
 *
 * Uso típico: envolver AlternativosHub + AlternativosDetail.
 */
export function SuitabilityGate({ children, autoPrompt = true }: SuitabilityGateProps) {
  const { data: suitability, isLoading } = useAltSuitability();
  const [modalOpen, setModalOpen] = useState(false);

  const valid = !!suitability?.valid;

  useEffect(() => {
    if (!autoPrompt) return;
    if (isLoading) return;
    if (!valid) setModalOpen(true);
  }, [autoPrompt, isLoading, valid]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#0B6C3E]" />
      </div>
    );
  }

  return (
    <>
      {valid ? (
        children
      ) : (
        <SuitabilityFallback onOpen={() => setModalOpen(true)} />
      )}
      <SuitabilityModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        termsVersion={suitability?.current_version ?? ""}
      />
    </>
  );
}

function SuitabilityFallback({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 mb-4">
        <ShieldCheck className="w-6 h-6 text-[#0B6C3E]" />
      </div>
      <h2 className="text-sm font-semibold text-zinc-100 mb-2">
        Confirme sua adequação para acessar Ativos Alternativos
      </h2>
      <p className="text-xs text-zinc-400 max-w-md leading-relaxed mb-5">
        Este módulo exibe oportunidades restritas a Investidores Qualificados e
        Profissionais (CVM 160/476). Antes de prosseguir, confirme seu perfil e aceite
        os termos de uso.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-xs font-medium px-4 py-2"
      >
        Aceitar termos
      </button>
    </div>
  );
}

function SuitabilityModal({
  open,
  onClose,
  termsVersion,
}: {
  open: boolean;
  onClose: () => void;
  termsVersion: string;
}) {
  const [declaredProfile, setDeclaredProfile] = useState<AltDeclaredProfile | null>(null);
  const [declaredEscritorio, setDeclaredEscritorio] = useState("");
  const [ackBox, setAckBox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ack = useAckSuitability();

  useEffect(() => {
    if (!open) return;
    setDeclaredProfile(null);
    setDeclaredEscritorio("");
    setAckBox(false);
    setError(null);
    ack.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ack.isPending) onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose, ack.isPending]);

  if (!open) return null;

  const handleAck = async () => {
    if (!declaredProfile) {
      setError("Selecione o perfil que melhor descreve você.");
      return;
    }
    if (!ackBox) {
      setError("Confirme a leitura e aceite dos termos.");
      return;
    }
    try {
      await ack.mutateAsync({
        declared_profile: declaredProfile,
        declared_escritorio: declaredEscritorio.trim() || undefined,
      });
      toast({
        title: "Aceite registrado",
        description: "Você pode agora acessar as oportunidades alternativas.",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar aceite.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suitability-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !ack.isPending) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-800 bg-[#0c0c0c] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800/60 bg-[#0c0c0c] px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[#0B6C3E]">
              Suitability · Termos de uso
            </div>
            <h2 id="suitability-title" className="text-sm font-semibold text-zinc-100">
              Confirme seu perfil para acessar Ativos Alternativos
            </h2>
            {termsVersion && (
              <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                Versão dos termos: {termsVersion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={ack.isPending}
            aria-label="Fechar"
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Escopo regulatório */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Escopo e postura
            </h3>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              A muuney.hub opera este módulo como <span className="text-zinc-100 font-semibold">vitrine
              informativa e canal de lead-gen</span> entre AAIs (CVM 35) e gestoras/estruturadoras.
              A muuney <span className="text-zinc-100 font-semibold">não distribui</span> valores
              mobiliários, não intermedeia ordens e não capta recursos. Ofertas restritas
              (CVM 160/476) são exibidas conforme enquadramento da gestora.
            </p>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              O preenchimento de interesse cria um <span className="text-zinc-100 font-semibold">lead anonimizado</span> à
              gestora. Nenhum dado completo do cliente é compartilhado até que AAI e gestora
              avancem para due diligence / formalização.
            </p>
          </section>

          {/* Perfil declarado */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              Seu perfil *
            </h3>
            <div className="space-y-1.5">
              {PROFILES.map((p) => {
                const active = declaredProfile === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setDeclaredProfile(p.value)}
                    className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors ${
                      active
                        ? "bg-[#0B6C3E]/10 border-[#0B6C3E]/50"
                        : "bg-[#0a0a0a] border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full border-2 ${
                          active ? "border-[#0B6C3E] bg-[#0B6C3E]" : "border-zinc-600"
                        }`}
                      />
                      <span
                        className={`text-[11px] font-semibold ${
                          active ? "text-[#0B6C3E]" : "text-zinc-200"
                        }`}
                      >
                        {p.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-relaxed mt-1 ml-5">
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Escritório */}
          <div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
              Escritório / assessoria (opcional)
            </div>
            <input
              type="text"
              value={declaredEscritorio}
              onChange={(e) => setDeclaredEscritorio(e.target.value)}
              placeholder="Nome da corretora / escritório de AAI"
              className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60"
            />
          </div>

          {/* Aceite */}
          <label className="flex items-start gap-2 cursor-pointer rounded-md border border-zinc-800 bg-[#0a0a0a] p-3 hover:border-zinc-700">
            <input
              type="checkbox"
              checked={ackBox}
              onChange={(e) => setAckBox(e.target.checked)}
              className="mt-0.5 accent-[#0B6C3E]"
            />
            <span className="text-[11px] text-zinc-300 leading-relaxed">
              Li e aceito os termos de uso do módulo Ativos Alternativos. Confirmo que os
              dados informados são verdadeiros, que respeitarei o enquadramento regulatório
              de cada oportunidade (CVM 160/476) e que não utilizarei informações confidenciais
              fora do contexto desta plataforma. Autorizo o registro deste aceite com
              timestamp, IP e user-agent para fins de auditoria.
            </span>
          </label>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              <span className="text-[11px] text-red-300/90">{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={ack.isPending}
              className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 px-3 py-2 disabled:opacity-40"
            >
              Depois
            </button>
            <button
              type="button"
              onClick={handleAck}
              disabled={ack.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-xs font-medium px-4 py-2 disabled:opacity-50"
            >
              {ack.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {ack.isPending ? "Registrando…" : "Aceitar e prosseguir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
