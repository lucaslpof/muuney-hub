import { useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  FAIXA_PATRIMONIO_LABELS,
  useSubmitInterest,
  type AltFaixaPatrimonio,
  type AltInterestSubmitPayload,
  type AltOpportunityFull,
} from "@/hooks/useAlternativos";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface InterestFormProps {
  opportunity: Pick<AltOpportunityFull, "id" | "titulo" | "ticket_minimo" | "moeda">;
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  /** Pré-preenchimento do AAI (ideal: vindo do profile) */
  defaults?: Partial<Pick<AltInterestSubmitPayload, "aai_nome" | "aai_email" | "aai_telefone" | "aai_escritorio">>;
}

const FAIXAS: AltFaixaPatrimonio[] = ["ate_1m", "1m_5m", "5m_10m", "10m_plus"];

/**
 * InterestForm — modal de registro de interesse em uma oportunidade alternativa.
 *
 * Fluxo: AAI preenche dados próprios + dados anonimizados do cliente
 *  (primeiro nome + faixa patrimônio + ticket opcional + obs).
 *  useSubmitInterest → backend cria hub_alt_interests row, dispara notificação à gestora.
 *
 * LGPD: documento/CPF completos NÃO são coletados aqui — só primeiro nome.
 * Identidade completa do cliente é revelada apenas se/quando gestora e AAI concordam fechar negócio.
 */
export function InterestForm({
  opportunity,
  open,
  onClose,
  onSubmitted,
  defaults,
}: InterestFormProps) {
  const { user } = useAuth();
  const submit = useSubmitInterest();

  // AAI fields — pré-preenchidos mas editáveis
  const [aaiNome, setAaiNome] = useState(defaults?.aai_nome ?? "");
  const [aaiEmail, setAaiEmail] = useState(defaults?.aai_email ?? user?.email ?? "");
  const [aaiTelefone, setAaiTelefone] = useState(defaults?.aai_telefone ?? "");
  const [aaiEscritorio, setAaiEscritorio] = useState(defaults?.aai_escritorio ?? "");

  // Cliente fields
  const [clientePrimeiroNome, setClientePrimeiroNome] = useState("");
  const [clienteFaixa, setClienteFaixa] = useState<AltFaixaPatrimonio | "">("");
  const [ticketPretendido, setTicketPretendido] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");

  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when reopened
  useEffect(() => {
    if (!open) return;
    setAaiNome(defaults?.aai_nome ?? "");
    setAaiEmail(defaults?.aai_email ?? user?.email ?? "");
    setAaiTelefone(defaults?.aai_telefone ?? "");
    setAaiEscritorio(defaults?.aai_escritorio ?? "");
    setClientePrimeiroNome("");
    setClienteFaixa("");
    setTicketPretendido("");
    setObservacoes("");
    setErrors([]);
    submit.reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submit.isPending) onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose, submit.isPending]);

  const ticketMinimoFmt = useMemo(() => {
    if (!opportunity.ticket_minimo) return null;
    const prefix =
      opportunity.moeda === "USD" ? "US$" : opportunity.moeda === "EUR" ? "€" : "R$";
    return `${prefix} ${opportunity.ticket_minimo.toLocaleString("pt-BR")}`;
  }, [opportunity.ticket_minimo, opportunity.moeda]);

  const validate = (): string[] => {
    const e: string[] = [];
    if (!aaiNome.trim()) e.push("Informe seu nome completo.");
    if (!aaiEmail.trim() || !/^\S+@\S+\.\S+$/.test(aaiEmail)) e.push("E-mail inválido.");
    if (!clientePrimeiroNome.trim()) e.push("Informe o primeiro nome do cliente.");
    if (clientePrimeiroNome.includes(" ")) e.push("Use apenas o primeiro nome do cliente (sem sobrenome).");
    if (!clienteFaixa) e.push("Selecione a faixa de patrimônio do cliente.");
    if (ticketPretendido) {
      const v = Number(ticketPretendido.replace(/[^\d]/g, ""));
      if (!Number.isFinite(v) || v <= 0) e.push("Ticket pretendido inválido.");
    }
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length) return;

    const payload: AltInterestSubmitPayload = {
      opportunity_id: opportunity.id,
      aai_nome: aaiNome.trim(),
      aai_email: aaiEmail.trim(),
      aai_telefone: aaiTelefone.trim() || undefined,
      aai_escritorio: aaiEscritorio.trim() || undefined,
      cliente_primeiro_nome: clientePrimeiroNome.trim(),
      cliente_faixa_patrimonio: clienteFaixa as AltFaixaPatrimonio,
      ticket_pretendido: ticketPretendido
        ? Number(ticketPretendido.replace(/[^\d]/g, ""))
        : undefined,
      observacoes: observacoes.trim() || undefined,
    };

    try {
      await submit.mutateAsync(payload);
      toast({
        title: "Interesse registrado",
        description: "A gestora foi notificada. Você pode acompanhar este interesse em \"Meus interesses\".",
      });
      onSubmitted?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar interesse.";
      if (/duplicate|duplicado|já/i.test(msg)) {
        setErrors(["Você já registrou interesse neste cliente para esta oportunidade."]);
      } else {
        setErrors([msg]);
      }
    }
  };

  if (!open) return null;

  const success = submit.isSuccess;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interest-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submit.isPending) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-800 bg-[#0c0c0c] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-800/60 bg-[#0c0c0c] px-5 py-3.5">
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-[#0B6C3E]">
              Registrar interesse
            </div>
            <h2
              id="interest-form-title"
              className="text-sm font-semibold text-zinc-100 line-clamp-1"
            >
              {opportunity.titulo}
            </h2>
            {ticketMinimoFmt && (
              <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                Ticket mínimo: {ticketMinimoFmt}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submit.isPending}
            aria-label="Fechar"
            className="text-zinc-500 hover:text-zinc-200 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success state */}
        {success && (
          <div className="p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-100">Interesse enviado</h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-md mx-auto">
              A gestora foi notificada com os dados anonimizados do cliente. Você receberá um
              e-mail quando houver retorno. Acompanhe também em <span className="font-mono text-zinc-300">Meus interesses</span>.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-xs font-medium px-4 py-2"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* LGPD notice */}
            <div className="rounded-md border border-zinc-800 bg-[#0a0a0a] p-3 text-[10px] text-zinc-400 leading-relaxed">
              <span className="font-mono text-zinc-500">LGPD · </span>
              Coletamos apenas dados anonimizados do cliente (primeiro nome + faixa de patrimônio).
              Identificação completa só ocorre se a gestora e você concordarem em avançar.
            </div>

            {/* AAI section */}
            <fieldset className="space-y-3">
              <legend className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                Seus dados (AAI)
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Nome completo *"
                  value={aaiNome}
                  onChange={setAaiNome}
                  placeholder="Fulano de Tal"
                />
                <Field
                  label="E-mail *"
                  type="email"
                  value={aaiEmail}
                  onChange={setAaiEmail}
                  placeholder="voce@escritorio.com.br"
                />
                <Field
                  label="Telefone"
                  value={aaiTelefone}
                  onChange={setAaiTelefone}
                  placeholder="(11) 9 1234-5678"
                />
                <Field
                  label="Escritório"
                  value={aaiEscritorio}
                  onChange={setAaiEscritorio}
                  placeholder="Nome do escritório / assessoria"
                />
              </div>
            </fieldset>

            {/* Cliente section */}
            <fieldset className="space-y-3">
              <legend className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                Cliente (anonimizado)
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field
                  label="Primeiro nome *"
                  value={clientePrimeiroNome}
                  onChange={setClientePrimeiroNome}
                  placeholder="Ex: João"
                />
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
                    Faixa de patrimônio *
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FAIXAS.map((f) => {
                      const active = clienteFaixa === f;
                      return (
                        <button
                          type="button"
                          key={f}
                          onClick={() => setClienteFaixa(f)}
                          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                            active
                              ? "bg-[#0B6C3E]/15 text-[#0B6C3E] border-[#0B6C3E]/40"
                              : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                          }`}
                        >
                          {FAIXA_PATRIMONIO_LABELS[f]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field
                  label="Ticket pretendido (R$)"
                  value={ticketPretendido}
                  onChange={(v) => setTicketPretendido(v.replace(/[^\d]/g, ""))}
                  placeholder="500000"
                />
              </div>

              <div>
                <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
                  Observações
                </div>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Contexto adicional — perfil, timing, estrutura preferida… (opcional)"
                  rows={3}
                  maxLength={800}
                  className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60 resize-none"
                />
                <div className="text-[9px] text-zinc-600 font-mono mt-1 text-right">
                  {observacoes.length}/800
                </div>
              </div>
            </fieldset>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-red-400">
                  <AlertTriangle className="w-3 h-3" />
                  Verifique os campos
                </div>
                <ul className="text-[11px] text-red-300/90 space-y-0.5 pl-4 list-disc">
                  {errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={onClose}
                disabled={submit.isPending}
                className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 px-3 py-2 disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submit.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white text-xs font-medium px-4 py-2 disabled:opacity-50"
              >
                {submit.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submit.isPending ? "Enviando…" : "Registrar interesse"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60"
      />
    </div>
  );
}
