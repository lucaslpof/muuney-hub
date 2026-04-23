import { useMemo } from "react";
import { Search, X } from "lucide-react";
import {
  CLASSE_LABELS,
  STATUS_LABELS,
  PUBLICO_ALVO_LABELS,
  PERFIL_RISCO_LABELS,
  type AltClasse,
  type AltStatus,
  type AltPublicoAlvo,
  type AltPerfilRisco,
} from "@/hooks/useAlternativos";

export interface AltFilterState {
  search: string;
  classe: AltClasse | null;
  status: AltStatus | null;
  publico_alvo: AltPublicoAlvo | null;
  perfil_risco: AltPerfilRisco | null;
  setor: string;
  geografia: string;
  destaque: boolean;
}

export const EMPTY_ALT_FILTERS: AltFilterState = {
  search: "",
  classe: null,
  status: null,
  publico_alvo: null,
  perfil_risco: null,
  setor: "",
  geografia: "",
  destaque: false,
};

interface OpportunityFiltersProps {
  filters: AltFilterState;
  onChange: (f: AltFilterState) => void;
  classesDisponiveis?: string[];
  statusesDisponiveis?: string[];
  setoresDisponiveis?: string[];
  geografiasDisponiveis?: string[];
}

/**
 * Barra de filtros da vitrine de alternativos. Tech-Noir: chips pill para
 * classe/status, selects discretos para públic-alvo/perfil, inputs para
 * setor/geografia, toggle destaque. Mostra "Limpar" quando algum filtro ativo.
 */
export function OpportunityFilters({
  filters,
  onChange,
  classesDisponiveis,
  statusesDisponiveis,
  setoresDisponiveis,
  geografiasDisponiveis,
}: OpportunityFiltersProps) {
  const hasAnyFilter = useMemo(() => {
    return (
      !!filters.search ||
      !!filters.classe ||
      !!filters.status ||
      !!filters.publico_alvo ||
      !!filters.perfil_risco ||
      !!filters.setor ||
      !!filters.geografia ||
      filters.destaque
    );
  }, [filters]);

  const set = <K extends keyof AltFilterState>(key: K, value: AltFilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const reset = () => onChange(EMPTY_ALT_FILTERS);

  const classes: AltClasse[] = [
    "private_credit",
    "private_equity",
    "real_estate",
    "ofertas_restritas",
    "club_deals",
    "offshore",
    "alt_liquidos",
  ];
  const availableClasses = classesDisponiveis
    ? classes.filter((c) => classesDisponiveis.includes(c))
    : classes;

  const statuses: AltStatus[] = ["captando", "em_breve", "pausada", "encerrada"];
  const availableStatuses = statusesDisponiveis
    ? statuses.filter((s) => statusesDisponiveis.includes(s))
    : statuses;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800/60 bg-[#0c0c0c] p-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar por título, resumo ou subclasse…"
          className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60"
        />
      </div>

      {/* Classe chips */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1.5">
          Classe
        </div>
        <div className="flex flex-wrap gap-1.5">
          {availableClasses.map((c) => {
            const active = filters.classe === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => set("classe", active ? null : c)}
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                  active
                    ? "bg-[#0B6C3E]/15 text-[#0B6C3E] border-[#0B6C3E]/40"
                    : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {CLASSE_LABELS[c]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status chips */}
      <div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1.5">
          Status
        </div>
        <div className="flex flex-wrap gap-1.5">
          {availableStatuses.map((s) => {
            const active = filters.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => set("status", active ? null : s)}
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border transition-colors ${
                  active
                    ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                    : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row: Público alvo + Perfil + Setor + Geografia */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
            Público alvo
          </div>
          <select
            value={filters.publico_alvo ?? ""}
            onChange={(e) =>
              set("publico_alvo", (e.target.value || null) as AltPublicoAlvo | null)
            }
            className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          >
            <option value="">Todos</option>
            {(Object.keys(PUBLICO_ALVO_LABELS) as AltPublicoAlvo[]).map((k) => (
              <option key={k} value={k}>
                {PUBLICO_ALVO_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
            Perfil risco
          </div>
          <select
            value={filters.perfil_risco ?? ""}
            onChange={(e) =>
              set("perfil_risco", (e.target.value || null) as AltPerfilRisco | null)
            }
            className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-[#0B6C3E]/60"
          >
            <option value="">Todos</option>
            {(Object.keys(PERFIL_RISCO_LABELS) as AltPerfilRisco[]).map((k) => (
              <option key={k} value={k}>
                {PERFIL_RISCO_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
            Setor
          </div>
          <input
            list="alt-setores-list"
            value={filters.setor}
            onChange={(e) => set("setor", e.target.value)}
            placeholder="ex: Energia"
            className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60"
          />
          {setoresDisponiveis && setoresDisponiveis.length > 0 && (
            <datalist id="alt-setores-list">
              {setoresDisponiveis.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          )}
        </div>
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600 mb-1">
            Geografia
          </div>
          <input
            list="alt-geografias-list"
            value={filters.geografia}
            onChange={(e) => set("geografia", e.target.value)}
            placeholder="ex: Brasil"
            className="w-full bg-[#0a0a0a] border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#0B6C3E]/60"
          />
          {geografiasDisponiveis && geografiasDisponiveis.length > 0 && (
            <datalist id="alt-geografias-list">
              {geografiasDisponiveis.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          )}
        </div>
      </div>

      {/* Toggle destaque + limpar */}
      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2">
        <label className="inline-flex items-center gap-2 cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-200">
          <input
            type="checkbox"
            checked={filters.destaque}
            onChange={(e) => set("destaque", e.target.checked)}
            className="accent-[#0B6C3E]"
          />
          Somente destaques
        </label>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-zinc-200"
          >
            <X className="w-3 h-3" />
            Limpar filtros
          </button>
        )}
      </div>
    </div>
  );
}
