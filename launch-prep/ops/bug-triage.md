# hub-cvm-api v23 → v24 — Bug Triage & Fix Record

**Data:** 20/Abr/2026 (D-10)
**Investigação:** via Supabase MCP (logs + código fonte + curl prod + SQL)
**Conclusão:** 3 bugs 500 confirmados em produção + 1 meta-bug (serialização de erro)
**Status:** ✅ **RESOLVIDO** — v24 deployed & smoke-tested 20/Abr/2026

## Fix summary (20/Abr/2026)

1. ✅ **Migration `create_gestora_and_admin_rankings_rpcs`** aplicada — RPCs `gestora_rankings_rpc(p_limit)` + `admin_rankings_rpc(p_limit)` criadas em `public`, com GRANT EXECUTE para `anon/authenticated/service_role`. Validadas via SQL (BB Gestão R$ 2.58T / BB DTVM R$ 3.29T lead).
2. ✅ **hub-cvm-api v24** deployed (ezbr `f024d9bf...`) com 3 mudanças:
   - `fetchAllByDate`: removido default `orderCol='id'` perigoso → parâmetro agora é obrigatório.
   - Caller `monthly_overview`: passa `orderCol='cnpj_fundo_classe'` + inclui coluna no SELECT.
   - Callers `fidc_overview` / `fii_overview` / `fip_overview`: passam `orderCol='cnpj_fundo'` explicitamente (blindagem defense-in-depth).
   - Catch block reescrito: extrai `err.message || err.error.message`, inclui `code/details/hint/endpoint` + `console.error` para Sentry.
3. ✅ **Smoke test** (20/Abr/2026):
   - `gestora_rankings&limit=3` → **200** em 2.56s ✓
   - `admin_rankings&limit=3` → **200** em 0.37s ✓
   - `monthly_overview?months=1` → **200** em 6.87s (20.465 fundos, PL R$ 12.97T em 2026-03-31) ✓
   - Error serialization: `{"error":"Unknown endpoint: fake_bug_test","code":null,...,"endpoint":"fake_bug_test"}` ✓ (antes retornava `{"error":"[object Object]"}`)

**Total fix time real:** ~40 min (vs estimado 1h 30min). **Commit CLAUDE.md:** pendente Lucas.

---

## Sumário executivo

| # | Endpoint | Status prod | Severidade | Causa-raiz | Fix estimado |
|---|----------|-------------|------------|------------|--------------|
| 1 | `gestora_rankings` | HTTP 500 | 🔴 Crítico | RPC `gestora_rankings_rpc` não existe no Postgres | 30 min (criar RPC) |
| 2 | `admin_rankings` | HTTP 500 | 🔴 Crítico | RPC `admin_rankings_rpc` não existe no Postgres | 30 min (criar RPC) |
| 3 | `monthly_overview` | HTTP 500 | 🟠 Alto | `fetchAllByDate` ordena por `id` que não existe em `hub_fundos_diario` (PK composta `cnpj_fundo_classe, dt_comptc`) | 15 min (passar orderCol) |
| 4 | TODOS endpoints | `"error":"[object Object]"` em body | 🟡 Médio | Catch serializa `PostgrestError` (objeto) via `String()` → perde stack trace | 10 min (refinar catch) |

**Total fix time:** ~1h 30min. **Deploy alvo:** v24. **Gate:** Lucas revisa + aprova + deploya.

---

## Bug 1 — `gestora_rankings` HTTP 500

### Reprodução
```bash
curl -s -w "HTTP %{http_code}\n" \
  "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-cvm-api?endpoint=gestora_rankings&limit=5" \
  -H "apikey: <anon>"
# HTTP 500 in 0.359s
# {"error":"[object Object]"}
```

### Código fonte (v23, linhas ~201)
```ts
case 'gestora_rankings': {
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const { data, error } = await supabase.rpc('gestora_rankings_rpc', { p_limit: limit })
  if (error) throw error
  result = { gestoras: data ?? [], total: (data ?? []).length }
  break
}
```

### Diagnóstico SQL
```sql
SELECT p.proname
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'gestora_rankings_rpc';
-- [] (zero resultados)
```

### Causa-raiz
A RPC `gestora_rankings_rpc` **não existe** no schema `public`. A função foi referenciada na migration V3-Fase-A (05/Abr) mas a DDL nunca foi aplicada — ou foi dropada em limpeza posterior. O `CLAUDE.md` ainda documenta ela como ativa, mas o banco discorda.

### Fix hipótese — criar a RPC via migration
```sql
-- Migration: create_gestora_rankings_rpc
CREATE OR REPLACE FUNCTION public.gestora_rankings_rpc(p_limit int DEFAULT 20)
RETURNS TABLE (
  gestor_nome text,
  total_fundos bigint,
  pl_total numeric,
  taxa_adm_media numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    gestor_nome,
    COUNT(*)::bigint AS total_fundos,
    COALESCE(SUM(vl_patrim_liq), 0)::numeric AS pl_total,
    AVG(NULLIF(taxa_adm, 0))::numeric AS taxa_adm_media
  FROM hub_fundos_meta
  WHERE gestor_nome IS NOT NULL AND gestor_nome <> ''
  GROUP BY gestor_nome
  ORDER BY pl_total DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.gestora_rankings_rpc(int) TO anon, authenticated, service_role;
```

### Validação pós-fix
```bash
curl ".../hub-cvm-api?endpoint=gestora_rankings&limit=5"
# esperado: HTTP 200 com { gestoras: [{ gestor_nome, total_fundos, pl_total, taxa_adm_media }], total: N }
```

---

## Bug 2 — `admin_rankings` HTTP 500

### Reprodução
```bash
curl ".../hub-cvm-api?endpoint=admin_rankings&limit=5"
# HTTP 500 in 0.39s
# {"error":"[object Object]"}
```

### Código fonte (v23, linhas ~208)
```ts
case 'admin_rankings': {
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const { data, error } = await supabase.rpc('admin_rankings_rpc', { p_limit: limit })
  if (error) throw error
  result = { admins: data ?? [], total: (data ?? []).length }
  break
}
```

### Causa-raiz
Idem Bug 1 — RPC `admin_rankings_rpc` **não existe** no schema `public`.

### Fix hipótese
```sql
CREATE OR REPLACE FUNCTION public.admin_rankings_rpc(p_limit int DEFAULT 20)
RETURNS TABLE (
  admin_nome text,
  total_fundos bigint,
  pl_total numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    admin_nome,
    COUNT(*)::bigint AS total_fundos,
    COALESCE(SUM(vl_patrim_liq), 0)::numeric AS pl_total
  FROM hub_fundos_meta
  WHERE admin_nome IS NOT NULL AND admin_nome <> ''
  GROUP BY admin_nome
  ORDER BY pl_total DESC NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.admin_rankings_rpc(int) TO anon, authenticated, service_role;
```

### Validação pós-fix
```bash
curl ".../hub-cvm-api?endpoint=admin_rankings&limit=5"
# esperado: HTTP 200 com { admins: [...], total: N }
```

---

## Bug 3 — `monthly_overview` HTTP 500

### Reprodução
```bash
curl ".../hub-cvm-api?endpoint=monthly_overview&months=1"
# HTTP 500 in 0.35s (não é timeout — falha rápida)
# {"error":"[object Object]"}
```

### Código fonte (v23, linhas ~33-47 + ~235-257)
Helper:
```ts
async function fetchAllByDate(
  supabase: ReturnType<typeof getSupabase>,
  table: string,
  dateColumn: string,
  date: string,
  columns: string,
  orderCol = 'id',  // ← PROBLEMA: default 'id'
  chunkSize = 1000,
) {
  // ...
  .order(orderCol, { ascending: true })
  // ...
}
```

Uso no endpoint:
```ts
const rows = await fetchAllByDate(
  supabase,
  'hub_fundos_diario',
  'dt_comptc',
  dt,
  'vl_patrim_liq'
  // orderCol não passado → default 'id'
)
```

### Diagnóstico de schema
```
hub_fundos_diario PK: (cnpj_fundo_classe, dt_comptc)
Colunas: cnpj_fundo, cnpj_fundo_classe, dt_comptc, vl_total, vl_quota,
         vl_patrim_liq, captc_dia, resg_dia, nr_cotst
→ NÃO existe coluna "id"
```

PostgREST retorna `PostgrestError { message: 'column hub_fundos_diario.id does not exist', code: '42703' }` na primeira chamada ao `.order('id')`. Como a falha é imediata (0.35s), mata o loop antes do segundo mês.

**Falha em `months=1` confirma que não é timeout** (2.6M rows no total, mas fetchAllByDate limita por `eq(dateColumn, date)`, então faria ~22k rows/mês em 22 chunks).

### Fix hipótese — passar orderCol explícito
```ts
// linha ~244
const rows = await fetchAllByDate(
  supabase,
  'hub_fundos_diario',
  'dt_comptc',
  dt,
  'cnpj_fundo_classe, vl_patrim_liq',  // incluir PK column no select
  'cnpj_fundo_classe',                  // ← orderCol explícito
)
```

**Alternativa mais robusta** (evita esquecimento futuro): inferir orderCol automaticamente.
```ts
async function fetchAllByDate(
  supabase,
  table: string,
  dateColumn: string,
  date: string,
  columns: string,
  orderCol?: string,
  chunkSize = 1000,
) {
  // Sane defaults por tabela conhecida
  const defaultOrderCols: Record<string, string> = {
    'hub_fundos_diario': 'cnpj_fundo_classe',
    'v_hub_fidc_clean': 'cnpj_fundo',
    'hub_fii_mensal': 'cnpj_fundo',
    'hub_fip_quadrimestral': 'cnpj_fundo',
  }
  const actualOrderCol = orderCol ?? defaultOrderCols[table] ?? 'id'
  // resto igual, usar actualOrderCol
}
```

### Validação pós-fix
```bash
curl ".../hub-cvm-api?endpoint=monthly_overview&months=6"
# esperado: HTTP 200 com { months: [{ dt, total_pl, total_funds }, ...], count: 6 }
# tempo esperado: 5-8s (6 meses × 22 chunks × ~150ms = ~20s no worst case; com PL coverage 99% deve voltar rápido)
```

**Atenção:** se `months=12` extrapolar timeout de 150s da Edge Function, migrar lógica para uma VIEW materializada `v_hub_fundos_monthly_overview` atualizada pelo pg_cron.

---

## Bug 4 (Meta) — Erro serializado como `[object Object]`

### Reprodução
Todos os endpoints falhando retornam body `{"error":"[object Object]"}` — sem informação útil.

### Código fonte (v23, linhas ~575-580)
```ts
} catch (error) {
  const errorMsg = error instanceof Error ? error.message : String(error)
  return new Response(JSON.stringify({ error: errorMsg }), {
    status: 500,
    // ...
  })
}
```

### Causa-raiz
Quando `supabase.from('...').select(...)` falha com PostgrestError, o objeto **não é instância de `Error`** (é um plain object `{ message, details, hint, code }`). A branch `String(error)` vira `"[object Object]"` — perde toda informação.

### Fix hipótese — extrair `.message` explicitamente + log no console
```ts
} catch (error) {
  const err = error as any
  const errorMsg = err?.message ?? err?.error?.message ?? String(err)
  const errorCode = err?.code ?? err?.status ?? 'UNKNOWN'
  console.error('[hub-cvm-api]', { endpoint, msg: errorMsg, code: errorCode, raw: err })
  return new Response(
    JSON.stringify({ error: errorMsg, code: errorCode }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}
```

**Benefícios:**
- Sentry (T5) captura stack trace real em vez de `[object Object]`
- Debug em produção via `supabase functions logs hub-cvm-api`
- Frontend via `apiError.ts` (pt-BR friendly) consegue mapear o `.code` → mensagem user-friendly

---

## Checklist de correção (v23 → v24)

Ordem sugerida (menor blast radius primeiro):

- [ ] **1. Migration SQL** — criar `gestora_rankings_rpc` + `admin_rankings_rpc` (sem tocar Edge Function)
- [ ] **2. Validar** — `curl gestora_rankings` + `curl admin_rankings` devem retornar 200 **antes** de deploy v24
- [ ] **3. Editar `hub-cvm-api/index.ts`:**
  - [ ] Passar `orderCol` explícito em `fetchAllByDate` no endpoint `monthly_overview` (linha ~244)
  - [ ] Refatorar catch (linhas ~575-580) com `err?.message` + `err?.code` + `console.error`
  - [ ] (Opcional) Adicionar defaults `orderCol` por tabela no helper
- [ ] **4. Deploy:** `supabase functions deploy hub-cvm-api`
- [ ] **5. Smoke test v24:**
  ```bash
  for ep in monthly_overview gestora_rankings admin_rankings; do
    curl -s -w "HTTP %{http_code} " ".../hub-cvm-api?endpoint=$ep&limit=5" | head -c 200
    echo
  done
  ```
  Todos devem retornar HTTP 200.
- [ ] **6. Atualizar CLAUDE.md** — marcar bugs resolvidos, manter RPCs documentados

---

## Notas laterais

- **RPC `fidc_latest_complete_date`** está funcional (confirmado em logs + uso em hub-fidc-api v3). Apenas `gestora_rankings_rpc` e `admin_rankings_rpc` estavam desaparecidas.
- **`hub_fundos_diario` tem 2,612,096 rows, 128 datas distintas (Out/25 → Mar/26)** — `fetchAllByDate` por data é seguro (avg 20k rows/dia), mas `monthly_overview` faz N chamadas sequenciais → considerar Promise.all se timeout aparecer com months=12.
- **Não há monitoring em pé** — sem Sentry (T5), bugs silenciosos como estes só são detectados por smoke test manual ou reclamação de usuário. Prioridade: instalar Sentry **antes** do beta invite wave de D-7.

---

## Contatos e pendências

- **Autor fix proposto:** Agente (este doc)
- **Revisor obrigatório antes do deploy:** Lucas
- **Agente NÃO faz deploy** — apenas propõe migration + diff. Lucas valida e deploya.
- **ETA realista:** 1h (SQL migrations) + 30min (editar + deploy Edge Function) + 15min (smoke test) = **~2h total**
- **Janela recomendada:** hoje 20/Abr (D-10) entre 14-17h, antes de avançar qualquer outro deliverable de launch
