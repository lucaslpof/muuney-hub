// hub-fip-api v3 — FIP quadrimestral deep module
//
// V3 (26/04/2026) — FIP V2 enrichments:
//  - fip_pe_metrics: TVPI/vintage/call-down/dry powder via v_fip_pe_metrics
//  - fip_cotistas_breakdown: 15 cotistas categories + percentuais subscritos
//  - fip_jcurve: série temporal capital chamado vs PL (3 quadrimestres)
//
// V2 — paginated to beat PostgREST 1000-row cap.

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

async function fetchAllByDate(
  supabase: SupabaseClient,
  table: string,
  date: string,
  columns: string,
  chunkSize = 1000
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let from = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("dt_comptc", date)
      .order("id", { ascending: true })
      .range(from, from + chunkSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < chunkSize) break;
    from += chunkSize;
  }
  return out;
}

async function getLatestFipDate(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("hub_fip_quadrimestral")
    .select("dt_comptc")
    .order("dt_comptc", { ascending: false })
    .limit(1000);
  const counts = new Map<string, number>();
  (data ?? []).forEach((r: any) => {
    const dt = r.dt_comptc as string;
    counts.set(dt, (counts.get(dt) ?? 0) + 1);
  });
  const sortedDates = Array.from(counts.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  );
  return sortedDates[0]?.[0] ?? null;
}

async function enrichWithMeta(
  supabase: SupabaseClient,
  funds: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  if (!funds || funds.length === 0) return funds;
  const cnpjs = Array.from(
    new Set(funds.map((f) => f.cnpj_fundo).filter(Boolean))
  ) as string[];
  if (cnpjs.length === 0) return funds;
  const { data: meta } = await supabase
    .from("hub_fundos_meta")
    .select(
      "cnpj_fundo_classe, cnpj_fundo_legado, denom_social, slug, classe_rcvm175, gestor_nome"
    )
    .or(
      `cnpj_fundo_legado.in.(${cnpjs.join(",")}),cnpj_fundo_classe.in.(${cnpjs.join(",")})`
    );
  const byCnpj = new Map<string, Record<string, unknown>>();
  (meta ?? []).forEach((m: any) => {
    const legado = m.cnpj_fundo_legado as string | null;
    const classe = m.cnpj_fundo_classe as string | null;
    if (legado) byCnpj.set(legado, m);
    if (classe && !byCnpj.has(classe)) byCnpj.set(classe, m);
  });
  return funds.map((f) => {
    const m = byCnpj.get(f.cnpj_fundo as string);
    return {
      ...f,
      denom_social: m?.denom_social ?? f.nome_fundo ?? null,
      slug: m?.slug ?? null,
      cnpj_fundo_classe: m?.cnpj_fundo_classe ?? null,
      classe_rcvm175: m?.classe_rcvm175 ?? "FIP",
      gestor_nome: m?.gestor_nome ?? null,
    };
  });
}

// V3 — resolve cnpj_fundo_legado from slug or cnpj. Required by PE metrics +
// cotistas + jcurve endpoints which key on cnpj_fundo (legacy) in
// hub_fip_quadrimestral.
async function resolveCnpjFundo(
  supabase: SupabaseClient,
  slug: string | null,
  cnpj: string | null
): Promise<string | null> {
  if (cnpj) return cnpj;
  if (!slug) return null;
  const { data } = await supabase
    .from("hub_fundos_meta")
    .select("cnpj_fundo_legado, cnpj_fundo_classe")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  return (data.cnpj_fundo_legado as string) || (data.cnpj_fundo_classe as string) || null;
}

// V3 — 15 cotistas categories with display labels (pt-BR)
const COTISTAS_CATEGORIAS = [
  { key: "pf", label: "Pessoa Física" },
  { key: "pj_nao_financ", label: "PJ Não Financeira" },
  { key: "pj_financ", label: "PJ Financeira" },
  { key: "banco", label: "Banco Comercial" },
  { key: "corretora_distrib", label: "Corretora/Distribuidora" },
  { key: "distrib", label: "Distribuidor" },
  { key: "eapc", label: "EAPC (Prev. Aberta)" },
  { key: "efpc", label: "EFPC (Prev. Fechada)" },
  { key: "rpps", label: "RPPS (Prev. Pública)" },
  { key: "segur", label: "Segurador" },
  { key: "capitaliz", label: "Capitalização/Leasing" },
  { key: "fi", label: "Outros FI" },
  { key: "fii", label: "FII" },
  { key: "invnr", label: "Investidor Não Residente" },
  { key: "outro", label: "Outros" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";
  const supabase = getSupabase();
  try {
    switch (endpoint) {
      case "fip_detail": {
        const slug = url.searchParams.get("slug");
        const cnpjParam = url.searchParams.get("cnpj");
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
            .or(
              `cnpj_fundo_classe.eq.${cnpjParam},cnpj_fundo_legado.eq.${cnpjParam}`
            )
            .maybeSingle();
          meta = data;
        }
        if (!meta) {
          return new Response(
            JSON.stringify({ error: "Fund not found", slug, cnpj: cnpjParam }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const lookupCnpj =
          (meta.cnpj_fundo_legado as string) || (meta.cnpj_fundo_classe as string);
        const { data: quarterly } = await supabase
          .from("hub_fip_quadrimestral")
          .select("*")
          .eq("cnpj_fundo", lookupCnpj)
          .order("dt_comptc", { ascending: true });
        const latest =
          quarterly && quarterly.length > 0 ? quarterly[quarterly.length - 1] : null;
        let similar: Array<Record<string, unknown>> = [];
        if (latest?.tp_fundo_classe) {
          const latestDate = await getLatestFipDate(supabase);
          if (latestDate) {
            const { data: similarRaw } = await supabase
              .from("hub_fip_quadrimestral")
              .select(
                "cnpj_fundo, nome_fundo, tp_fundo_classe, patrimonio_liquido, vl_cap_comprom, vl_cap_integr, nr_cotistas"
              )
              .eq("dt_comptc", latestDate)
              .eq("tp_fundo_classe", latest.tp_fundo_classe)
              .neq("cnpj_fundo", lookupCnpj)
              .order("patrimonio_liquido", { ascending: false, nullsFirst: false })
              .limit(6);
            similar = await enrichWithMeta(supabase, similarRaw ?? []);
          }
        }
        // V3 — pull PE metrics from view (single query, latest only)
        const { data: peMetrics } = await supabase
          .from("v_fip_pe_metrics")
          .select("*")
          .eq("cnpj_fundo", lookupCnpj)
          .maybeSingle();
        return new Response(
          JSON.stringify({
            meta,
            quarterly: quarterly ?? [],
            latest,
            similar,
            pe_metrics: peMetrics, // V3
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "fip_quarterly": {
        const cnpj = url.searchParams.get("cnpj");
        if (!cnpj) {
          return new Response(
            JSON.stringify({ error: "cnpj required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data } = await supabase
          .from("hub_fip_quadrimestral")
          .select("*")
          .eq("cnpj_fundo", cnpj)
          .order("dt_comptc", { ascending: true });
        return new Response(
          JSON.stringify({ cnpj, data: data ?? [], count: data?.length ?? 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "fip_rankings": {
        const orderBy = url.searchParams.get("order_by") ?? "patrimonio_liquido";
        const order = url.searchParams.get("order") ?? "desc";
        const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
        const tipo = url.searchParams.get("tipo");
        const publico = url.searchParams.get("publico_alvo");
        const minPl = url.searchParams.get("min_pl");
        const search = url.searchParams.get("search");
        const latestDate = await getLatestFipDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ error: "No FIP data available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        let q = supabase
          .from("hub_fip_quadrimestral")
          .select("*")
          .eq("dt_comptc", latestDate)
          .not(orderBy, "is", null);
        if (tipo) q = q.eq("tp_fundo_classe", tipo);
        if (publico) q = q.eq("publico_alvo", publico);
        if (minPl) q = q.gte("patrimonio_liquido", Number(minPl));
        if (search) q = q.ilike("nome_fundo", `%${search}%`);
        q = q
          .order(orderBy, { ascending: order === "asc", nullsFirst: false })
          .range(offset, offset + limit - 1);
        const { data } = await q;
        const enriched = await enrichWithMeta(supabase, data ?? []);
        return new Response(
          JSON.stringify({
            date: latestDate,
            order_by: orderBy,
            funds: enriched,
            count: enriched.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "fip_overview": {
        const latestDate = await getLatestFipDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ error: "No FIP data available" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const rows = await fetchAllByDate(
          supabase,
          "hub_fip_quadrimestral",
          latestDate,
          "id, patrimonio_liquido, vl_cap_comprom, vl_cap_subscr, vl_cap_integr, nr_cotistas, tp_fundo_classe, publico_alvo, valor_patrimonial_cota"
        );
        const totalFips = rows.length;
        const totalPl = rows.reduce((s, r) => s + (Number(r.patrimonio_liquido) || 0), 0);
        const totalComprom = rows.reduce((s, r) => s + (Number(r.vl_cap_comprom) || 0), 0);
        const totalSubscr = rows.reduce((s, r) => s + (Number(r.vl_cap_subscr) || 0), 0);
        const totalIntegr = rows.reduce((s, r) => s + (Number(r.vl_cap_integr) || 0), 0);
        const totalCotistas = rows.reduce((s, r) => s + (Number(r.nr_cotistas) || 0), 0);
        const byTipo: Record<string, { count: number; pl: number }> = {};
        const byPublico: Record<string, { count: number; pl: number }> = {};
        rows.forEach((r) => {
          const tp = (r.tp_fundo_classe as string) || "Outros";
          if (!byTipo[tp]) byTipo[tp] = { count: 0, pl: 0 };
          byTipo[tp].count++;
          byTipo[tp].pl += Number(r.patrimonio_liquido) || 0;
          const pa = (r.publico_alvo as string) || "Outros";
          if (!byPublico[pa]) byPublico[pa] = { count: 0, pl: 0 };
          byPublico[pa].count++;
          byPublico[pa].pl += Number(r.patrimonio_liquido) || 0;
        });
        const pctIntegralizado =
          totalComprom > 0 ? (totalIntegr / totalComprom) * 100 : null;
        return new Response(
          JSON.stringify({
            date: latestDate,
            total_fips: totalFips,
            total_pl: totalPl,
            total_cap_comprom: totalComprom,
            total_cap_subscr: totalSubscr,
            total_cap_integr: totalIntegr,
            pct_integralizado: pctIntegralizado,
            capital_a_chamar: totalComprom - totalIntegr,
            total_cotistas: totalCotistas,
            by_tipo: Object.entries(byTipo)
              .map(([tipo, v]) => ({
                tipo,
                count: v.count,
                pl: v.pl,
                pct_pl: totalPl > 0 ? (v.pl / totalPl) * 100 : 0,
              }))
              .sort((a, b) => b.pl - a.pl),
            by_publico: Object.entries(byPublico)
              .map(([publico, v]) => ({ publico, count: v.count, pl: v.pl }))
              .sort((a, b) => b.pl - a.pl),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "fip_search": {
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
          .select(
            "cnpj_fundo_classe, cnpj_fundo_legado, denom_social, slug, gestor_nome, vl_patrim_liq"
          )
          .eq("classe_rcvm175", "FIP")
          .ilike("denom_social", `%${q}%`)
          .order("vl_patrim_liq", { ascending: false, nullsFirst: false })
          .limit(limit);
        return new Response(
          JSON.stringify({ query: q, results: data ?? [], count: data?.length ?? 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      case "fip_segments": {
        const latestDate = await getLatestFipDate(supabase);
        if (!latestDate) {
          return new Response(
            JSON.stringify({ date: null, segments: [] }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const rows = await fetchAllByDate(
          supabase,
          "hub_fip_quadrimestral",
          latestDate,
          "id, tp_fundo_classe, patrimonio_liquido"
        );
        const agg: Record<string, { count: number; pl: number }> = {};
        rows.forEach((r) => {
          const tp = (r.tp_fundo_classe as string) || "Outros";
          if (!agg[tp]) agg[tp] = { count: 0, pl: 0 };
          agg[tp].count++;
          agg[tp].pl += Number(r.patrimonio_liquido) || 0;
        });
        const segments = Object.entries(agg)
          .map(([tipo, v]) => ({ tipo, count: v.count, pl: v.pl }))
          .sort((a, b) => b.pl - a.pl);
        return new Response(
          JSON.stringify({ date: latestDate, segments }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============ V3 NEW ENDPOINTS ============

      case "fip_pe_metrics": {
        const slug = url.searchParams.get("slug");
        const cnpjParam = url.searchParams.get("cnpj");
        const lookup = await resolveCnpjFundo(supabase, slug, cnpjParam);
        if (!lookup) {
          return new Response(
            JSON.stringify({ error: "slug or cnpj required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data, error } = await supabase
          .from("v_fip_pe_metrics")
          .select("*")
          .eq("cnpj_fundo", lookup)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          return new Response(
            JSON.stringify({ cnpj_fundo: lookup, metrics: null }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ cnpj_fundo: lookup, metrics: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "fip_cotistas_breakdown": {
        const slug = url.searchParams.get("slug");
        const cnpjParam = url.searchParams.get("cnpj");
        const lookup = await resolveCnpjFundo(supabase, slug, cnpjParam);
        if (!lookup) {
          return new Response(
            JSON.stringify({ error: "slug or cnpj required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Latest quadrimestre only
        const { data } = await supabase
          .from("hub_fip_quadrimestral")
          .select("*")
          .eq("cnpj_fundo", lookup)
          .order("dt_comptc", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!data) {
          return new Response(
            JSON.stringify({ cnpj_fundo: lookup, dt_referencia: null, breakdown: [] }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // Build category array sorted by pct_cota desc
        const breakdown = COTISTAS_CATEGORIAS.map((cat) => ({
          key: cat.key,
          label: cat.label,
          nr_cotistas: (data as any)[`nr_cotst_subscr_${cat.key}`] ?? null,
          pct_cota: (data as any)[`pr_cota_subscr_${cat.key}`] ?? null,
        }))
          .filter((b) => (b.nr_cotistas ?? 0) > 0 || (b.pct_cota ?? 0) > 0)
          .sort((a, b) => (b.pct_cota ?? 0) - (a.pct_cota ?? 0));
        return new Response(
          JSON.stringify({
            cnpj_fundo: lookup,
            dt_referencia: data.dt_comptc,
            nr_total_cotistas_subscr: data.nr_total_cotst_subscr ?? null,
            nr_cotistas_atuais: data.nr_cotistas ?? null,
            breakdown,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "fip_jcurve": {
        const slug = url.searchParams.get("slug");
        const cnpjParam = url.searchParams.get("cnpj");
        const lookup = await resolveCnpjFundo(supabase, slug, cnpjParam);
        if (!lookup) {
          return new Response(
            JSON.stringify({ error: "slug or cnpj required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const { data } = await supabase
          .from("hub_fip_quadrimestral")
          .select(
            "dt_comptc, patrimonio_liquido, vl_cap_comprom, vl_cap_subscr, vl_cap_integr, nr_cotistas"
          )
          .eq("cnpj_fundo", lookup)
          .order("dt_comptc", { ascending: true });
        const series = (data ?? []).map((r: any) => ({
          dt_comptc: r.dt_comptc,
          pl: Number(r.patrimonio_liquido) || 0,
          cap_comprometido: Number(r.vl_cap_comprom) || 0,
          cap_subscrito: Number(r.vl_cap_subscr) || 0,
          cap_integralizado: Number(r.vl_cap_integr) || 0,
          dry_powder: Math.max(
            (Number(r.vl_cap_comprom) || 0) - (Number(r.vl_cap_integr) || 0),
            0
          ),
          tvpi:
            (Number(r.vl_cap_integr) || 0) > 0
              ? Math.min(
                  (Number(r.patrimonio_liquido) || 0) / (Number(r.vl_cap_integr) || 1),
                  10
                )
              : null,
          call_down_pct:
            (Number(r.vl_cap_comprom) || 0) > 0
              ? Math.min(
                  ((Number(r.vl_cap_integr) || 0) / (Number(r.vl_cap_comprom) || 1)) * 100,
                  100
                )
              : null,
          nr_cotistas: r.nr_cotistas ?? null,
        }));
        return new Response(
          JSON.stringify({
            cnpj_fundo: lookup,
            series,
            count: series.length,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({
            error: "Unknown endpoint",
            available: [
              "fip_detail",
              "fip_quarterly",
              "fip_rankings",
              "fip_overview",
              "fip_search",
              "fip_segments",
              "fip_pe_metrics",
              "fip_cotistas_breakdown",
              "fip_jcurve",
            ],
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error("hub-fip-api error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
