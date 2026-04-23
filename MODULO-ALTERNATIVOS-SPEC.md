# Módulo Ativos Alternativos — muuney.hub

**Versão**: V0 (22/04/2026 · pré-beta)
**Status**: Scaffold completo · frontend + backend + migrations + edge function em PR única.
**Owner técnico**: Lucas (lucas.lpof@gmail.com)
**Escopo regulatório**: Híbrido — vitrine informativa + lead-gen (muuney NÃO distribui valores mobiliários).

---

## 1. Objetivo

Entregar aos AAIs (agentes autônomos de investimento CVM 35) da muuney.hub uma vitrine PRO de oportunidades alternativas curada manualmente por Lucas + parceiras cadastradas, com:

- Lista filtrada por classe, status, público-alvo, perfil de risco.
- Lâmina completa por oportunidade com teasers públicos + materiais gated (deck, term sheet, DD room).
- Formulário de interesse AAI → gestora com dados do cliente final anonimizados (first name + faixa patrimonial + ticket).
- Aceite versionado dos termos (suitability gate) antes de acessar o módulo, com log de IP + user-agent para auditoria.

A muuney não intermedeia ordens nem capta recursos. O módulo é uma camada de inteligência/lead-gen que conecta AAI e gestora. A formalização sempre ocorre fora da plataforma.

---

## 2. Classes cobertas (V0)

| `classe`             | Label                    | Cor       |
| -------------------- | ------------------------ | --------- |
| `private_credit`     | Crédito Privado          | `#F97316` |
| `private_equity`     | Private Equity           | `#8B5CF6` |
| `real_estate`        | Real Estate              | `#EC4899` |
| `ofertas_restritas`  | Ofertas Restritas        | `#06B6D4` |
| `club_deals`         | Club Deals               | `#22C55E` |
| `offshore`           | Offshore                 | `#0B6C3E` |
| `alt_liquidos`       | Alternativos Líquidos    | `#F59E0B` |

Origem mista: Lucas pode curar manualmente e parceiras podem submeter via fluxo admin (V2 self-service).

---

## 3. Modelo de dados

Migration: `supabase/migrations/20260422000000_hub_alt_module_schema.sql`

### 3.1 Tabelas

| Tabela                          | Propósito                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| `hub_alt_partners`              | Gestoras cadastradas (cnpj + slug + website + ativa).          |
| `hub_alt_opportunities`         | Cards do módulo — classe, ticket, rentab_alvo, horizonte, etc. |
| `hub_alt_materials`             | Anexos tier público / pro / interesse_registrado.              |
| `hub_alt_access_logs`           | Audit trail de views, downloads, acks.                         |
| `hub_alt_interests`             | Leads AAI → gestora com cliente anonimizado.                   |
| `hub_alt_user_suitability`      | Aceite versionado dos termos.                                  |

### 3.2 Características-chave

- **Slug**: `hub_alt_partners.slug` e `hub_alt_opportunities.slug` são únicos e servem de rota.
- **Tiers de material**: `publico`, `pro`, `interesse_registrado` — enforce em edge function, nunca via storage direto.
- **Cliente anonimizado** em `hub_alt_interests`: apenas `cliente_primeiro_nome` + `cliente_faixa_patrimonio` + `cliente_ticket_pretendido` + `cliente_observacoes`. Nunca CPF, endereço ou nome completo.
- **RLS**: user lê próprios dados (interests, logs, suitability), service role tem acesso total. Admin (tier=admin) tem full read/write via `hub_user_tiers`.
- **Storage**: bucket privado `alt-materials`. Downloads via signed URL TTL 5 min gerada pela edge function após validação de tier + ack.

### 3.3 Triggers e índices

- `hub_alt_set_updated_at()` — trigger em todas as 6 tabelas para manter `updated_at`.
- Índices GIN em `tags` (opportunities) para busca rápida.
- Índices parciais em `WHERE ativa = true` / `WHERE publicado = true` / `WHERE destaque = true`.

---

## 4. Backend — Edge Function `hub-alt-api`

Source: `supabase/functions/hub-alt-api/index.ts` (~586 linhas, `verify_jwt=false` — auth via header Authorization manual)

### 4.1 Endpoints (query param `action=`)

| Endpoint                    | Método | Auth       | Tier     | Propósito                                                    |
| --------------------------- | ------ | ---------- | -------- | ------------------------------------------------------------ |
| `alt_opportunities_list`    | GET    | Pro        | user     | Lista filtrada (classe, status, destaque, publico_alvo, q).  |
| `alt_opportunity_detail`    | GET    | Pro        | user     | Detalhe + materials visíveis + my_interests + has_interest.  |
| `alt_opportunity_stats`     | GET    | Pro        | user     | KPIs agregados (total, por classe, por status).              |
| `alt_opportunity_filters`   | GET    | Pro        | user     | Valores distintos p/ dropdowns (setores, geografias, tags).  |
| `alt_suitability_get`       | GET    | Pro        | user     | Status do aceite do user + versão atual dos termos.          |
| `alt_my_interests`          | GET    | Pro        | user     | Lista de interesses submetidos pelo AAI.                     |
| `alt_suitability_ack`       | POST   | Pro        | user     | Registra aceite versionado (declared_profile + escritório).  |
| `alt_log_view`              | POST   | Pro        | user     | Fire-and-forget log de view de oportunidade.                 |
| `alt_material_signed_url`   | POST   | Pro        | user     | Valida tier + ack + interesse, gera signed URL TTL 5min.     |
| `alt_interest_submit`       | POST   | Pro        | user     | Cria lead (AAI → gestora) com cliente anonimizado.           |

### 4.2 Enforcement

- **Suitability gate**: toda `action` exceto `alt_suitability_get` exige `hub_alt_user_suitability.current_version = CURRENT_TERMS_VERSION` ativo.
- **Tier gate**: header `Authorization: Bearer <JWT>` resolve user; edge function valida `hub_user_tiers.tier` ∈ (`pro`, `admin`). Free recebe 403.
- **Material tier gate**:
  - `tier_acesso = publico` → qualquer user Pro.
  - `tier_acesso = pro` → user Pro + suitability ack.
  - `tier_acesso = interesse_registrado` → user Pro + suitability ack + interesse submetido naquela oportunidade.
- **Audit**: cada signed URL e view insere row em `hub_alt_access_logs`.

---

## 5. Frontend

### 5.1 Rotas (`src/App.tsx`)

```tsx
<Route path="/alternativos/:slug"
       element={<ProRoute feature="a lâmina de Ativos Alternativos"><AlternativosDetail /></ProRoute>} />
<Route path="/alternativos"
       element={<ProRoute feature="o módulo Ativos Alternativos"><AlternativosHub /></ProRoute>} />
```

Ambas as rotas ficam dentro do `<ProtectedRoute><HubLayout /></ProtectedRoute>`. Rota específica (`:slug`) declarada ANTES da genérica.

### 5.2 Sidebar (`src/components/hub/HubSidebar.tsx`)

Entrada inserida em `MODULES` entre Ofertas Públicas e Portfolio:

```tsx
{ path: "/alternativos", label: "Alternativos", icon: Gem, badge: "NOVO" },
```

### 5.3 Hook central — `src/hooks/useAlternativos.ts` (~478 linhas)

| Hook                             | Descrição                                                                |
| -------------------------------- | ------------------------------------------------------------------------ |
| `useAltOpportunities(filters)`   | Lista filtrada (React Query, staleTime 10min).                           |
| `useAltOpportunityDetail(slug)`  | Detalhe + materials + my_interests + has_interest_registered.            |
| `useAltOpportunityStats()`       | KPIs hub (total, por classe, por status).                                |
| `useAltOpportunityFilters()`     | Valores distintos p/ filtros (setores, geografias, tags).                |
| `useAltSuitability()`            | Status ack + versão atual.                                               |
| `useAckSuitability()`            | Mutation — submete ack versionado.                                       |
| `useAltMyInterests()`            | Lista de interesses do AAI.                                              |
| `useSubmitInterest()`            | Mutation — submete form cliente anonimizado.                             |
| `useRequestMaterialSignedUrl()`  | Mutation — retorna `{signed_url, expires_in_seconds, watermark}`.        |
| `useLogOpportunityView()`        | Mutation — fire-and-forget log de view.                                  |

### 5.4 Páginas

#### `src/pages/AlternativosHub.tsx` (~406 linhas)
- HubSEO (noindex via `isProtected`)
- SuitabilityGate (autoPrompt=true)
- Filtros: q, classe, status, destaque persistidos em `useSearchParams`
- Grid responsivo de `OpportunityCard`
- Strip "Meus interesses recentes" (`MyInterestsStrip`)
- KPIs hero (total ativas, em distribuição, encerradas, classes disponíveis)

#### `src/pages/AlternativosDetail.tsx` (~535 linhas)
- HubSEO + Breadcrumbs
- SuitabilityGate (autoPrompt=true)
- Header: classe/status badges + accent + destaque badge
- 12-metric grid: ticket min/max, rentab alvo, horizonte, público, perfil, setor, geografia, volume captação, data abertura, data encerramento, moeda
- Tags row
- 2-col responsivo (`lg:grid-cols-[1fr_340px]`):
  - Left: `DescriptionPanel` (descricao_longa + estrategia) + `MaterialsSection`
  - Right: `MyInterestsPanel` (se houver) + `RegulatoryPanel`
- CTA "Registrar interesse" — disabled se `status=encerrada`; substituído por badge "Interesse já registrado" quando `has_interest_registered`
- Fire-and-forget `useLogOpportunityView({ opportunity_id })` no mount

### 5.5 Componentes (`src/components/alternativos/`)

| Arquivo                | Responsabilidade                                                      |
| ---------------------- | --------------------------------------------------------------------- |
| `OpportunityCard.tsx`  | Card da grid do hub.                                                  |
| `OpportunityFilters.tsx` | Filtros do hub (q, classe, status, destaque).                       |
| `MaterialsSection.tsx` | Lista gated de materiais agrupada por tier_acesso.                    |
| `InterestForm.tsx`     | Modal form cliente anonimizado (first_name + faixa + ticket + obs).  |
| `SuitabilityGate.tsx`  | Wrapper que bloqueia acesso até ack válido (modal + fallback screen). |

---

## 6. Fluxo do usuário

### 6.1 Primeira visita
1. AAI (tier=pro) acessa `/alternativos`.
2. `SuitabilityGate` detecta ausência de aceite ou aceite de versão antiga.
3. Modal de termos abre automaticamente (autoPrompt=true):
   - Escopo regulatório (CVM 178/35, CVM 160/476, LGPD)
   - Perfil declarado (profissional / qualificado / varejo ciente)
   - Escritório (opcional)
   - Checkbox de aceite
4. `useAckSuitability` registra aceite com timestamp + IP + user-agent + version.
5. Modal fecha, hub renderiza.

### 6.2 Ver oportunidade
1. AAI clica em card.
2. Rota `/alternativos/:slug` abre.
3. `useAltOpportunityDetail` busca dados.
4. `useLogOpportunityView` dispara fire-and-forget.
5. Materiais públicos aparecem com botão "Baixar" (signed URL imediata).
6. Materiais pro aparecem com botão "Baixar" (signed URL após validação de tier + ack).
7. Materiais `interesse_registrado` ficam bloqueados com CTA "Registrar interesse".

### 6.3 Registrar interesse
1. AAI clica "Registrar interesse" no header ou em material bloqueado.
2. `InterestForm` modal abre com AAI pré-preenchido (email via `useAuth`).
3. AAI completa: primeiro nome do cliente, faixa patrimonial, ticket, observações.
4. `useSubmitInterest` submete.
5. Lead entra em `hub_alt_interests` com `status='novo'`.
6. Badge "Interesse já registrado" aparece no header.
7. Materiais tier `interesse_registrado` ficam liberados.

### 6.4 Admin triagem (V0 manual)
1. Lucas consulta `hub_alt_interests WHERE status='novo'`.
2. Valida enquadramento e encaminha lead para a gestora (fora da plataforma).
3. Atualiza `status` para `qualificado` / `em_analise` / `convertido` / `perdido`.
4. V1: admin UI `/admin/alternativos` para triagem in-app.

---

## 7. Compliance checklist

| Item                                                          | Status | Como validar                                             |
| ------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| Muuney não distribui — vitrine + lead-gen                     | ✅     | Copy do modal de termos + footer regulatório             |
| Cliente sempre anonimizado                                    | ✅     | Schema de `hub_alt_interests` (sem CPF/endereço/nome)    |
| Aceite versionado com IP + UA + timestamp                     | ✅     | Migration + edge function `alt_suitability_ack`          |
| Materiais gated com signed URL TTL 5min                       | ✅     | Edge function `alt_material_signed_url`                  |
| Audit trail completo                                          | ✅     | `hub_alt_access_logs` + índices por user + opp + action  |
| Suitability enforcement em TODO endpoint (exceto `_get`)      | ✅     | Middleware na edge function                              |
| Watermark em material sensível (term sheet)                   | 🟡     | Coluna `watermark_enabled` existe; renderização em V2    |
| Email notification lead novo → gestora                        | 🟡     | Edge function stub — integrar Resend em V1               |

---

## 8. Roadmap

### V0 (22/04/2026 — ESTE PR)
- [x] Migrations 6 tabelas + RLS + storage bucket
- [x] Edge function `hub-alt-api` com 10 endpoints
- [x] Hook `useAlternativos` + types
- [x] Componentes (OpportunityCard, Filters, InterestForm, SuitabilityGate, MaterialsSection)
- [x] Pages AlternativosHub + AlternativosDetail
- [x] Rotas em `App.tsx` + sidebar entry
- [x] Docs (este arquivo + runbook)
- [ ] Build validation (tsc + vite build) — ALT-7
- [ ] Seed SQL com 3 oportunidades de amostra — ALT-7

### V1 (pós-beta — maio/junho 2026)
- Admin UI `/admin/alternativos` (tier=admin) para CRUD manual.
- Resend integration: email para gestora quando lead novo é submetido.
- Watermark dinâmico em PDFs sensíveis (nome + timestamp do AAI).
- Dashboard de funil: views → interesses → qualificados → convertidos.
- Filtros avançados: setor, geografia, faixa de ticket.

### V2 (Q3 2026)
- Self-service para parceiras submeterem oportunidades (approval flow).
- Due diligence virtual room (uploads segmentados pós-aceite NDA digital).
- Integração com contratos (e-signature via Clicksign ou DocuSign).
- Revenue share tracking + invoice admin.

---

## 9. Referências internas

- `CLAUDE.md` — contexto do ecossistema Muuney + muuney.hub
- `src/components/hub/RequireTier.tsx` — gating de tier
- `src/hooks/useAuth.tsx` — sessão + tier
- `src/lib/seo.tsx` — HubSEO helper
- `supabase/functions/hub-alt-api/index.ts` — edge function
- `supabase/migrations/20260422000000_hub_alt_module_schema.sql` — schema

---

## 10. Próximos passos imediatos

1. Rodar `npx tsc --noEmit` + `npx vite build` para garantir build limpo (ALT-7).
2. Criar seed SQL com 3 oportunidades de amostra (ALT-7).
3. Deploy edge function: `supabase functions deploy hub-alt-api`.
4. Aplicar migration via Supabase Dashboard.
5. Smoke test end-to-end com usuário Pro de teste.
6. Convidar 2 AAIs beta para validar UX antes do launch 30/04.
