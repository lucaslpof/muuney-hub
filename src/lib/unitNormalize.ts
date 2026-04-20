/**
 * unitNormalize — shared helpers to normalize BACEN SGS value units across
 * charts. hub_macro_series_meta mistura unidades em categorias R$ (ex.:
 * saldo_credito tem séries em "R$ milhões" e outras em "R$ bi"; tesouro e
 * credpriv também divergem ocasionalmente), então convertemos tudo para
 * R$ bi antes de renderizar.
 */

export interface SeriesDataPoint {
  date: string;
  value: number;
}

/**
 * Converte uma série para R$ bilhões com base no `unit` informado pelo meta.
 * - Se o unit já menciona "bi" ou "bilh", devolve os pontos inalterados.
 * - Se o unit menciona "milh" ou "mi", divide cada valor por 1.000.
 * - Caso contrário (unit vazio/desconhecido), devolve os pontos sem alterações
 *   para evitar normalização agressiva de séries que não são monetárias.
 */
export function normalizeToBi(
  points: SeriesDataPoint[],
  unit: string | undefined
): SeriesDataPoint[] {
  const u = (unit ?? "").toLowerCase();
  if (u.includes("bi") || u.includes("bilh")) return points;
  if (u.includes("milh") || u.includes("mi")) {
    return points.map((p) => ({ date: p.date, value: p.value / 1_000 }));
  }
  return points;
}

/**
 * Formata um valor em R$ bi com fallback adaptativo para T (trilhões)
 * quando |v| ≥ 1.000 e mi (milhões) quando |v| < 1.
 */
export function fmtSaldoBi(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} T`;
  if (abs >= 1) return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  return `R$ ${(v * 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`;
}
