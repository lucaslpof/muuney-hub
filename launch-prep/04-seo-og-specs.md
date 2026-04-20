# T4 — SEO + OG Meta Tags Specs (Muuney.hub)

**Stack:** `react-helmet-async` (já em uso em blog posts).
**Escopo:** 12 rotas do hub, + 3 rotas dinâmicas (lâminas).
**Diretrizes:**
- Title: 50-60 chars (Google trunca em ~60)
- Description: 150-160 chars (para snippet)
- OG image: 1200×630 px, Tech-Noir dark, sempre terminar com logo Muuney
- Canonical: `https://muuney.app<path>`
- Lang: `pt-BR`
- Prefixo de title consistente: `... · Muuney.hub`

---

## 1. Helper a criar: `<HubSEO />`

Componente único reutilizável em todas as páginas hub. Evita repetição + padroniza prefix.

```tsx
// src/components/hub/HubSEO.tsx
import { Helmet } from "react-helmet-async";

interface HubSEOProps {
  title: string;           // sem sufixo
  description: string;
  path: string;            // e.g. "/hub/macro"
  ogImage?: string;        // path absoluto ou relativo a /public
  noindex?: boolean;       // true pra páginas privadas (portfolio, upgrade)
  schema?: object;         // JSON-LD opcional
}

const SITE = "https://muuney.app";
const DEFAULT_OG = "/og/hub-default.png";

export function HubSEO({ title, description, path, ogImage, noindex, schema }: HubSEOProps) {
  const fullTitle = `${title} · Muuney.hub`;
  const url = `${SITE}${path}`;
  const image = `${SITE}${ogImage ?? DEFAULT_OG}`;

  return (
    <Helmet>
      <html lang="pt-BR" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,follow" />}
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Muuney" />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {/* JSON-LD */}
      {schema && <script type="application/ld+json">{JSON.stringify(schema)}</script>}
    </Helmet>
  );
}
```

---

## 2. Specs por rota

### `/hub/macro`

| Campo | Conteúdo |
|---|---|
| title | Inteligência Macroeconômica — BACEN, Focus, COPOM em tempo real |
| description | 73 séries BACEN SGS (PIB, IPCA, Selic, câmbio, fiscal, trabalho) + Focus Expectativas + COPOM/FOMC overlay. Regime detection e cross-signals automáticos para AAIs. |
| og:image | `/og/hub-macro.png` |
| schema | SoftwareApplication |

**og:image brief:** fundo #0a0a0a, chart Selic estilizado com linha verde #0B6C3E + marcadores COPOM. Título "Macro" + subtítulo "73 séries BACEN". Logo Muuney canto inferior direito.

---

### `/hub/credito`

| Campo | Conteúdo |
|---|---|
| title | Painel de Crédito — Saldos, Taxas, Inadimplência e Spreads |
| description | Acompanhe 73 séries de crédito BACEN: saldos PF/PJ, concessões, taxas por modalidade, inadimplência 15-90d, spreads, alavancagem. Com heatmaps e calculadora de juros. |
| og:image | `/og/hub-credito.png` |

**og:image brief:** heatmap 4×5 com gradiente verde→vermelho, representando modalidades × inadimplência. Título "Crédito" centralizado.

---

### `/hub/renda-fixa`

| Campo | Conteúdo |
|---|---|
| title | Renda Fixa — Curva DI, NTN-B, Tesouro Direto e Spreads Corporativos |
| description | 30 indicadores de renda fixa: curva DI 9 vértices, NTN-B term structure, breakeven de inflação, Tesouro Direto, spreads AA/A. Com calculadora de bond e simulador de curva. |
| og:image | `/og/hub-renda-fixa.png` |

**og:image brief:** curva DI renderizada em linha (shape normal), com 9 pontos em ciano elétrico sobre grid. Título "Renda Fixa".

---

### `/fundos`

| Campo | Conteúdo |
|---|---|
| title | Fundos de Investimento — 29.491 classes RCVM 175 com Fund Score™ |
| description | Screener multi-filtro, rankings por gestora/administradora, comparador cross-class até 6 fundos, insights automáticos. Catálogo completo CVM (RF, Multi, Ações, FIDC, FII, FIP, ETF). |
| og:image | `/og/hub-fundos.png` |
| schema | SearchAction (sitelinks searchbox) |

**og:image brief:** grid de 6 fund cards com ClasseBadges coloridos (azul RF, verde Ações, roxo Multi, rosa FII, laranja FIDC, ciano FIP). Título "Fundos" + "29.491 classes monitoradas".

---

### `/fundos/:slug` (DINÂMICO — FundLamina)

**Dados do fund via hook:**
- `denom_social` → nome
- `classe_rcvm175` → classe
- `vl_patrim_liq` → PL
- `fundScore` → score

```tsx
<HubSEO
  title={`${fund.denom_social} — ${fund.classe_rcvm175}`}
  description={`Lâmina completa do fundo ${fund.denom_social}. Classe ${fund.classe_rcvm175}. Patrimônio ${formatMoney(fund.vl_patrim_liq)}. Fund Score™ ${fund.score}/100. Métricas de risco, composição CDA e fundos similares.`}
  path={`/fundos/${fund.slug}`}
  ogImage={`/og/fund-dynamic.png?slug=${fund.slug}`} // Gerar server-side via Edge Function ou fallback estático
  schema={{
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "name": fund.denom_social,
    "description": `Fundo ${fund.classe_rcvm175} brasileiro com CNPJ ${fund.cnpj_fundo_classe}`,
    "provider": { "@type": "Organization", "name": fund.gestor_nome || "—" }
  }}
/>
```

**og:image brief estático (fallback):** card genérico "Lâmina de Fundo · Muuney.hub" + ClasseBadge placeholder.
**og:image dinâmico (future):** Edge Function `og-fund-image` que gera PNG server-side com nome do fundo + classe + score. Pode deferir pra pós-launch.

---

### `/fundos/fidc`

| Campo | Conteúdo |
|---|---|
| title | FIDCs — Painel Completo de Fundos de Direitos Creditórios |
| description | 4.319 FIDCs com subordinação, inadimplência, rentabilidade senior/mezanino, capital stack. Rankings, screener por lastro, lâminas individuais. Exclusivo Pro. |
| og:image | `/og/hub-fidc.png` |

**og:image brief:** stacked bar horizontal representando estrutura de capital (senior + mezanino + subordinada) em tons de laranja. Título "FIDC · 4.319 fundos monitorados".

---

### `/fundos/fidc/:slug` (DINÂMICO — FidcLamina)

Mesma estratégia da FundLamina, com dados FIDC-specific (subordinação, inadimplência, PL senior vs mezanino vs subord).

```tsx
<HubSEO
  title={`${fidc.denom_social} · FIDC`}
  description={`FIDC ${fidc.denom_social}. Lastro ${fidc.tp_lastro_principal}. PL ${formatMoney(fidc.vl_pl_total)}. Subordinação ${fidc.indice_subordinacao}%. Inadimplência ${fidc.taxa_inadimplencia}%.`}
  path={`/fundos/fidc/${fidc.slug}`}
  ogImage="/og/fidc-default.png"
  noindex={true} // lâminas individuais — indexar só lista
/>
```

**Decisão:** lâminas individuais com `noindex` até ter OG image dinâmico e volume justificando SEO long-tail.

---

### `/fundos/fii`

| Campo | Conteúdo |
|---|---|
| title | FIIs — 1.253 Fundos Imobiliários com DY e Rentabilidade |
| description | Acompanhe todos os FIIs brasileiros: dividend yield mensal, rentabilidade efetiva, PL, cotistas, segmento, mandato. Rankings e screener por segmento. Exclusivo Pro. |
| og:image | `/og/hub-fii.png` |

---

### `/fundos/fii/:slug` (DINÂMICO — FiiLamina)

Analog FidcLamina — `noindex` por enquanto.

---

### `/ofertas`

| Campo | Conteúdo |
|---|---|
| title | Radar de Ofertas Públicas — RCVM 160 em Tempo Real |
| description | 12.681 ofertas RCVM 160 + 18.968 ICVM 400 + 3 ICVM 476. Timeline, pipeline, explorer multi-filtro. Debêntures, CRI, CRA, FIDC, FII, ações. Exclusivo Pro. |
| og:image | `/og/hub-ofertas.png` |

**og:image brief:** timeline barchart com 12 meses de volume de ofertas, em emerald/amber. Título "Ofertas Públicas".

---

### `/portfolio`

| Campo | Conteúdo |
|---|---|
| title | Portfolio Tracker — Composição, Drift e Performance |
| description | Monte carteiras teóricas com holdings RCVM 175. Acompanhe drift vs targets, composição, performance indexada base-100. |
| noindex | **true** (área privada) |

---

### `/upgrade`

| Campo | Conteúdo |
|---|---|
| title | Upgrade para Pro — Todos os Módulos por R$ 49/mês |
| description | Acesse FIDCs, FIIs, Ofertas Públicas, insights automáticos e comparador completo. R$ 49/mês ou R$ 490/ano. Cancele quando quiser. |
| og:image | `/og/hub-upgrade.png` |

**og:image brief:** 2 pricing cards side-by-side (Free cinza + Pro verde #0B6C3E com highlight "Recomendado"). Título "Muuney Pro".

---

### `/login`, `/forgot-password`, `/reset-password`, `/primeiro-acesso`

- `noindex: true` em todas
- title simples: `Entrar · Muuney.hub`, `Recuperar senha · Muuney.hub`, etc.
- sem og:image específico (usa default)

---

### `/` (landing pública muuney.com.br — caso o hub tenha landing dedicada)

**Decisão estratégica:** o hub hoje vive sob `muuney.app`. A landing B2C é em `muuney.com.br`. Recomendação:
- Criar `muuney.com.br/hub` como landing dedicada ao produto (pra press, indexação orgânica, comms do launch).
- Redirecionar `muuney.app` raiz pra tela de login (ou dashboard se autenticado).
- Se concordar, spec dessa landing vai no arquivo `08-launch-comms-hub-v1.md`.

---

## 3. OG Images — 12 briefs de design

**Brand:** Tech-Noir. Paleta: `#0a0a0a` (bg), `#0B6C3E` (green accent), `#00D4FF` (cyan acento), `#E0E0E0` (text primary), `#A0A0A0` (text secondary), `#22C55E` (success), `#EF4444` (danger).
**Fontes:** Inter ou Geist (sans-serif moderna). Mono pra CNPJ/dados: JetBrains Mono.
**Dimensão:** 1200×630 (2:1 aspect ratio).
**Elementos persistentes:** logo Muuney inferior direito, favicon superior esquerdo, microcopy `muuney.app` discreto.

| # | Rota | Elemento central | Paleta primária | Tom |
|---|---|---|---|---|
| 1 | Default hub | Grid de KPIs estilizados + tagline | #0B6C3E | Institucional |
| 2 | /hub/macro | Chart Selic + markers COPOM | #0B6C3E + vermelho/verde | Analítico |
| 3 | /hub/credito | Heatmap 4×5 modalidades | Gradiente rosso→verde | Denso |
| 4 | /hub/renda-fixa | Curva DI + pontos de vértices | Ciano #00D4FF | Técnico |
| 5 | /fundos | Grid 6 ClasseBadges + número "29.491" | Multi cores | Vibrante |
| 6 | /fundos/fidc | Stacked bar capital structure | Laranja + pretos | Focado |
| 7 | /fundos/fii | Mapa setorial (Logística, Escritórios, etc.) | Rosa/magenta #EC4899 | Setorial |
| 8 | /ofertas | Timeline BarChart mensal | Emerald + amber | Movimento |
| 9 | /upgrade | 2 cards pricing | Verde + cinza | Conversão |
| 10 | Fund Score | Bar horizontal 4 pilares | Verde degradé | Método |
| 11 | Blog post generic | Placeholder artigo + autor | #0B6C3E | Editorial |
| 12 | /launch (novo) | "30/04 · Em operação" + countdown | Neon verde | Hype |

**Produção:** 
- Designer (freelancer, ~R$ 800 pelo pack de 12) OU
- Figma template reusável (Lucas monta em 2-3h) OU
- Canvas HTML em React com puppeteer screenshot (dev pesado, pro launch do launch) OU
- Ferramenta como `og-image.vercel.app` ou `placid.app` (rapidíssimo, pago)

**Recomendação:** Figma template reusável (custo zero, controle total, reuso em novos módulos). Tempo: ~4h pra Lucas montar 12.

---

## 4. Validação pré-launch

### Ferramentas
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) → colar cada URL, validar og preview
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) → idem
- [Twitter Card Validator](https://cards-dev.twitter.com/validator) → idem
- [Schema.org Validator](https://validator.schema.org/) → JSON-LD das páginas com schema

### Checklist
- [ ] 12 OG images renderizam corretamente (sem deformação / texto cortado)
- [ ] Titles aparecem completos (não truncados) em SERP simulation
- [ ] Descriptions têm CTR hooks (verbos ativos, números concretos)
- [ ] Lâminas dinâmicas carregam dados antes do crawler capturar (SSR? pre-render? use `react-helmet-async` + delay?)
- [ ] Sitemap.xml atualizado com 12+ URLs do hub (hoje só 27 URLs incluem só blog + landing)

---

## 5. Sitemap.xml — atualização necessária

Adicionar ao `public/sitemap.xml`:

```xml
<url><loc>https://muuney.app/hub/macro</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://muuney.app/hub/credito</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://muuney.app/hub/renda-fixa</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
<url><loc>https://muuney.app/fundos</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
<url><loc>https://muuney.app/fundos/fidc</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
<url><loc>https://muuney.app/fundos/fii</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
<url><loc>https://muuney.app/ofertas</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
<url><loc>https://muuney.app/upgrade</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
```

**NÃO incluir lâminas individuais no sitemap inicialmente** — 29.491 URLs novas confundem o crawler. Adicionar gradualmente após 30 dias de tráfego orgânico nas rotas principais.

**Submeter via IndexNow** (Edge Function `submit-indexnow` já existe) logo após deploy do launch.

---

## 6. Regulatório CVM — disclaimers obrigatórios

**Importante:** Lucas é CGA/CGE + OAB. O hub entrega informação financeira pública, NÃO recomendação de investimento. Dentro das regras da Resolução CVM 19/2021 (análise de valores mobiliários), precisa de disclaimer claro em:

- [ ] Footer de toda página `/fundos/*`: "As informações exibidas são compiladas de bases públicas CVM e BACEN. Não constituem recomendação de investimento. Consulte seu assessor."
- [ ] Lâmina de fundo: badge ou bloco maior explicando "Dados informativos. Rentabilidade passada não garante rentabilidade futura."
- [ ] `/ofertas`: disclaimer sobre oferta pública "Análise indicativa, consulte documentação oficial CVM antes de investir."
- [ ] `/hub/credito`, `/hub/renda-fixa`: igual (informativo, não consultoria).

**Ação:** criar `<CVMDisclaimer />` component genérico + variant específico por módulo.

---

## 7. Perguntas pendentes pro Lucas

1. **Lâminas dinâmicas vão ser SSR ou CSR?** `react-helmet-async` no Vite SPA default só popula no client. Crawlers modernos (Google) executam JS mas LinkedIn/Twitter não. Se SSR for preciso, migração não-trivial — deferir pro pós-launch? (Recomendação: por enquanto `noindex` nas lâminas individuais e foco nas 10 rotas estáticas).
2. **Quer produzir as 12 OG images agora (Figma) ou usar placeholder padrão no launch e iterar?** Placeholder padrão é aceitável se o launch prioriza 2 canais principais (LinkedIn + email).
3. **Disclaimer CVM tem texto canônico que você (como advogado) quer padronizar?** Se sim, me envia que eu aplico.
4. **Landing dedicada em `muuney.com.br/hub` vs `muuney.app/` como entrada pública?** (ver próxima seção 07 launch plan).
