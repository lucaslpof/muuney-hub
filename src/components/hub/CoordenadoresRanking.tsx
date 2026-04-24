/**
 * CoordenadoresRanking.tsx — V5-D7 (24/04/2026)
 *
 * Top-N ranking of Ofertas Públicas coordenadores líderes by count or
 * volume. Ships in OfertasRadar Pipeline section so AAIs can see which
 * coordenadores lideram book de ofertas estruturadas.
 *
 * Data layer: direct Supabase REST query against hub_ofertas_publicas
 * (58.9% coverage of coordenador_lider; 418 distinct; 4-digit records
 * so a 5k-row page is more than enough for an ecosystem-wide aggregate).
 * Aggregation is done client-side in a useMemo so the UX is instant after
 * first fetch (React Query caches for 60min).
 *
 * Sort modes: "ofertas" (count) or "volume" (sum valor_total). Toggle via
 * pill buttons in the header. Tech-Noir emerald accent (#10B981) — matches
 * OfertasRadar.
 */

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRLCompact, formatCount } from "@/lib/format";

type SortMode = "ofertas" | "volume";

interface CoordenadorRow {
  name: string;
  ofertas: number;
  volume: number;
}

export interface CoordenadoresRankingProps {
  /** How many rows to show. */
  limit?: number;
  /** Tech-Noir accent color — defaults to OFERTAS emerald. */
  accent?: string;
  /** Extra className for layout tweaks. */
  className?: string;
}

/** Query up to 10k recent ofertas with coordenador_lider filled in. */
async function fetchCoordenadores(): Promise<Array<{
  coordenador_lider: string | null;
  valor_total: number | null;
}>> {
  const { data, error } = await supabase
    .from("hub_ofertas_publicas")
    .select("coordenador_lider, valor_total")
    .not("coordenador_lider", "is", null)
    .limit(10000);
  if (error) throw error;
  return data ?? [];
}

function rankCoordenadores(
  rows: Array<{ coordenador_lider: string | null; valor_total: number | null }>,
): CoordenadorRow[] {
  const map = new Map<string, CoordenadorRow>();
  for (const r of rows) {
    const key = (r.coordenador_lider || "").trim();
    if (!key) continue;
    const cur = map.get(key) ?? { name: key, ofertas: 0, volume: 0 };
    cur.ofertas += 1;
    cur.volume += Number(r.valor_total) || 0;
    map.set(key, cur);
  }
  return Array.from(map.values());
}

export function CoordenadoresRanking({
  limit = 10,
  accent = "#10B981",
  className = "",
}: CoordenadoresRankingProps) {
  const [sortMode, setSortMode] = useState<SortMode>("ofertas");

  const { data: rawRows, isLoading, error } = useQuery({
    queryKey: ["hub", "ofertas_coordenadores_all"],
    queryFn: fetchCoordenadores,
    staleTime: 60 * 60 * 1000,
  });

  const { rows, maxValue } = useMemo(() => {
    const all = rawRows ? rankCoordenadores(rawRows) : [];
    const sorted = [...all].sort((a, b) =>
      sortMode === "ofertas" ? b.ofertas - a.ofertas : b.volume - a.volume,
    );
    const capped = sorted.slice(0, limit);
    const max = capped.length
      ? sortMode === "ofertas"
        ? capped[0].ofertas
        : capped[0].volume
      : 0;
    return { rows: capped, maxValue: max };
  }, [rawRows, sortMode, limit]);

  return (
    <section
      className={`bg-[#111111] border rounded-lg p-5 ${className}`}
      style={{ borderColor: `${accent}33` }}
      aria-labelledby="coordenadores-ranking-heading"
    >
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <Trophy className="w-4 h-4" style={{ color: accent }} aria-hidden="true" />
        <h3
          id="coordenadores-ranking-heading"
          className="text-sm font-semibold text-zinc-200"
        >
          Coordenadores Líderes
        </h3>
        <span className="text-[9px] font-mono text-zinc-500 ml-1">
          Top {limit}
        </span>

        {/* Sort toggle */}
        <div className="ml-auto inline-flex rounded border border-[#1a1a1a] overflow-hidden">
          {(["ofertas", "volume"] as SortMode[]).map((m) => {
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
                {m === "ofertas" ? "Ofertas" : "Volume"}
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
          Erro ao carregar ranking de coordenadores.
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-zinc-500 font-mono">
          Sem coordenadores registrados no período.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, idx) => {
            const value = sortMode === "ofertas" ? r.ofertas : r.volume;
            const barW = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const displayValue =
              sortMode === "ofertas"
                ? formatCount(r.ofertas)
                : formatBRLCompact(r.volume);
            const secondary =
              sortMode === "ofertas"
                ? formatBRLCompact(r.volume)
                : `${formatCount(r.ofertas)} ofertas`;
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
          Fonte: CVM SRE · agregação ecossistêmica sobre ofertas com coordenador
          líder preenchido (cobertura ~59%).
        </p>
      </footer>
    </section>
  );
}

export default CoordenadoresRanking;
