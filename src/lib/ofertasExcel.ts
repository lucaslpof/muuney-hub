/**
 * ofertasExcel.ts — V5-D3 (22/04/2026)
 *
 * Excel export for OfertasRadar Explorer table.
 *
 * Single sheet "Ofertas Públicas" with 14 columns (pt-BR numfmt + dates).
 * Prepends a title row listing the filters applied at export time.
 *
 * `fetchAllOfertas()` paginates the `ofertas_list` endpoint up to
 * `maxRows` (default 2000) so the workbook includes every oferta that
 * matches the active filters, not just the visible page of 50.
 */

import {
  exportWorkbook,
  xlsxFilename,
  rnd,
  toDate,
  type XlsxColumn,
  type XlsxSheet,
  type XlsxCellValue,
} from "./xlsxExport";
import {
  fetchOfertas,
  type OfertaPublica,
  type OfertasListFilters,
} from "@/hooks/useHubFundos";

const STATUS_LABELS: Record<string, string> = {
  em_analise: "Em análise",
  concedido: "Concedido",
  em_distribuicao: "Em distribuição",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
  arquivado: "Arquivado",
  suspenso: "Suspenso",
};

/** Fetch up to `maxRows` ofertas with the filters the Explorer is using. */
export async function fetchAllOfertas(
  filters: OfertasListFilters,
  maxRows = 2000
): Promise<OfertaPublica[]> {
  const pageSize = 200;
  const rows: OfertaPublica[] = [];
  let offset = 0;

  while (rows.length < maxRows) {
    const remaining = maxRows - rows.length;
    const limit = Math.min(pageSize, remaining);
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "" && k !== "limit" && k !== "offset") {
        params[k] = String(v);
      }
    });
    const res = (await fetchOfertas("ofertas_list", params)) as {
      ofertas: OfertaPublica[];
      count: number;
    };
    const batch = res?.ofertas || [];
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
    if (res.count != null && offset >= res.count) break;
  }

  return rows;
}

/** Compose and download the Excel workbook. */
export async function exportOfertasRankings(
  ofertas: OfertaPublica[],
  filters: OfertasListFilters
): Promise<void> {
  if (!ofertas.length) return;

  const columns: XlsxColumn[] = [
    { header: "Protocolo", key: "protocolo", format: "text", width: 18 },
    { header: "Emissor CNPJ", key: "emissor_cnpj", format: "text", width: 20 },
    { header: "Emissor Nome", key: "emissor_nome", format: "text", width: 46 },
    { header: "Tipo Oferta", key: "tipo_oferta", format: "text", width: 16 },
    { header: "Tipo Ativo", key: "tipo_ativo", format: "text", width: 22 },
    { header: "Status", key: "status", format: "text", width: 18 },
    { header: "Modalidade", key: "modalidade", format: "text", width: 24 },
    { header: "Valor Total", key: "valor_total", format: "currency", width: 22 },
    { header: "Volume Final", key: "volume_final", format: "currency", width: 22 },
    { header: "Data Protocolo", key: "data_protocolo", format: "date", width: 14 },
    { header: "Data Início", key: "data_inicio", format: "date", width: 14 },
    { header: "Coordenador Líder", key: "coordenador_lider", format: "text", width: 34 },
    { header: "Rating", key: "rating", format: "text", width: 12 },
    { header: "Segmento", key: "segmento", format: "text", width: 22 },
  ];

  const rows: Record<string, XlsxCellValue>[] = ofertas.map((o) => ({
    protocolo: o.protocolo || "—",
    emissor_cnpj: o.emissor_cnpj || "—",
    emissor_nome: o.emissor_nome || "—",
    tipo_oferta: o.tipo_oferta || "—",
    tipo_ativo: o.tipo_ativo || "—",
    status: STATUS_LABELS[o.status] ?? o.status,
    modalidade: o.modalidade || "—",
    valor_total: rnd(o.valor_total, 2),
    volume_final: rnd(o.volume_final, 2),
    data_protocolo: toDate(o.data_protocolo),
    data_inicio: toDate(o.data_inicio),
    coordenador_lider: o.coordenador_lider || "—",
    rating: o.rating || "—",
    segmento: o.segmento || "—",
  }));

  const sheet: XlsxSheet = {
    name: "Ofertas Públicas",
    title: buildTitleRow(filters, ofertas.length),
    columns,
    rows,
  };

  await exportWorkbook(
    xlsxFilename("ofertas", "explorer", filters.tipo_ativo?.toLowerCase().replace(/\s+/g, "-")),
    [sheet]
  );
}

function buildTitleRow(filters: OfertasListFilters, count: number): string {
  const parts: string[] = [
    `muuney.hub · Ofertas Públicas · ${count} registro${count === 1 ? "" : "s"}`,
  ];
  const filterBits: string[] = [];
  if (filters.tipo_ativo) filterBits.push(`Tipo ativo: ${filters.tipo_ativo}`);
  if (filters.tipo_oferta) filterBits.push(`Tipo oferta: ${filters.tipo_oferta}`);
  if (filters.status) filterBits.push(`Status: ${STATUS_LABELS[filters.status] ?? filters.status}`);
  if (filters.modalidade) filterBits.push(`Modalidade: ${filters.modalidade}`);
  if (filters.segmento) filterBits.push(`Segmento: ${filters.segmento}`);
  if (filters.search) filterBits.push(`Busca: "${filters.search}"`);
  if (filters.min_valor) filterBits.push(`Valor mín.: R$ ${filters.min_valor.toLocaleString("pt-BR")}`);
  if (filters.from_date) filterBits.push(`De: ${filters.from_date}`);
  if (filters.to_date) filterBits.push(`Até: ${filters.to_date}`);
  if (filters.order_by) {
    const orderLabel = `${filters.order_by} ${String(filters.order ?? "desc").toUpperCase()}`;
    filterBits.push(`Ordem: ${orderLabel}`);
  }
  if (filterBits.length) parts.push(`Filtros: ${filterBits.join(" · ")}`);
  parts.push(`Fonte: CVM (OFERTA/DISTRIB) · Gerado em ${new Date().toLocaleString("pt-BR")}`);
  return parts.join(" | ");
}
