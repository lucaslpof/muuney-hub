// hub-ofertas-api — Standalone query-only API for Ofertas Públicas Radar (V4 Fase 3)
// Mirrors hub-fii-api / hub-fidc-api pattern with 5 endpoints:
//   ofertas_list, ofertas_detail, ofertas_timeline, ofertas_stats, ofertas_filters
//
// Data source: hub_ofertas_publicas (seeded sample; will be enriched via CVM OFERTA/DISTRIB ETL)
// Domain: public offerings (CVM 160/476/400) — Debêntures, CRI, CRA, FIDC, FII, Ações, Notas Promissórias
//
// deploy: supabase functions deploy hub-ofertas-api --no-verify-jwt

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=600",
};

function getSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";
  const supabase = getSupabase();

  try {
    switch (endpoint) {
      /* ── ofertas_list ── paginated + filterable table of offerings ── */
      case "ofertas_list": {
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
        const orderBy = url.searchParams.get("order_by") ?? "data_protocolo";
        const order = url.searchParams.get("order") ?? "desc";

        const tipoAtivo = url.searchParams.get("tipo_ativo");
        const tipoOferta = url.searchParams.get("tipo_oferta");
        const status = url.searchParams.get("status");
        const modalidade = url.searchParams.get("modalidade");
        const segmento = url.searchParams.get("segmento");
        const search = url.searchParams.get("search");
        const minValor = url.searchParams.get("min_valor");
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");

        let q = supabase.from("hub_ofertas_publicas").select("*", { count: "exact" });

        if (tipoAtivo) q = q.eq("tipo_ativo", tipoAtivo);
        if (tipoOferta) q = q.eq("tipo_oferta", tipoOferta);
        if (status) q = q.eq("status", status);
        if (modalidade) q = q.eq("modalidade", modalidade);
        if (segmento) q = q.eq("segmento", segmento);
        if (minValor) q = q.gte("valor_total", Number(minValor));
        if (fromDate) q = q.gte("data_protocolo", fromDate);
        if (toDate) q = q.lte("data_protocolo", toDate);
        if (search) {
          // Match against emissor_nome or coordenador_lider
          q = q.or(`emissor_nome.ilike.%${search}%,coordenador_lider.ilike.%${search}%`);
        }

        q = q
          .order(orderBy, { ascending: order === "asc", nullsFirst: false })
          .range(offset, offset + limit - 1);

        const { data, error, count } = await q;
        if (error) throw error;

        return jsonResponse({
          ofertas: data ?? [],
          count: count ?? data?.length ?? 0,
          limit,
          offset,
        });
      }

      /* ── ofertas_detail ── single oferta by protocolo ── */
      case "ofertas_detail": {
        const protocolo = url.searchParams.get("protocolo");
        const id = url.searchParams.get("id");
        if (!protocolo && !id) {
          return jsonResponse({ error: "protocolo or id required" }, 400);
        }

        let q = supabase.from("hub_ofertas_publicas").select("*");
        if (protocolo) q = q.eq("protocolo", protocolo);
        else if (id) q = q.eq("id", Number(id));

        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        if (!data) return jsonResponse({ error: "Oferta not found", protocolo, id }, 404);

        // Related ofertas (same emissor)
        const { data: related } = await supabase
          .from("hub_ofertas_publicas")
          .select("id, protocolo, emissor_nome, tipo_ativo, status, valor_total, data_protocolo")
          .eq("emissor_cnpj", data.emissor_cnpj)
          .neq("id", data.id)
          .order("data_protocolo", { ascending: false })
          .limit(8);

        return jsonResponse({ oferta: data, related: related ?? [] });
      }

      /* ── ofertas_timeline ── chronological view grouped by month ── */
      case "ofertas_timeline": {
        const months = parseInt(url.searchParams.get("months") ?? "12", 10);
        const tipoAtivo = url.searchParams.get("tipo_ativo");
        const status = url.searchParams.get("status");

        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - months);
        const fromISO = fromDate.toISOString().split("T")[0];

        let q = supabase
          .from("hub_ofertas_publicas")
          .select("id, protocolo, emissor_nome, tipo_ativo, tipo_oferta, status, valor_total, volume_final, data_protocolo, data_inicio, data_encerramento, segmento, rating")
          .gte("data_protocolo", fromISO)
          .order("data_protocolo", { ascending: false });

        if (tipoAtivo) q = q.eq("tipo_ativo", tipoAtivo);
        if (status) q = q.eq("status", status);

        const { data, error } = await q;
        if (error) throw error;

        // Group by month
        const byMonth: Record<
          string,
          { month: string; count: number; valor_total: number; volume_final: number; ofertas: typeof data }
        > = {};
        (data ?? []).forEach((r) => {
          const month = (r.data_protocolo as string)?.slice(0, 7) ?? "unknown";
          if (!byMonth[month]) {
            byMonth[month] = { month, count: 0, valor_total: 0, volume_final: 0, ofertas: [] };
          }
          byMonth[month].count++;
          byMonth[month].valor_total += Number(r.valor_total) || 0;
          byMonth[month].volume_final += Number(r.volume_final) || 0;
          byMonth[month].ofertas.push(r);
        });

        const timeline = Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));

        return jsonResponse({
          months,
          total: data?.length ?? 0,
          timeline,
        });
      }

      /* ── ofertas_stats ── aggregate KPIs + breakdown ── */
      case "ofertas_stats": {
        const fromDate = url.searchParams.get("from_date");
        const toDate = url.searchParams.get("to_date");

        let q = supabase
          .from("hub_ofertas_publicas")
          .select("tipo_ativo, tipo_oferta, status, modalidade, valor_total, volume_final, segmento, data_protocolo");

        if (fromDate) q = q.gte("data_protocolo", fromDate);
        if (toDate) q = q.lte("data_protocolo", toDate);

        const { data, error } = await q;
        if (error) throw error;

        const rows = data ?? [];
        const totalOfertas = rows.length;
        const totalValor = rows.reduce((s, r) => s + (Number(r.valor_total) || 0), 0);
        const totalVolume = rows.reduce((s, r) => s + (Number(r.volume_final) || 0), 0);

        const emDistribuicao = rows.filter((r) => r.status === "em_distribuicao").length;
        const emAnalise = rows.filter((r) => r.status === "em_analise").length;
        const encerradas = rows.filter((r) => r.status === "encerrado").length;

        const byTipoAtivo: Record<string, { count: number; valor: number }> = {};
        const byStatus: Record<string, number> = {};
        const byTipoOferta: Record<string, number> = {};
        const byModalidade: Record<string, number> = {};
        const bySegmento: Record<string, { count: number; valor: number }> = {};

        rows.forEach((r) => {
          const ta = (r.tipo_ativo as string) || "Outros";
          if (!byTipoAtivo[ta]) byTipoAtivo[ta] = { count: 0, valor: 0 };
          byTipoAtivo[ta].count++;
          byTipoAtivo[ta].valor += Number(r.valor_total) || 0;

          const st = (r.status as string) || "indefinido";
          byStatus[st] = (byStatus[st] ?? 0) + 1;

          const to = (r.tipo_oferta as string) || "Outros";
          byTipoOferta[to] = (byTipoOferta[to] ?? 0) + 1;

          const md = (r.modalidade as string) || "Outros";
          byModalidade[md] = (byModalidade[md] ?? 0) + 1;

          const sg = (r.segmento as string) || "Outros";
          if (!bySegmento[sg]) bySegmento[sg] = { count: 0, valor: 0 };
          bySegmento[sg].count++;
          bySegmento[sg].valor += Number(r.valor_total) || 0;
        });

        return jsonResponse({
          total_ofertas: totalOfertas,
          total_valor: totalValor,
          total_volume: totalVolume,
          em_distribuicao: emDistribuicao,
          em_analise: emAnalise,
          encerradas: encerradas,
          by_tipo_ativo: Object.entries(byTipoAtivo)
            .map(([tipo, v]) => ({ tipo, count: v.count, valor: v.valor }))
            .sort((a, b) => b.valor - a.valor),
          by_status: Object.entries(byStatus)
            .map(([status, count]) => ({ status, count }))
            .sort((a, b) => b.count - a.count),
          by_tipo_oferta: Object.entries(byTipoOferta)
            .map(([tipo, count]) => ({ tipo, count }))
            .sort((a, b) => b.count - a.count),
          by_modalidade: Object.entries(byModalidade)
            .map(([modalidade, count]) => ({ modalidade, count }))
            .sort((a, b) => b.count - a.count),
          by_segmento: Object.entries(bySegmento)
            .map(([segmento, v]) => ({ segmento, count: v.count, valor: v.valor }))
            .sort((a, b) => b.valor - a.valor),
        });
      }

      /* ── ofertas_filters ── distinct values for filter dropdowns ── */
      case "ofertas_filters": {
        const { data, error } = await supabase
          .from("hub_ofertas_publicas")
          .select("tipo_ativo, tipo_oferta, status, modalidade, segmento");
        if (error) throw error;

        const tiposAtivo = new Set<string>();
        const tiposOferta = new Set<string>();
        const statuses = new Set<string>();
        const modalidades = new Set<string>();
        const segmentos = new Set<string>();

        (data ?? []).forEach((r) => {
          if (r.tipo_ativo) tiposAtivo.add(r.tipo_ativo as string);
          if (r.tipo_oferta) tiposOferta.add(r.tipo_oferta as string);
          if (r.status) statuses.add(r.status as string);
          if (r.modalidade) modalidades.add(r.modalidade as string);
          if (r.segmento) segmentos.add(r.segmento as string);
        });

        return jsonResponse({
          tipos_ativo: Array.from(tiposAtivo).sort(),
          tipos_oferta: Array.from(tiposOferta).sort(),
          statuses: Array.from(statuses).sort(),
          modalidades: Array.from(modalidades).sort(),
          segmentos: Array.from(segmentos).sort(),
        });
      }

      default:
        return jsonResponse(
          {
            error: "Unknown endpoint",
            available: [
              "ofertas_list",
              "ofertas_detail",
              "ofertas_timeline",
              "ofertas_stats",
              "ofertas_filters",
            ],
          },
          400
        );
    }
  } catch (err) {
    console.error("hub-ofertas-api error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
