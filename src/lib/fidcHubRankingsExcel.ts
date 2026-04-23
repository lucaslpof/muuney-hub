/**
 * fidcHubRankingsExcel.ts — V5-D3 (22/04/2026)
 *
 * Excel export for FidcHub rankings table.
 *
 * Single sheet "Rankings FIDC" with 13 columns (pt-BR numfmt). Prepends
 * a title row listing the filters applied at export time so readers
 * understand the scope of the data without re-running the screener.
 *
 * `fetchAllFidcRankings()` is a convenience wrapper around the raw
 * `fetchFidc` call that paginates up to `maxRows` (default 1000) so the
 * workbook includes every matching FIDC, not just the visible page of 50.
 */

import {
  exportWorkbook,
  xlsxFilename,
  rnd,
  type XlsxColumn,
  type XlsxSheet,
  type XlsxCellValue,
} from "./xlsxExport";
import { fetchFidc, type FidcV4RankingItem } from "@/hooks/useHubFundos";

/** Filter snapshot used for the title row + filename. */
export interface FidcRankingsFilters {
  orderBy: string;
  order: "asc" | "desc" | string;
  lastro?: string | null;
  minPl?: number;
  maxInadim?: number;
  minSubord?: number;
  search?: string;
}

/** Fetch up to `maxRows` FIDCs with the same filters the screener uses. */
export async function fetchAllFidcRankings(
  filters: FidcRankingsFilters,
  maxRows = 1000
): Promise<FidcV4RankingItem[]> {
  const pageSize = 200;
  const rows: FidcV4RankingItem[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const limit = Math.min(pageSize, remaining);
    const params: Record<string, string> = {
      order_by: filters.orderBy,
      order: filters.order,
      limit: String(limit),
      offset: String(offset),
    };
    if (filters.lastro) params.lastro = filters.lastro;
    if (filters.minPl && filters.minPl > 0) params.min_pl = String(filters.minPl);
    if (filters.maxInadim != null && filters.maxInadim < 100) params.max_inadim = String(filters.maxInadim);
    if (filters.minSubord && filters.minSubord > 0) params.min_subord = String(filters.minSubord);
    if (filters.search) params.search = filters.search;

    const res = (await fetchFidc("fidc_rankings", params)) as {
      funds: FidcV4RankingItem[];
      count: number;
    };
    const batch = res?.funds || [];
    rows.push(...batch);
    if (batch.length < limit) break; // last page reached
    offset += limit;
    if (res.count != null && offset >= res.count) break;
  }

  return rows;
}

/** Clean outlier rentab values (CVM data has occasional scale/decimal bugs). */
function cleanRentab(v: number | null | undefined): number | null {
  if (v == null || !isFinite(v)) return null;
  if (Math.abs(v) > 95) return null;
  return rnd(v, 2);
}

/** Sum of senior + subord cotistas (null-safe — both null → null). */
function sumCotistas(
  senior: number | null | undefined,
  subord: number | null | undefined
): number | null {
  const s = senior ?? 0;
  const sub = subord ?? 0;
  if (senior == null && subord == null) return null;
  return s + sub;
}

/** Compose and download the Excel workbook. */
export async function exportFidcHubRankings(
  funds: FidcV4RankingItem[],
  filters: FidcRankingsFilters
): Promise<void> {
  if (!funds.length) return;

  const columns: XlsxColumn[] = [
    { header: "Nome do FIDC", key: "nome", format: "text", width: 52 },
    { header: "CNPJ", key: "cnpj", format: "text", width: 20 },
    { header: "Lastro", key: "lastro", format: "text", width: 22 },
    { header: "Gestor", key: "gestor", format: "text", width: 34 },
    { header: "Administrador", key: "admin", format: "text", width: 34 },
    { header: "PL Total", key: "pl", format: "currency", width: 20 },
    { header: "Nº Cotistas", key: "cotistas", format: "int", width: 14 },
    { header: "Subordinação (%)", key: "subord", format: "percent_lit", width: 18 },
    { header: "Inadimplência (%)", key: "inadim", format: "percent_lit", width: 18 },
    { header: "PDD Cobertura (%)", key: "pdd", format: "percent_lit", width: 18 },
    { header: "Rentab. Senior (%)", key: "rentab_senior", format: "percent_lit", width: 18 },
    { header: "Rentab. Fundo (%)", key: "rentab_fundo", format: "percent_lit", width: 18 },
    { header: "Nº Cedentes", key: "cedentes", format: "int", width: 14 },
  ];

  const rows: Record<string, XlsxCellValue>[] = funds.map((f) => ({
    nome: f.denom_social || `FIDC ${f.cnpj_fundo_classe ?? f.cnpj_fundo ?? ""}`.trim(),
    cnpj: f.cnpj_fundo_classe || f.cnpj_fundo || "—",
    lastro: f.tp_lastro_principal || "—",
    gestor: f.gestor_nome || "—",
    admin: f.admin_nome || "—",
    pl: rnd(f.vl_pl_total, 2),
    cotistas: sumCotistas(f.nr_cotistas_senior, f.nr_cotistas_subordinada),
    subord: rnd(f.indice_subordinacao, 2),
    inadim: rnd(f.taxa_inadimplencia, 2),
    pdd: rnd(f.indice_pdd_cobertura, 2),
    rentab_senior: cleanRentab(f.rentab_senior),
    rentab_fundo: cleanRentab(f.rentab_fundo),
    cedentes: f.nr_cedentes ?? null,
  }));

  const sheet: XlsxSheet = {
    name: "Rankings FIDC",
    title: buildTitleRow(filters, funds.length),
    columns,
    rows,
  };

  await exportWorkbook(
    xlsxFilename("fidc", "rankings", filters.lastro?.toLowerCase().replace(/\s+/g, "-")),
    [sheet]
  );
}

function buildTitleRow(filters: FidcRankingsFilters, count: number): string {
  const parts: string[] = [`muuney.hub · Rankings FIDC · ${count} registro${count === 1 ? "" : "s"}`];
  const filterBits: string[] = [];
  if (filters.lastro) filterBits.push(`Lastro: ${filters.lastro}`);
  if (filters.minPl && filters.minPl > 0) filterBits.push(`PL mín.: R$ ${filters.minPl.toLocaleString("pt-BR")}`);
  if (filters.maxInadim != null && filters.maxInadim < 100) filterBits.push(`Inadim. máx.: ${filters.maxInadim}%`);
  if (filters.minSubord && filters.minSubord > 0) filterBits.push(`Subord. mín.: ${filters.minSubord}%`);
  if (filters.search) filterBits.push(`Busca: "${filters.search}"`);
  const sortLabel = `${filters.orderBy} ${String(filters.order).toUpperCase()}`;
  filterBits.push(`Ordem: ${sortLabel}`);
  if (filterBits.length) parts.push(`Filtros: ${filterBits.join(" · ")}`);
  parts.push(`Fonte: CVM · Gerado em ${new Date().toLocaleString("pt-BR")}`);
  return parts.join(" | ");
}
