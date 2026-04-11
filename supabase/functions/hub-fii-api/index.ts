// hub-fii-api — Standalone query-only API for FII Deep Module (V4 Fase 2)
// Mirrors hub-fidc-api pattern with 6 endpoints:
//   fii_detail, fii_monthly, fii_rankings, fii_overview, fii_search, fii_segments
//
// Data source: hub_fii_mensal (2,506 rows, 1,253 fundos, Jan-Mar 2026)
// Enriched via hub_fundos_meta (cnpj_fundo_legado bridge)
//
// deploy: supabase functions deploy hub-fii-api --no-verify-jwt

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "public, max-age=900",
};

function getSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

/** Returns the latest dt_comptc with >= 500 funds (incomplete months skipped) */
async function getLatestFiiDate(supabase: SupabaseClient): Promise<string | null> {
  // Fetch last 6 distinct dates and pick the most recent one with >= 500 funds
  const { data } = await supabase
    .from("hub_fii_mensal")
    .select("dt_comptc")
    .order("dt_comptc", { ascending: false })
    .limit(5000);
  if (!data || data.length === 0) return null;

  const counts = new Map<string, number>();
  data.forEach((r) => {
    const dt = r.dt_comptc as string;
    counts.set(dt, (counts.get(dt) ?? 0) + 1);
  });

  const sortedDates = Array.from(counts.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const complete = sortedDates.find(([, count]) => count >= 500);
  return complete ? complete[0] : sortedDates[0]?.[0] ?? null;
}

/** Enriches an fii row with meta (denom_social + slug) from hub_fundos_meta */
async function enrichWithMeta(
  supabase: SupabaseClient,
  funds: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!funds || funds.length === 0) return funds;
  const cnpjs = Array.from(new Set(funds.map((f) => f.cnpj_fundo).filter(Boolean))) as string[];
  if (cnpjs.length === 0) return funds;

  const { data: meta } = await supabase
    .from("hub_fundos_meta")
    .select("cnpj_fundo_classe, cnpj_fundo_legado, denom_social, slug, classe_rcvm175, gestor_nome")
    .or(`cnpj_fundo_legado.in.(${cnpjs.join(",")}),cnpj_fundo_classe.in.(${cnpjs.join(",")})`);

  const byCnpj = new Map<string, Record<string, unknown>>();
  (meta ?? []).forEach((m) => {
    const key = (m.cnpj_fundo_legado as string) || (m.cnpj_fundo_classe as string);
    if (key) byCnpj.set(key, m);
  });

  return funds.map((f) => {
    const m = byCnpj.get(f.cnpj_fundo as string);
    return {
      ...f,
      denom_social: m?.denom_social ?? f.nome_fundo ?? null,
      slug: m?.slug ?? null,
      cnpj_fundo_classe: m?.cnpj_fundo_classe ?? null,
      classe_rcvm175: m?.classe_rcvm175 ?? "FII",
      gestor_nome: m?.gestor_nome ?? null,
    };
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
      /* ── fii_detail ── meta + monthly + similar by segmento ── */
      case "fii_detail": {
        const slug = url.searchParams.get("slug");
        const cnpjParam = url.searchParams.get("cnpj");

        // Resolve fund by slug or CNPJ
        let meta: Record<string, unknown> | null = null;
        if (slug) {
          const { data } = await supabase
            .from("hub_fundos_meta")
            .select("*")
            .eq("slug", slug)
            .maybeSingle();
          meta = data;
        } else if (cnpjParam) {
          const { data } = await supabase
            .from("hub_fundos_meta")
            .select("*")
            .or(`cnpj_fundo_classe.eq.${cnpjParam},cnpj_fundo_legado.eq.${cnpjParam}`)
            .maybeSingle();
          meta = data;
        }

        if (!meta) {
          return new Response(
            JSON.stringify({ error: "Fund not found", slug, cnpj: cnpjParam }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const lookupCnpj = (meta.cnpj_fundo_legado as string) || (meta.cnpj_fundo_classe as string);

        // Fetch monthly series
        const { data: monthly } = await supabase
          .from("hub_fii_mensal")
          .select("*")
          .eq("cnpj_fundo", lookupCnpj)
          .order("dt_comptc", { ascending: true });

        const latest = monthly && monthly.length > 0 ? monthly[monthly.length - 1] : null;

        // Fetch similar funds (same segmento)
        let similar: Array<Record<string, unknown>> = [];
        if (latest?.segmento) {
          const latestDate = await getLatestFiiDate(supabase);
          if (latestDate) {
            const { data: similarRaw } = await supabase
              .from("hub_fii_mensal")
              .select("cnpj_fundo, nome_fundo, segmento, patrimonio_liquido, dividend_yield_mes, rentabilidade_efetiva_mes, nr_cotistas")
              .eq("dt_comptc", latestDate)
              .eq("segmento", latest.segmento)
              .neq("cnpj_fundo", lookupCnpj)
              .order("patrimonio_liquido", { ascending: false, nullsFirst: false })
              .limit(6);
            similar = await enrichWithMeta(supabase, similarRaw ?? []);
          }
        }

        return new Response(
          JSON.stringify({ meta, monthly: monthly ?? [], latest, similar }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /* ── fii_monthly ── time series for a single fund ── */
      case "fii_monthly": {
        const cnpj = url.searchParams.get("cnpj");
        const months = parseInt(url.searchParams.get("months") ?? "24", 10);
        if (!cnpj) {
          return new Response(JSON.stringify({ error: "cnpj required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - months);
        const { data } = await supabase
          .from("hub_fii_mensal")
          .select("*")
          .eq("cnpj_fundo", cnpj)
          .gte("dt_comptc", fromDate.toISOString().split("T")[0])
          .order("dt_comptc", { ascending: true });

        return new Response(
          JSON.stringify({ cnpj, data: data ?? [], count: data?.length ?? 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /* ── fii_rankings ── sortable + filterable ── */
      case "fii_rankings": {
        const orderBy = url.searchParams.get("order_by") ?? "patrimonio_liquido";
        const order = url.searchParams.get("order") ?? "desc";
        const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
        const segmento = url.searchParams.get("segmento");
        const tipoGestao = url.searchParams.get("tipo_gestao");
        const mandato = url.searchParams.get("mandato");
        const minPl = url.searchParams.get("min_pl");
        const minDy = url.searchParams.get("min_dy");
        const search = url.searchParams.get("search");

        const latestDate = await getLatestFiiDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ error: "No FII data available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let q = supabase
          .from("hub_fii_mensal")
          .select("*")
          .eq("dt_comptc", latestDate)
          .not(orderBy, "is", null);

        if (segmento) q = q.eq("segmento", segmento);
        if (tipoGestao) q = q.eq("tipo_gestao", tipoGestao);
        if (mandato) q = q.eq("mandato", mandato);
        if (minPl) q = q.gte("patrimonio_liquido", Number(minPl));
        if (minDy) q = q.gte("dividend_yield_mes", Number(minDy));
        if (search) q = q.ilike("nome_fundo", `%${search}%`);

        q = q.order(orderBy, { ascending: order === "asc", nullsFirst: false }).range(offset, offset + limit - 1);

        const { data } = await q;
        const enriched = await enrichWithMeta(supabase, data ?? []);

        return new Response(
          JSON.stringify({ date: latestDate, order_by: orderBy, funds: enriched, count: enriched.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /* ── fii_overview ── aggregate KPIs + segmento breakdown ── */
      case "fii_overview": {
        const latestDate = await getLatestFiiDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ error: "No FII data available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data } = await supabase
          .from("hub_fii_mensal")
          .select("patrimonio_liquido, dividend_yield_mes, rentabilidade_efetiva_mes, nr_cotistas, segmento, mandato, tipo_gestao, valor_patrimonial_cota")
          .eq("dt_comptc", latestDate);

        const rows = data ?? [];
        const totalFiis = rows.length;
        const totalPl = rows.reduce((s, r) => s + (Number(r.patrimonio_liquido) || 0), 0);
        const totalCotistas = rows.reduce((s, r) => s + (Number(r.nr_cotistas) || 0), 0);

        let dySum = 0,
          dyCount = 0,
          rentabSum = 0,
          rentabCount = 0;
        const bySegmento: Record<string, { count: number; pl: number; dySum: number; dyCount: number }> = {};
        const byMandato: Record<string, number> = {};
        const byTipoGestao: Record<string, number> = {};

        rows.forEach((r) => {
          if (r.dividend_yield_mes != null) {
            dySum += Number(r.dividend_yield_mes);
            dyCount++;
          }
          if (r.rentabilidade_efetiva_mes != null) {
            rentabSum += Number(r.rentabilidade_efetiva_mes);
            rentabCount++;
          }
          const seg = (r.segmento as string) || "Outros";
          if (!bySegmento[seg]) bySegmento[seg] = { count: 0, pl: 0, dySum: 0, dyCount: 0 };
          bySegmento[seg].count++;
          bySegmento[seg].pl += Number(r.patrimonio_liquido) || 0;
          if (r.dividend_yield_mes != null) {
            bySegmento[seg].dySum += Number(r.dividend_yield_mes);
            bySegmento[seg].dyCount++;
          }

          const mand = (r.mandato as string) || "Outros";
          byMandato[mand] = (byMandato[mand] ?? 0) + 1;

          const tg = (r.tipo_gestao as string) || "Outros";
          byTipoGestao[tg] = (byTipoGestao[tg] ?? 0) + 1;
        });

        return new Response(
          JSON.stringify({
            date: latestDate,
            total_fiis: totalFiis,
            total_pl: totalPl,
            total_cotistas: totalCotistas,
            avg_dividend_yield: dyCount > 0 ? dySum / dyCount : null,
            avg_rentabilidade: rentabCount > 0 ? rentabSum / rentabCount : null,
            by_segmento: Object.entries(bySegmento)
              .map(([segmento, v]) => ({
                segmento,
                count: v.count,
                pl: v.pl,
                pct_pl: totalPl > 0 ? (v.pl / totalPl) * 100 : 0,
                avg_dy: v.dyCount > 0 ? v.dySum / v.dyCount : null,
              }))
              .sort((a, b) => b.pl - a.pl),
            by_mandato: Object.entries(byMandato)
              .map(([mandato, count]) => ({ mandato, count }))
              .sort((a, b) => b.count - a.count),
            by_tipo_gestao: Object.entries(byTipoGestao)
              .map(([tipo, count]) => ({ tipo, count }))
              .sort((a, b) => b.count - a.count),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /* ── fii_search ── name search in hub_fundos_meta (classe_rcvm175=FII) ── */
      case "fii_search": {
        const q = (url.searchParams.get("q") ?? "").trim();
        const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
        if (q.length < 2) {
          return new Response(
            JSON.stringify({ query: q, results: [], count: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data } = await supabase
          .from("hub_fundos_meta")
          .select("cnpj_fundo_classe, cnpj_fundo_legado, denom_social, slug, gestor_nome, vl_patrim_liq")
          .eq("classe_rcvm175", "FII")
          .ilike("denom_social", `%${q}%`)
          .order("vl_patrim_liq", { ascending: false, nullsFirst: false })
          .limit(limit);

        return new Response(
          JSON.stringify({ query: q, results: data ?? [], count: data?.length ?? 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      /* ── fii_segments ── segmento distribution ── */
      case "fii_segments": {
        const latestDate = await getLatestFiiDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ date: null, segments: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data } = await supabase
          .from("hub_fii_mensal")
          .select("segmento, patrimonio_liquido")
          .eq("dt_comptc", latestDate);

        const agg: Record<string, { count: number; pl: number }> = {};
        (data ?? []).forEach((r) => {
          const seg = (r.segmento as string) || "Outros";
          if (!agg[seg]) agg[seg] = { count: 0, pl: 0 };
          agg[seg].count++;
          agg[seg].pl += Number(r.patrimonio_liquido) || 0;
        });

        const segments = Object.entries(agg)
          .map(([segmento, v]) => ({ segmento, count: v.count, pl: v.pl }))
          .sort((a, b) => b.pl - a.pl);

        return new Response(
          JSON.stringify({ date: latestDate, segments }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: "Unknown endpoint",
            available: [
              "fii_detail",
              "fii_monthly",
              "fii_rankings",
              "fii_overview",
              "fii_search",
              "fii_segments",
            ],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("hub-fii-api error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
