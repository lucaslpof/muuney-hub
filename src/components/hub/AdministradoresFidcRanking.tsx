/**
 * AdministradoresFidcRanking.tsx — V5-D7 (24/04/2026)
 *
 * Top-N ranking of FIDC administradores (que frequentemente acumulam função
 * de custodiante/distribuidor no ecossistema RCVM 175). Ships no FidcHub
 * Segmentos section para AAIs decodificarem quem são os players de back-office
 * no mercado FIDC.
 *
 * Data layer: query direta contra hub_fundos_meta filtrada por
 * classe_rcvm175='FIDC'. 96.1% dos FIDCs têm admin_nome preenchido (4,149 de
 * 4,319) — cobertura mais do que suficiente para um ranking representativo.
 * 54 distinct administradores no universo.
 *
 * Aggregation client-side (Map-based) — volumes pequenos, 60min cache React
 * Query.
 *
 * Sort modes: "fidcs" (count de FIDCs sob administração) ou "pl" (PL total
 * agregado). Tech-Noir FIDC accent (#F97316) — matches FidcHub.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRLCompact, formatCount } from "@/lib/format";

type SortMode = "fidcs" | "pl";

interface AdminRow {
  name: string;
  fidcs: number;
  pl: number;
}

export interface AdministradoresFidcRankingProps {
  /** How many rows to show. */
  limit?: number;
  /** Tech-Noir accent color — defaults to FIDC orange. */
  accent?: string;
  /** Extra className for layout tweaks. */
  className?: string;
}

async function fetchAdministradores(): Promise<Array<{
  admin_nome: string | null;
  vl_patrim_liq: number | null;
}>> {
  const { data, error } = await supabase
    .from("hub_fundos_meta")
    .select("admin_nome, vl_patrim_liq")
    .eq("classe_rcvm175", "FIDC")
    .not("admin_nome", "is", null)
    .limit(5000);
  if (error) throw error;
  return data ?? [];
}

function rankAdministradores(
  rows: Array<{ admin_nome: string | null; vl_patrim_liq: number | null }>,
): AdminRow[] {
  const map = new Map<string, AdminRow>();
  for (const r of rows) {
    const key = (r.admin_nome || "").trim();
    if (!key) continue;
    const cur = map.get(key) ?? { name: key, fidcs: 0, pl: 0 };
    cur.fidcs += 1;
    cur.pl += Number(r.vl_patrim_liq) || 0;
    map.set(key, cur);
  }
  return Array.from(map.values());
}

export function AdministradoresFidcRanking({
  limit = 10,
  accent = "#F97316",
  className = "",
}: AdministradoresFidcRankingProps) {
  const [sortMode, setSortMode] = useState<SortMode>("fidcs");

  const { data: rawRows, isLoading, error } = useQuery({
    queryKey: ["hub", "fidc_administradores_all"],
    queryFn: fetchAdministradores,
    staleTime: 60 * 60 * 1000,
  });

  const { rows, maxValue } = useMemo(() => {
    const all = rawRows ? rankAdministradores(rawRows) : [];
    const sorted = [...all].sort((a, b) =>
      sortMode === "fidcs" ? b.fidcs - a.fidcs : b.pl - a.pl,
    );
    const capped = sorted.slice(0, limit);
    const max = capped.length
      ? sortMode === "fidcs"
        ? capped[0].fidcs
        : capped[0].pl
      : 0;
    return { rows: capped, maxValue: max };
  }, [rawRows, sortMode, limit]);

  return (
    <section
      className={`bg-[#111111] border rounded-lg p-5 ${className}`}
      style={{ borderColor: `${accent}33` }}
      aria-labelledby="administradores-fidc-ranking-heading"
    >
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <Landmark className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
        <h3
          id="administradores-fidc-ranking-heading"
          className="text-sm font-semibold text-zinc-200"
        >
          Administradores FIDC
        </h3>
        <span className="text-[9px] font-mono text-zinc-500 ml-1">
          Top {limit}
        </span>

        {/* Sort toggle */}
        <div className="ml-auto inline-flex rounded border border-[#1a1a1a] overflow-hidden">
          {(["fidcs", "pl"] as SortMode[]).map((m) => {
            const active = sortMode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setSortMode(m)}
                className={`text-[9px] font-mono uppercase tracking-wider px-2.5 py-1 transition-colors ${
                  active ? "" : "text-zinc-500 hover:text-zinc-300"
                }`}
                style={
                  active
                    ? {
                        backgroundColor: `${accent}22`,
                        color: accent,
                      }
                    : undefined
                }
                aria-pressed={active}
              >
                {m === "fidcs" ? "FIDCs" : "PL"}
              </button>
            );
          })}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: Math.min(limit, 5) }).map((_, i) => (
            <div
              key={i}
              className="h-7 rounded bg-[#0a0a0a] border border-[#1a1a1a] animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-[11px] text-red-400 font-mono">
          Erro ao carregar ranking de administradores.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-zinc-500 font-mono">
          Sem administradores registrados.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, idx) => {
            const value = sortMode === "fidcs" ? r.fidcs : r.pl;
            const barW = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const displayValue =
              sortMode === "fidcs"
                ? formatCount(r.fidcs)
                : formatBRLCompact(r.pl);
            const secondary =
              sortMode === "fidcs"
                ? formatBRLCompact(r.pl)
                : `${formatCount(r.fidcs)} fundos`;
            return (
              <li
                key={r.name}
                className="relative rounded border border-[#1a1a1a] bg-[#0a0a0a] px-2.5 py-1.5 overflow-hidden"
              >
                {/* Bar background */}
                <div
                  className="absolute inset-y-0 left-0 opacity-20"
                  style={{ width: `${barW}%`, backgroundColor: accent }}
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-2 text-[10px] font-mono">
                  <span
                    className="w-4 flex-shrink-0 text-zinc-600 text-right"
                    aria-hidden="true"
                  >
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-zinc-200 truncate" title={r.name}>
                    {r.name}
                  </span>
                  <span className="text-zinc-500 text-[9px] flex-shrink-0">
                    {secondary}
                  </span>
                  <span
                    className="font-semibold flex-shrink-0 text-right"
                    style={{ color: accent }}
                  >
                    {displayValue}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="mt-3 pt-3 border-t border-[#1a1a1a]">
        <p className="text-[9px] font-mono text-zinc-600 leading-relaxed">
          Fonte: CVM RCVM 175 · cobertura ~96% dos FIDCs com administrador
          preenchido. Em FIDCs, o administrador frequentemente acumula função
          de custodiante e distribuidor.
        </p>
      </footer>
    </section>
  );
}

export default AdministradoresFidcRanking;
