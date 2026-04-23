# Runbook — Deploy Módulo Ativos Alternativos V0

**Criado**: 22/04/2026
**Owner**: Lucas
**Escopo**: Passos manuais para colocar o módulo Alternativos em produção pré-beta.

---

## Pré-requisitos

- [x] Código merged em `origin/main`
- [x] Acesso ao Supabase project `yheopprbuimsunqfaqbp`
- [x] Vercel auto-deploy ativo no projeto `prj_3l9W4niwBa8uBCZ7fldQVhfQcdgL`
- [x] `supabase` CLI autenticado localmente (opcional — pode usar Dashboard)

---

## 1. Aplicar a migration

**Arquivo**: `supabase/migrations/20260422000000_hub_alt_module_schema.sql`

**Via CLI**:
```bash
cd /path/to/muuney-hub
supabase db push
```

**Via Dashboard**:
1. Supabase Dashboard → SQL Editor
2. Colar conteúdo da migration
3. Run

**Validação pós-apply**:
```sql
-- Confirmar as 6 tabelas
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'hub_alt_%'
ORDER BY tablename;
-- Esperado: hub_alt_access_logs, hub_alt_interests, hub_alt_materials,
--           hub_alt_opportunities, hub_alt_partners, hub_alt_user_suitability

-- Confirmar storage bucket
SELECT id, name, public FROM storage.buckets WHERE id = 'alt-materials';
-- Esperado: 1 row, public=false

-- Confirmar RLS habilitado
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'hub_alt_%';
-- Esperado: todas com rowsecurity=true
```

---

## 2. Deploy da Edge Function

**Arquivo**: `supabase/functions/hub-alt-api/index.ts`

```bash
supabase functions deploy hub-alt-api
```

A function deploya com `verify_jwt=true` por default. O código faz validação manual de JWT via header `Authorization`.

**Validação**:
```bash
curl -X GET "https://yheopprbuimsunqfaqbp.supabase.co/functions/v1/hub-alt-api?action=alt_suitability_get" \
  -H "Authorization: Bearer <JWT>" \
  -H "apikey: <ANON_KEY>"
# Esperado: { valid: false, current_version: "v1-2026-04-22" } para novo user
```

---

## 3. Configurar secrets (se não existem)

Nenhum secret novo exclusivo do módulo — reutiliza `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` já configurados para outras functions.

Para email notifications (V1):
```bash
supabase secrets set RESEND_API_KEY=re_...
```

---

## 4. Seed inicial

Sem seed fictício. Parters, opportunities e materials só entram em produção com dados reais vindos das gestoras parceiras (Lucas + LPA).

Para validar o fluxo E2E antes do primeiro parceiro real, inserir manualmente via SQL Editor (não versionar):
1. 1 partner interno de teste (ex. `partner-teste-interno`, `ativo=false` + `publicado=false` nas opportunities).
2. 1 opportunity com `publicado=true` apenas durante o smoke-test — reverter para `publicado=false` após validação.

**Importante**: `publicado=true` é necessário para aparecer no módulo. Nunca deixar registros de teste visíveis em produção.

---

## 5. Self-grant admin tier (Lucas)

Se ainda não está como admin:
```sql
INSERT INTO public.hub_user_tiers (user_id, tier)
VALUES ((SELECT id FROM auth.users WHERE email = 'lucas.lpof@gmail.com'), 'admin')
ON CONFLICT (user_id) DO UPDATE SET tier = 'admin', updated_at = now();
```

---

## 6. Smoke test end-to-end

Após Vercel deploy automático do PR, validar com conta pro de teste:

1. **Landing logado**: `https://hub.muuney.com.br/alternativos`
   - Sidebar mostra entrada "Alternativos" com badge "NOVO"
2. **Suitability gate**: modal abre automaticamente na primeira visita
   - Selecionar perfil → aceitar → modal fecha
3. **Hub renderiza**: ver grid com oportunidades seeded
   - Filtros (classe, status, destaque) persistem em URL
4. **Detalhe**: clicar em card
   - Rota `/alternativos/:slug` abre
   - Materiais públicos permitem download (signed URL gera PDF)
   - Materiais gated mostram lock + CTA "Registrar interesse"
5. **Registrar interesse**: abrir modal
   - Pré-fill de email OK
   - Submissão cria row em `hub_alt_interests`
   - Badge "Interesse já registrado" aparece
   - Materiais tier `interesse_registrado` ficam liberados
6. **Audit log**: conferir `hub_alt_access_logs` tem rows de view/download/interest_submit

---

## 7. Rollback

Se o módulo precisar ser desabilitado rapidamente:

**Option A — desabilitar apenas a sidebar entry** (recomendado se código está OK mas dados não prontos):
```tsx
// src/components/hub/HubSidebar.tsx
// Comentar a linha:
// { path: "/alternativos", label: "Alternativos", icon: Gem, badge: "NOVO" },
```
Rota continua funcional, mas escondida do menu.

**Option B — desabilitar rotas** (se há bug crítico):
```tsx
// src/App.tsx
// Comentar as rotas /alternativos e /alternativos/:slug
```

**Option C — rollback DB** (apenas se necessário):
```sql
-- CUIDADO: destrói dados
DROP TABLE IF EXISTS public.hub_alt_access_logs CASCADE;
DROP TABLE IF EXISTS public.hub_alt_interests CASCADE;
DROP TABLE IF EXISTS public.hub_alt_materials CASCADE;
DROP TABLE IF EXISTS public.hub_alt_opportunities CASCADE;
DROP TABLE IF EXISTS public.hub_alt_partners CASCADE;
DROP TABLE IF EXISTS public.hub_alt_user_suitability CASCADE;
DROP FUNCTION IF EXISTS public.hub_alt_set_updated_at() CASCADE;
-- Storage bucket mantido até confirmação manual
```

---

## 8. Observabilidade

**Logs úteis**:
- Supabase Dashboard → Functions → hub-alt-api → Logs (erros 500, signed URL failures)
- Supabase Dashboard → Database → Logs (RLS rejects, trigger errors)
- `hub_alt_access_logs` para audit trail

**Queries de sanity-check semanal**:
```sql
-- Interesses novos pendentes triagem
SELECT COUNT(*) FROM hub_alt_interests WHERE status = 'novo';

-- Oportunidades mais vistas últimos 7 dias
SELECT o.titulo, COUNT(*) as views
FROM hub_alt_access_logs l
JOIN hub_alt_opportunities o ON o.id = l.opportunity_id
WHERE l.action = 'view_opportunity'
  AND l.created_at > now() - interval '7 days'
GROUP BY o.titulo
ORDER BY views DESC LIMIT 10;

-- Suitability acks por versão
SELECT current_version, COUNT(*)
FROM hub_alt_user_suitability
GROUP BY current_version;
```

---

## 9. Escalation

Se algo quebrar:
1. Verificar logs da Edge Function primeiro.
2. Se RLS parecer estar bloqueando indevidamente, testar como service role via `supabase sql`.
3. Para bug de UI, abrir DevTools → Network → conferir payload das queries.
4. Último recurso: rollback Option A (esconder sidebar).

---

## 10. Próxima iteração

Após validar V0 com 2–3 AAIs beta:
- Criar admin UI `/admin/alternativos` (ALT-8, pós-beta)
- Integrar Resend para notificar gestora quando lead novo chega (ALT-9)
- Adicionar watermark dinâmico nos PDFs de materiais sensíveis (ALT-10)

Ver `MODULO-ALTERNATIVOS-SPEC.md` §8 Roadmap.
