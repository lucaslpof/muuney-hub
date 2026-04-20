# T5 — Sentry Setup Spec (Muuney.hub)

**Objetivo:** instrumentar erro tracking em produção antes do launch (30/Abr) para capturar bugs do beta + early users sem depender de feedback manual.
**Tier:** Sentry Free (Developer plan) — 5k errors/mês + 10k performance events/mês. Suficiente para D+30. Upgrade Team ($26/mês) só se >5k.
**Janela ideal de execução:** 21-23/Abr (3-4 dias antes do launch para validar source maps + alertas).

---

## 1. TL;DR (Rule of 3)

- Instalar `@sentry/react` + `@sentry/vite-plugin` → `npm install` + 2 arquivos novos + 3 envs no Vercel.
- Configurar source maps upload no build do Vercel (já temos `vite build` no pipeline).
- Tagear cada erro com `tier`, `user_id`, `hub_module`, `section` para filtrar dashboards por persona.

**ETA execução:** 90 min (60 min config + 30 min validação).

---

## 2. Passos de execução (numerados)

### Passo 1 — Criar conta + projeto Sentry (10 min)

1. Acessar https://sentry.io → Sign up (Lucas usa Google/GitHub OAuth).
2. Criar organization: **muuney** (ou **lpa-wealth** se preferir umbrella).
3. Criar projeto:
   - Platform: **React**
   - Project name: `muuney-hub`
   - Alert frequency: **On every new issue**
   - Team: padrão (#muuney)
4. Copiar **DSN** (formato: `https://xxxxxx@oXXXXXX.ingest.sentry.io/YYYYYY`).
5. Em Settings → Auth Tokens → criar token com scopes: `project:releases`, `org:read` → copiar.

### Passo 2 — Instalar dependências (5 min)

```bash
npm install --save @sentry/react
npm install --save-dev @sentry/vite-plugin
```

Verificar versões compatíveis com React 18 + Vite 5: `@sentry/react@^8.x` + `@sentry/vite-plugin@^2.x`.

### Passo 3 — Configurar envs no Vercel (5 min)

Vercel Dashboard → Project `prj_3l9W4niwBa8uBCZ7fldQVhfQcdgL` → Settings → Environment Variables:

| Variável | Scope | Valor |
|---|---|---|
| `VITE_SENTRY_DSN` | Production, Preview | DSN do passo 1 |
| `VITE_SENTRY_ENVIRONMENT` | Production | `production` |
| `VITE_SENTRY_ENVIRONMENT` | Preview | `preview` |
| `SENTRY_AUTH_TOKEN` | Production, Preview | Token do passo 1 (build-time only) |
| `SENTRY_ORG` | Production, Preview | `muuney` |
| `SENTRY_PROJECT` | Production, Preview | `muuney-hub` |

Não expor `SENTRY_AUTH_TOKEN` em runtime — só build (sem prefixo `VITE_`).

### Passo 4 — Criar `src/lib/sentry.ts` (10 min)

```ts
// src/lib/sentry.ts
import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const env = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "development";

  if (!dsn || env === "development") {
    // Local dev → no-op (evita poluir quota)
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,        // LGPD: não vazar conteúdo financeiro
        blockAllMedia: true,
      }),
    ],
    // Performance
    tracesSampleRate: env === "production" ? 1.0 : 0.5,  // 100% no launch, ajustar pós-D+7
    // Session Replay
    replaysSessionSampleRate: 0.1,                // 10% sessões normais
    replaysOnErrorSampleRate: 1.0,                // 100% sessões com erro
    // Filtros
    beforeSend(event, hint) {
      // Filtrar erros conhecidos não-acionáveis
      const ignoredMessages = [
        "ResizeObserver loop limit exceeded",
        "Non-Error promise rejection captured",
        "Network request failed",        // já tratamos via apiError.ts
      ];
      if (event.message && ignoredMessages.some(m => event.message?.includes(m))) {
        return null;
      }
      return event;
    },
    ignoreErrors: [
      // Browser extensions
      /chrome-extension:/,
      /moz-extension:/,
      // 3rd party scripts
      /Script error/,
    ],
  });
}

/**
 * Identifica usuário logado para correlacionar erros com tier/perfil.
 * Chamar quando AuthProvider detecta sessão ativa.
 */
export function setSentryUser(user: { id: string; email: string; tier: string } | null) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.id,
    email: user.email,           // OK por LGPD: já temos consentimento de cadastro
    segment: user.tier,
  });
  Sentry.setTag("tier", user.tier);
}

/**
 * Tagear contexto de navegação para filtrar erros por módulo.
 */
export function setSentryModule(module: string, section?: string) {
  Sentry.setTag("hub_module", module);
  if (section) Sentry.setTag("section", section);
}

/**
 * Capturar erro de Edge Function com contexto extra.
 */
export function captureEdgeFunctionError(
  fnName: string,
  status: number,
  body: unknown,
  extra?: Record<string, unknown>
) {
  Sentry.captureException(new Error(`EdgeFunction ${fnName} returned ${status}`), {
    tags: { edge_function: fnName, http_status: String(status) },
    extra: { body, ...extra },
  });
}
```

### Passo 5 — Wire no `src/main.tsx` (2 min)

```ts
// src/main.tsx (modify entrypoint)
import { initSentry } from "@/lib/sentry";
import { ErrorBoundary } from "@sentry/react";

initSentry();   // chama ANTES de createRoot

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] p-8">
          <div className="max-w-md text-center">
            <h1 className="mb-4 text-2xl font-bold text-emerald-500">Algo deu errado</h1>
            <p className="mb-6 text-sm text-zinc-400">
              Já fomos notificados. Tente recarregar a página ou voltar ao Hub.
            </p>
            <button
              onClick={resetError}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
```

### Passo 6 — Wire user identification no `useAuth` (5 min)

Em `src/hooks/useAuth.tsx`, dentro do useEffect que sincroniza session:

```ts
import { setSentryUser } from "@/lib/sentry";

// Dentro do onAuthStateChange listener:
useEffect(() => {
  if (user && tier) {
    setSentryUser({ id: user.id, email: user.email!, tier });
  } else {
    setSentryUser(null);
  }
}, [user, tier]);
```

### Passo 7 — Wire module tagging nos hubs (5 min por página = 30 min)

Em cada página Hub (HubMacro, HubCredito, HubRendaFixa, HubFundos, FidcHub, FiiHub, OfertasRadar, HubPortfolio), adicionar no topo do componente:

```ts
import { setSentryModule } from "@/lib/sentry";

useEffect(() => {
  setSentryModule("macro", currentSection);
}, [currentSection]);
```

### Passo 8 — Configurar Vite plugin para source maps (10 min)

`vite.config.ts`:

```ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    // ...outros plugins...
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: "./dist/**",
        ignore: ["node_modules"],
        filesToDeleteAfterUpload: "./dist/**/*.map",  // não servir maps em prod
      },
      release: {
        name: process.env.VERCEL_GIT_COMMIT_SHA,
      },
      disable: !process.env.SENTRY_AUTH_TOKEN,  // skip em local dev
    }),
  ],
  build: {
    sourcemap: true,    // Vite gera, plugin envia + deleta
  },
});
```

### Passo 9 — Configurar alertas no Sentry Dashboard (10 min)

Settings → Alerts → Create Alert Rule:

**Alert 1 — New issue (any environment):**
- When: A new issue is created
- Filter: environment is `production`
- Action: Send notification → email para `lucas.lpof@gmail.com`
- Action: Send notification → Slack (se já tem workspace, integrar via Sentry → Slack app)

**Alert 2 — High frequency (spike detection):**
- When: Number of events in an issue > 50 in 1 hour
- Filter: environment is `production`
- Action: Email + Slack

**Alert 3 — Affected users threshold:**
- When: Number of users in an issue > 5 in 24h
- Filter: environment is `production`
- Action: Email + Slack

### Passo 10 — Smoke test (15 min)

1. Local: `npm run build` → verificar console mostra "uploaded source maps" via vite-plugin (precisa de `SENTRY_AUTH_TOKEN` env local também ou skipar dev).
2. Trigger manual: criar página `/debug-sentry` com botão `<button onClick={() => { throw new Error("Sentry test " + new Date().toISOString()) }}>Test</button>` (não commitar — só validação).
3. Click → ver no Sentry Issues feed em <10 segundos.
4. Verificar:
   - Stack trace decoded (não minificado) → source maps OK
   - Tags presentes: `tier`, `hub_module`, `section`, `environment=production`
   - User context: id + email
   - Breadcrumbs: cliques + nav router visíveis
5. Trigger Edge Function error: forçar 500 (ex: chamar endpoint inexistente) → ver `captureEdgeFunctionError` capturando com tags `edge_function` + `http_status`.
6. Deletar página `/debug-sentry`.

---

## 3. Tags & Contexto recomendados

**Tags (filtráveis no dashboard, baixa cardinalidade):**

| Tag | Valores | Uso |
|---|---|---|
| `tier` | free / pro / admin | Priorizar bugs que afetam Pro pagantes |
| `hub_module` | macro / credito / renda-fixa / fundos / fidc / fii / ofertas / portfolio / dashboard | Identificar módulo com mais bugs |
| `section` | overview / rankings / lamina / etc. | Drill-down dentro do módulo |
| `edge_function` | hub-cvm-api / hub-fidc-api / etc. | Bugs de API isolados |
| `http_status` | 4xx / 5xx | Separar bugs cliente vs servidor |
| `environment` | production / preview | Filtrar bugs de prod |

**Context (rich data, não-filtrável):**

- `user.id`, `user.email`, `user.segment` (= tier)
- `extra.body` (resposta da Edge Function quando aplicável)
- `extra.params` (query params da rota se relevante)
- `extra.viewport` (auto-capturado)

**Breadcrumbs (auto):**
- Console logs (limitar level=error em produção)
- Cliques (`@sentry/react` auto-instrumenta)
- Navegação React Router (BrowserTracing integration)
- Fetch/XHR (auto)

**NÃO enviar (LGPD compliance):**
- Conteúdo de inputs financeiros (PL, valor de aporte, etc.) — `replayIntegration` configurado com `maskAllText: true`
- CPF/CNPJ se aparecer em URLs (mascarar via `beforeSend` se necessário)

---

## 4. Releases & Source Maps

**Release naming convention:** `git_commit_sha` (Vercel exporta `VERCEL_GIT_COMMIT_SHA` automaticamente).

**Workflow:**
1. Push to GitHub → Vercel build trigger
2. `vite build` gera dist/ + maps
3. `sentry-vite-plugin` faz upload dos maps + cria release no Sentry
4. Plugin deleta `.map` files antes do deploy → não expostos publicamente
5. Sentry consegue resolver stack traces minificados em prod

**Validação pós-deploy:** Sentry → Releases → ver release com SHA atual + "Source maps: 23 files".

---

## 5. Source Maps via GitHub Action (alternativa se Vercel não funcionar)

Se o Vercel não passar `SENTRY_AUTH_TOKEN` para o build (problema comum):

`.github/workflows/sentry-release.yml`:

```yaml
name: Sentry Release
on:
  push:
    branches: [main]

jobs:
  sentry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
        env:
          VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: muuney
          SENTRY_PROJECT: muuney-hub
      - uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: muuney
          SENTRY_PROJECT: muuney-hub
        with:
          environment: production
          sourcemaps: ./dist
```

Adicionar secrets em GitHub repo → Settings → Secrets → Actions.

---

## 6. Quotas & Custos

**Free tier:**
- 5,000 errors/mês
- 10,000 performance units/mês
- 50 replays/mês
- 1 GB attachments

**Estimativa beta+launch (D+0 → D+30):**
- Beta (5 testers): ~50-200 errors/mês = OK
- Launch (estimativa 200-500 users): ~500-2,000 errors/mês = OK
- Performance: 100% sample rate em launch → ajustar para 0.2 após D+7

**Quando upgrade:**
- Errors >4,000/mês consistente → Team plan ($26/mês = 50k errors)
- Quotas atingidas: Sentry para de capturar (não falha o app, mas cega o dev)

**Mitigação overspend:**
- `tracesSampleRate: 0.2` após launch validado
- `replaysSessionSampleRate: 0.05` após launch validado
- Configurar Spike Protection no Sentry Settings → Subscription

---

## 7. Integração com FeedbackWidget existente

O FeedbackWidget já captura `pathname`, `userAgent`, `viewport` e envia pra `hub_feedback` table. Adicionar Sentry context cruzado:

Em `src/components/hub/FeedbackWidget.tsx`, no submit:

```ts
import * as Sentry from "@sentry/react";

const handleSubmit = async () => {
  // ...código existente...
  await submit({ /* ... */ });

  // Cross-link com Sentry
  if (category === "bug") {
    Sentry.captureMessage(`User-reported bug: ${message}`, {
      level: "warning",
      tags: { source: "feedback_widget", category, rating: String(rating) },
      extra: { page, section, metadata },
    });
  }
};
```

Benefício: bugs reportados pelo widget aparecem no Sentry junto com a sessão Replay → reproduzir o problema sem perguntar ao usuário.

---

## 8. Checklist de validação pós-deploy

- [ ] `VITE_SENTRY_DSN` setado em Vercel Production env
- [ ] `SENTRY_AUTH_TOKEN` setado em Vercel build env (não runtime)
- [ ] `npm run build` localmente mostra upload de source maps
- [ ] Issue de teste capturado em <10s no dashboard
- [ ] Stack trace decoded (componente + linha visíveis, não bundle minificado)
- [ ] Tags `tier`, `hub_module`, `section`, `environment` presentes no issue
- [ ] User context (id + email) presente quando logado
- [ ] Breadcrumbs mostram cliques + nav router
- [ ] Edge Function 500 captura `edge_function` + `http_status` tags
- [ ] Alertas (3) configurados → email Lucas confirmado
- [ ] Release criada com nome = commit SHA
- [ ] FeedbackWidget bug reports cross-linkando com Sentry
- [ ] Página `/debug-sentry` deletada antes do launch público

---

## 9. Custos opex pós-launch (estimados)

| Item | Mensal | Anual |
|---|---|---|
| Sentry Free (D+0 → D+30 esperado) | R$ 0 | R$ 0 |
| Sentry Team (se >5k errors) | ~R$ 130 | ~R$ 1,560 |
| GitHub Actions minutes (Sentry release) | R$ 0 (free tier) | R$ 0 |

**Decisão:** começar Free, monitorar quota semanal D+0 → D+30. Upgrade só se justificar.

---

## 10. Perguntas pendentes pro Lucas

1. **Você tem Slack workspace ativo (Muuney/LPA)?** Se sim, integrar Sentry → Slack #alerts evita depender só de email. Se não, OK rodar só com email.
2. **OK exportar email do usuário pro Sentry (pseudonimizado por id Supabase)?** Tecnicamente é OK (consent já dado no cadastro), mas se quiser ser ultra-conservador LGPD, posso configurar para enviar só `user.id` UUID e nada mais.
3. **Quer trazer também o Sentry pro app mobile (LPA portal)?** Mesmo plano cobre múltiplos projetos. Se sim, criar projeto `muuney-app` separado mesmo workflow.
4. **Quer instrumentar Edge Functions com Sentry server-side também?** Deno tem `@sentry/deno` (beta) mas pouco maduro. Alternativa atual: já temos `hub_cvm_ingestion_log` + `console.error` no Supabase logs. Recomendação: adiar até pós-D+30.
