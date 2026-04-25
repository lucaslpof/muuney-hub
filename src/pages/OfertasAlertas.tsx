/**
 * OfertasAlertas — Configuração visual de regras de alerta (V2 Sprint Beta)
 *
 * Rota: /ofertas/alertas
 *
 * CRUD para hub_user_alert_rules:
 *   - Listar regras existentes do usuário
 *   - Criar/editar regra (form com tipo_ativo[], segmento[], min/max volume, modalidade[], ativa)
 *   - Ativar/desativar via toggle
 *   - Deletar
 *   - Preview "Quantas ofertas dos últimos 90d enquadrariam nesta regra?"
 *
 * Os alertas são despachados por Edge Function `check-oferta-alerts`
 * (cron diário 08:00 BRT) — envia digest email via Resend.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Check,
  Plus,
  Trash2,
  X,
  Filter,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { EmptyState } from "@/components/hub/EmptyState";
import { useOfertasFilters, useOfertasList } from "@/hooks/useHubFundos";
import {
  useAlertRules,
  useUpsertAlertRule,
  useDeleteAlertRule,
  type AlertRule,
} from "@/hooks/useOfertasV2";
import { formatBRL } from "@/lib/format";

const ACCENT = "#0B6C3E";

/* ─── Multi-select chip ──────────────────────────────────────────────── */

function MultiChips({
  options,
  value,
  onChange,
  emptyLabel = "Todos",
}: {
  options: string[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  emptyLabel?: string;
}) {
  const selected = value ?? [];
  const allOff = !value || value.length === 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
          allOff
            ? "bg-[#0B6C3E]/15 border-[#0B6C3E]/40 text-[#0B6C3E]"
            : "bg-zinc-900/40 border-zinc-700 text-zinc-400 hover:border-zinc-600"
        }`}
      >
        {emptyLabel}
      </button>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (on) {
                const next = selected.filter((v) => v !== opt);
                onChange(next.length > 0 ? next : null);
              } else {
                onChange([...selected, opt]);
              }
            }}
            className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
              on
                ? "bg-[#0B6C3E]/15 border-[#0B6C3E]/40 text-[#0B6C3E]"
                : "bg-zinc-900/40 border-zinc-700 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Rule form ──────────────────────────────────────────────────────── */

interface RuleDraft {
  name: string;
  tipo_ativo: string[] | null;
  segmento: string[] | null;
  modalidade: string[] | null;
  min_volume: number | null;
  max_volume: number | null;
  ativa: boolean;
}

function newDraft(): RuleDraft {
  return {
    name: "",
    tipo_ativo: null,
    segmento: null,
    modalidade: null,
    min_volume: null,
    max_volume: null,
    ativa: true,
  };
}

function ruleToDraft(r: AlertRule): RuleDraft {
  return {
    name: r.name,
    tipo_ativo: r.tipo_ativo,
    segmento: r.segmento,
    modalidade: r.modalidade,
    min_volume: r.min_volume,
    max_volume: r.max_volume,
    ativa: r.ativa,
  };
}

/** Preview: how many ofertas in last 90d would have triggered this rule? */
function useRulePreview(draft: RuleDraft) {
  const ninetyAgo = useMemo(() => {
    const d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);

  return useOfertasList({
    from_date: ninetyAgo,
    tipo_ativo: draft.tipo_ativo && draft.tipo_ativo.length === 1 ? draft.tipo_ativo[0] : undefined,
    segmento: draft.segmento && draft.segmento.length === 1 ? draft.segmento[0] : undefined,
    modalidade: draft.modalidade && draft.modalidade.length === 1 ? draft.modalidade[0] : undefined,
    min_valor: draft.min_volume ?? undefined,
    limit: 200,
  });
}

interface RuleFormProps {
  initial: RuleDraft;
  initialId?: string;
  onSave: (draft: RuleDraft, id?: string) => void;
  onCancel: () => void;
  saving: boolean;
}

function RuleForm({ initial, initialId, onSave, onCancel, saving }: RuleFormProps) {
  const [draft, setDraft] = useState<RuleDraft>(initial);
  const { data: filters } = useOfertasFilters();
  const preview = useRulePreview(draft);

  // Client-side filter to multi-criterion preview (since useOfertasList only supports
  // single-value tipo/segmento/modalidade — we widen to multi for the count.)
  const previewCount = useMemo(() => {
    const ofertas = preview.data?.ofertas ?? [];
    return ofertas.filter((o) => {
      if (draft.tipo_ativo && draft.tipo_ativo.length > 0 && (!o.tipo_ativo || !draft.tipo_ativo.includes(o.tipo_ativo))) return false;
      if (draft.segmento && draft.segmento.length > 0 && (!o.segmento || !draft.segmento.includes(o.segmento))) return false;
      if (draft.modalidade && draft.modalidade.length > 0 && (!o.modalidade || !draft.modalidade.includes(o.modalidade))) return false;
      if (draft.min_volume !== null && (o.valor_total ?? 0) < draft.min_volume) return false;
      if (draft.max_volume !== null && (o.valor_total ?? 0) > draft.max_volume) return false;
      return true;
    }).length;
  }, [preview.data, draft]);

  const isValid = draft.name.trim().length >= 3;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValid) return;
        onSave(draft, initialId);
      }}
      className="bg-[#0a0a0a] border rounded-lg p-5 space-y-4"
      style={{ borderColor: `${ACCENT}55` }}
    >
      <header className="flex items-center gap-2">
        <Filter className="w-4 h-4" style={{ color: ACCENT }} />
        <h3 className="text-sm font-semibold text-zinc-200">
          {initialId ? "Editar regra" : "Nova regra de alerta"}
        </h3>
      </header>

      {/* Nome */}
      <div className="space-y-1">
        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Nome da regra
        </label>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="ex.: CRI logística rating ≥ A"
          maxLength={80}
          required
          className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12px] font-mono text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
        />
        <p className="text-[9px] font-mono text-zinc-600">
          {draft.name.length}/80 caracteres · mínimo 3.
        </p>
      </div>

      {/* tipo_ativo */}
      <div className="space-y-1.5">
        <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Tipo de ativo
        </label>
        <MultiChips
          options={filters?.tipos_ativo ?? []}
          value={draft.tipo_ativo}
          onChange={(v) => setDraft({ ...draft, tipo_ativo: v })}
        />
      </div>

      {/* segmento */}
      {(filters?.segmentos?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Segmento
          </label>
          <MultiChips
            options={filters?.segmentos ?? []}
            value={draft.segmento}
            onChange={(v) => setDraft({ ...draft, segmento: v })}
          />
        </div>
      )}

      {/* modalidade */}
      {(filters?.modalidades?.length ?? 0) > 0 && (
        <div className="space-y-1.5">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Modalidade
          </label>
          <MultiChips
            options={filters?.modalidades ?? []}
            value={draft.modalidade}
            onChange={(v) => setDraft({ ...draft, modalidade: v })}
          />
        </div>
      )}

      {/* volume range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Volume mínimo (R$)
          </label>
          <input
            type="number"
            min={0}
            step={1000000}
            value={draft.min_volume ?? ""}
            onChange={(e) => setDraft({ ...draft, min_volume: e.target.value ? Number(e.target.value) : null })}
            placeholder="ex.: 50000000"
            className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12px] font-mono text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          />
          {draft.min_volume !== null && (
            <p className="text-[9px] font-mono text-[#0B6C3E]">{formatBRL(draft.min_volume)}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            Volume máximo (R$, opcional)
          </label>
          <input
            type="number"
            min={0}
            step={1000000}
            value={draft.max_volume ?? ""}
            onChange={(e) => setDraft({ ...draft, max_volume: e.target.value ? Number(e.target.value) : null })}
            placeholder="(sem limite)"
            className="w-full bg-[#111] border border-zinc-800 rounded px-3 py-2 text-[12px] font-mono text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          />
          {draft.max_volume !== null && (
            <p className="text-[9px] font-mono text-[#0B6C3E]">{formatBRL(draft.max_volume)}</p>
          )}
        </div>
      </div>

      {/* ativa toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={draft.ativa}
          onChange={(e) => setDraft({ ...draft, ativa: e.target.checked })}
          className="accent-[#0B6C3E]"
        />
        <span className="text-[11px] font-mono text-zinc-300">
          Regra ativa (recebe digest diário)
        </span>
      </label>

      {/* Preview */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#0B6C3E]/30 rounded">
        <Sparkles className="w-3.5 h-3.5 text-[#0B6C3E] flex-shrink-0" />
        <p className="text-[11px] font-mono text-zinc-400">
          Nos últimos 90 dias,{" "}
          {preview.isLoading ? (
            <span className="text-zinc-600">calculando…</span>
          ) : (
            <>
              <span className="text-[#0B6C3E] font-semibold">{previewCount}</span> oferta
              {previewCount === 1 ? "" : "s"} teria{previewCount === 1 ? "" : "m"} disparado este alerta.
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[#1a1a1a]">
        <button
          type="submit"
          disabled={!isValid || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#0B6C3E]/15 border border-[#0B6C3E]/40 text-[#0B6C3E] rounded hover:bg-[#0B6C3E]/25 transition-colors disabled:opacity-40"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? "Salvando…" : initialId ? "Atualizar regra" : "Criar regra"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-zinc-700 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancelar
        </button>
      </div>
    </form>
  );
}

/* ─── Rule list item ─────────────────────────────────────────────────── */

function RuleCard({
  rule,
  onEdit,
  onToggleActive,
  onDelete,
  busy,
}: {
  rule: AlertRule;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const summary = useMemo(() => {
    const parts: string[] = [];
    if (rule.tipo_ativo && rule.tipo_ativo.length > 0) parts.push(rule.tipo_ativo.join(" / "));
    if (rule.segmento && rule.segmento.length > 0) parts.push(rule.segmento.join(", "));
    if (rule.modalidade && rule.modalidade.length > 0) parts.push(rule.modalidade.join(", "));
    if (rule.min_volume) parts.push(`min ${formatBRL(rule.min_volume)}`);
    if (rule.max_volume) parts.push(`max ${formatBRL(rule.max_volume)}`);
    return parts.length > 0 ? parts.join(" · ") : "Todos os critérios livres";
  }, [rule]);

  return (
    <li
      className={`bg-[#0a0a0a] border rounded-lg p-4 transition-colors ${
        rule.ativa ? "border-[#0B6C3E]/30" : "border-zinc-800"
      }`}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {rule.ativa ? (
              <Bell className="w-3.5 h-3.5 text-[#0B6C3E]" />
            ) : (
              <BellOff className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <h3 className="text-[13px] font-semibold text-zinc-200 truncate">{rule.name}</h3>
            <span
              className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                rule.ativa
                  ? "bg-[#0B6C3E]/15 border-[#0B6C3E]/30 text-[#0B6C3E]"
                  : "bg-zinc-900/40 border-zinc-800 text-zinc-500"
              }`}
            >
              {rule.ativa ? "Ativa" : "Pausada"}
            </span>
          </div>
          <p className="text-[10px] font-mono text-zinc-500 leading-snug">
            {summary}
          </p>
          {rule.last_triggered && (
            <p className="text-[9px] font-mono text-zinc-600 mt-1">
              Último disparo: {new Date(rule.last_triggered).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-zinc-700 hover:text-zinc-300 transition-colors disabled:opacity-40"
            title={rule.ativa ? "Pausar regra" : "Ativar regra"}
          >
            {rule.ativa ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
            {rule.ativa ? "Pausar" : "Ativar"}
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-[#0B6C3E]/40 hover:text-[#0B6C3E] transition-colors disabled:opacity-40"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-500 rounded hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-40"
            title="Apagar regra"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </li>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function OfertasAlertas() {
  const { data: rules, isLoading, error } = useAlertRules();
  const upsert = useUpsertAlertRule();
  const delMut = useDeleteAlertRule();

  const [editing, setEditing] = useState<{ id?: string; draft: RuleDraft } | null>(null);

  // Auto-close form on successful upsert
  useEffect(() => {
    if (upsert.isSuccess) setEditing(null);
  }, [upsert.isSuccess]);

  const handleSave = (draft: RuleDraft, id?: string) => {
    upsert.mutate({
      ...(id ? { id } : {}),
      name: draft.name.trim(),
      tipo_ativo: draft.tipo_ativo,
      segmento: draft.segmento,
      modalidade: draft.modalidade,
      min_volume: draft.min_volume,
      max_volume: draft.max_volume,
      ativa: draft.ativa,
    } as Parameters<typeof upsert.mutate>[0]);
  };

  const handleToggleActive = (rule: AlertRule) => {
    upsert.mutate({
      id: rule.id,
      name: rule.name,
      ativa: !rule.ativa,
    } as Parameters<typeof upsert.mutate>[0]);
  };

  const handleDelete = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Apagar esta regra de alerta?")) return;
    delMut.mutate(id);
  };

  return (
    <>
      <HubSEO
        title="Alertas de ofertas"
        description="Configure regras de alerta para ofertas públicas CVM. Receba digest diário por email quando uma nova oferta enquadrar nos seus critérios (tipo, volume, segmento)."
        path="/ofertas/alertas"
      />

      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Breadcrumbs
            items={[
              { label: "Ofertas", to: "/ofertas" },
              { label: "Alertas" },
            ]}
          />
          <div className="flex items-center gap-2">
            <Link
              to="/ofertas/watchlist"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-[#0B6C3E]/40 hover:text-[#0B6C3E] transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Watchlist
            </Link>
            <Link
              to="/ofertas"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-[#0B6C3E] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              voltar
            </Link>
          </div>
        </div>

        <header className="space-y-2">
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0B6C3E]" />
            Alertas de ofertas
          </h1>
          <p className="text-[11px] font-mono text-zinc-500 max-w-2xl leading-relaxed">
            Configure regras (ex: <span className="text-zinc-300">"CRI logística min R$ 50M"</span>)
            e receba <span className="text-zinc-300">digest diário</span> por email às 08:00
            sempre que uma nova oferta CVM enquadrar. Filtros básicos disponíveis no V2:
            tipo de ativo, segmento, modalidade e faixa de volume. Filtros por rating e prazo
            chegam após o pipeline de extração de prospecto (V3).
          </p>
        </header>

        <SectionErrorBoundary sectionName="Form de Alertas">
          {/* Form (create or edit) */}
          {editing && (
            <RuleForm
              initial={editing.draft}
              initialId={editing.id}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              saving={upsert.isPending}
            />
          )}

          {/* Create button (when no form open) */}
          {!editing && (
            <div>
              <button
                type="button"
                onClick={() => setEditing({ draft: newDraft() })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono bg-[#0B6C3E]/15 border border-[#0B6C3E]/40 text-[#0B6C3E] rounded hover:bg-[#0B6C3E]/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova regra
              </button>
            </div>
          )}

          {upsert.error && (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-[11px] font-mono text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Erro ao salvar regra: {(upsert.error as Error).message}</span>
            </div>
          )}
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Lista de Alertas">
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-24 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-[11px] font-mono text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Erro ao carregar regras: {(error as Error).message}</span>
            </div>
          ) : !rules || rules.length === 0 ? (
            <EmptyState
              variant="no-data"
              title="Nenhuma regra criada ainda"
              description="Crie sua primeira regra para começar a receber digest diário de ofertas que importam pra você."
            />
          ) : (
            <ul className="space-y-3">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  busy={upsert.isPending || delMut.isPending}
                  onEdit={() => setEditing({ id: rule.id, draft: ruleToDraft(rule) })}
                  onToggleActive={() => handleToggleActive(rule)}
                  onDelete={() => handleDelete(rule.id)}
                />
              ))}
            </ul>
          )}
        </SectionErrorBoundary>

        {/* Footer info */}
        <footer className="pt-4 border-t border-[#1a1a1a] text-[10px] font-mono text-zinc-600 leading-relaxed">
          <p>
            <span className="text-zinc-500">Como funciona:</span>{" "}
            todo dia às 08:00 (BRT), o hub varre as ofertas registradas na CVM nas últimas 24h
            e cruza com suas regras ativas. Se houver matches, você recebe um único email digest
            agrupando todos eles. Sem barulho.
          </p>
          <p className="mt-2">
            <span className="text-zinc-500">Origem dos dados:</span>{" "}
            CVM (RCVM 160 / ICVM 476 / ICVM 400). Atualizado semanalmente para legacy
            e sob demanda para RCVM 160.
          </p>
        </footer>
      </div>
    </>
  );
}
