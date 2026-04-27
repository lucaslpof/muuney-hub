// ingest-b3-fii-quotes v1 — Cotações diárias B3 para FIIs via Yahoo Finance
//
// Sem auth. User-Agent obrigatório. Range padrão 2y (suficiente para análise).
//
// Modes:
//   ?mode=resolve     → resolve mapping CNPJ→ticker via heurística ISIN + Yahoo
//   ?mode=quotes      → fetch quotes para tickers já validados
//   ?mode=both (default) → resolve novos + quotes
//   ?range=2y|1y|6mo|1mo (default 2y)
//   ?limit=N          (default 50, top FIIs por PL)
//   ?ticker=HGLG11    → fetch only this ticker (manual)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
};

function tickerFromIsin(isin: string | null): string | null {
  if (!isin) return null;
  const m = isin.match(/^BR([A-Z0-9]{4})CTF\d{3}$/);
  if (!m) return null;
  return m[1] + "11";
}

async function fetchYahoo(ticker: string, range: string): Promise<{
  longName: string | null;
  marketPrice: number | null;
  marketCap: number | null;
  history: Array<{ dt: string; o: number | null; h: number | null; l: number | null; c: number | null; v: number | null }>;
} | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.SA?range=${range}&interval=1d`;
  try {
    const resp = await fetch(url, { headers: YAHOO_HEADERS });
    if (!resp.ok) {
      console.warn(`Yahoo ${ticker} HTTP ${resp.status}`);
      return null;
    }
    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta || {};
    const ts = result.timestamp || [];
    const quote = result.indicators?.quote?.[0] || {};
    const opens = quote.open || [];
    const highs = quote.high || [];
    const lows = quote.low || [];
    const closes = quote.close || [];
    const volumes = quote.volume || [];

    const history = ts
      .map((t: number, i: number) => ({
        dt: new Date(t * 1000).toISOString().slice(0, 10),
        o: opens[i] ?? null,
        h: highs[i] ?? null,
        l: lows[i] ?? null,
        c: closes[i] ?? null,
        v: volumes[i] ?? null,
      }))
      .filter((p: any) => p.c !== null);

    return {
      longName: meta.longName || meta.shortName || null,
      marketPrice: meta.regularMarketPrice ?? null,
      marketCap: meta.marketCap ?? null,
      history,
    };
  } catch (err) {
    console.warn(`Yahoo ${ticker} fetch failed: ${err}`);
    return null;
  }
}

async function resolveTickers(supabase: any, limit: number) {
  // Busca top FIIs por PL ainda sem ticker resolvido
  const { data: fiis } = await supabase
    .from("hub_fii_mensal")
    .select("cnpj_fundo, codigo_isin, patrimonio_liquido, dt_comptc")
    .gte("patrimonio_liquido", 100_000_000)
    .order("patrimonio_liquido", { ascending: false })
    .limit(limit * 3); // pega mais para descartar duplicatas (mensal)
  if (!fiis) return { resolved: 0, skipped_already: 0, failed_validation: 0, no_isin: 0 };

  // Dedupe por CNPJ (latest)
  const byCnpj = new Map<string, any>();
  for (const f of fiis) {
    if (!byCnpj.has(f.cnpj_fundo)) byCnpj.set(f.cnpj_fundo, f);
  }
  const candidates = Array.from(byCnpj.values()).slice(0, limit);

  // Filter já validados
  const cnpjs = candidates.map((c) => c.cnpj_fundo);
  const { data: existing } = await supabase
    .from("hub_fii_b3_tickers")
    .select("cnpj_fundo")
    .in("cnpj_fundo", cnpjs);
  const alreadyResolved = new Set((existing ?? []).map((e: any) => e.cnpj_fundo));

  let resolved = 0, skipped = alreadyResolved.size, failed = 0, noIsin = 0;
  const upserts: any[] = [];

  for (const c of candidates) {
    if (alreadyResolved.has(c.cnpj_fundo)) continue;
    const ticker = tickerFromIsin(c.codigo_isin);
    if (!ticker) { noIsin++; continue; }

    // Validate via Yahoo (rate-limit-friendly: 1 req per ticker, sleep 100ms)
    const yh = await fetchYahoo(ticker, "5d");
    await new Promise((r) => setTimeout(r, 100));
    if (!yh || !yh.marketPrice) { failed++; continue; }

    upserts.push({
      cnpj_fundo: c.cnpj_fundo,
      ticker,
      long_name: yh.longName,
      source: "isin_heuristic",
    });
    resolved++;
  }

  if (upserts.length > 0) {
    const { error } = await supabase
      .from("hub_fii_b3_tickers")
      .upsert(upserts, { onConflict: "cnpj_fundo", ignoreDuplicates: false });
    if (error) console.error("upsert tickers err: " + error.message);
  }

  return { resolved, skipped_already: skipped, failed_validation: failed, no_isin: noIsin };
}

async function fetchQuotes(supabase: any, range: string, limitTickers: number, tickerFilter?: string) {
  let query = supabase
    .from("hub_fii_b3_tickers")
    .select("cnpj_fundo, ticker, long_name");
  if (tickerFilter) query = query.eq("ticker", tickerFilter);
  query = query.limit(limitTickers);
  const { data: tickers } = await query;
  if (!tickers || tickers.length === 0) return { tickers_processed: 0, quotes_upserted: 0 };

  let totalQuotes = 0, batchErrors = 0;
  for (const t of tickers) {
    const yh = await fetchYahoo(t.ticker, range);
    await new Promise((r) => setTimeout(r, 150)); // rate-limit
    if (!yh || yh.history.length === 0) {
      console.warn(`No history for ${t.ticker}`);
      continue;
    }
    const rows = yh.history.map((p) => ({
      cnpj_fundo: t.cnpj_fundo,
      ticker: t.ticker,
      dt: p.dt,
      open: p.o ? Math.round(p.o * 100) / 100 : null,
      high: p.h ? Math.round(p.h * 100) / 100 : null,
      low: p.l ? Math.round(p.l * 100) / 100 : null,
      close: p.c ? Math.round(p.c * 100) / 100 : null,
      volume: p.v ?? null,
      market_cap: yh.marketCap ?? null,  // last marketCap aplicado a todas as datas (snapshot)
    }));

    // Upsert in chunks
    for (let i = 0; i < rows.length; i += 200) {
      const slice = rows.slice(i, i + 200);
      const { error } = await supabase
        .from("hub_fii_b3_diario")
        .upsert(slice, { onConflict: "cnpj_fundo,dt", ignoreDuplicates: false });
      if (error) {
        console.error(`upsert ${t.ticker} err: ` + error.message);
        batchErrors++;
      } else {
        totalQuotes += slice.length;
      }
    }

    // Update last_quote_at
    await supabase
      .from("hub_fii_b3_tickers")
      .update({ last_quote_at: new Date().toISOString() })
      .eq("cnpj_fundo", t.cnpj_fundo);
  }

  return { tickers_processed: tickers.length, quotes_upserted: totalQuotes, batch_errors: batchErrors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const startedAt = new Date().toISOString();
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "both";
  const range = url.searchParams.get("range") || "2y";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const tickerFilter = url.searchParams.get("ticker") || undefined;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log(`=== ingest-b3-fii-quotes v1: mode=${mode} range=${range} limit=${limit} ===`);

    const result: any = { mode, range, limit };
    if (mode === "resolve" || mode === "both") {
      result.resolve = await resolveTickers(supabase, limit);
    }
    if (mode === "quotes" || mode === "both") {
      result.quotes = await fetchQuotes(supabase, range, limit, tickerFilter);
    }

    await supabase.from("hub_cvm_ingestion_log").insert({
      source: "ingest-b3-fii-quotes",
      reference_date: new Date().toISOString().slice(0, 10),
      records_fetched: (result.quotes?.tickers_processed || 0) + (result.resolve?.resolved || 0),
      records_inserted: result.quotes?.quotes_upserted || 0,
      status: "success",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Fatal: " + msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
