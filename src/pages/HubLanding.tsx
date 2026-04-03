/**
 * HubLanding — Landing page do Muuney Hub
 * Plataforma de inteligência de dados e estatísticas do mercado financeiro
 * Fontes primárias oficiais: BACEN (SGS/PTAX) e CVM (Dados Abertos)
 * 5 Módulos: Panorama Macro, Overview Crédito, Fundos, Empresas, Educacional
 * Público: Dual B2B (assessores, gestoras) + B2C (investidores)
 * URL: hub.muuney.com.br → /hub
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { getMainSiteUrl } from "@/lib/domain";
import {
  TrendingUp,
  CreditCard,
  PieChart,
  Building2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Shield,
  Database,
  BarChart3,
  Globe,
  Zap,
  Eye,
  Lock,
  LineChart,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MuuneySymbol } from "@/components/brand/MuuneySymbol";
import { MuuneyHubLogo } from "@/components/brand/MuuneyHubLogo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

/* ------------------------------------------------------------------ */
/*  Hub Navbar                                                         */
/* ------------------------------------------------------------------ */
const HubNavbar = () => {
  const hubHome = "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={hubHome} className="flex items-center gap-2">
            <MuuneySymbol variant="green" size={32} />
            <MuuneyHubLogo variant="green" height={26} />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#modulos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Módulos</a>
            <a href="#fontes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fontes de Dados</a>
            <a href="#para-quem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para Quem</a>
            <Button
              size="sm"
              className="bg-gradient-primary hover:shadow-glow transition-all"
              onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
            >
              Acesso antecipado
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/*  Early Access Form                                                  */
/* ------------------------------------------------------------------ */
const EarlyAccessForm = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("hub_leads" as any).insert({
        name: form.name,
        email: form.email,
        company: form.company || null,
        role: form.role || null,
        source: "hub-landing",
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Solicitação recebida!", description: "Entraremos em contato em breve." });
    } catch {
      await supabase.from("newsletter_subscribers").insert({
        email: form.email,
        name: form.name,
        source: "hub-early-access",
      });
      setSubmitted(true);
      toast({ title: "Solicitação recebida!", description: "Entraremos em contato em breve." });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Você está na lista!</h3>
        <p className="text-muted-foreground">Entraremos em contato com os próximos passos.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
      <input
        type="text"
        placeholder="Seu nome"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="email"
        placeholder="Seu email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="text"
        placeholder="Empresa / Escritório (opcional)"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <select
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <option value="">Perfil</option>
        <option value="assessor">Assessor de Investimentos</option>
        <option value="consultor">Consultor CVM</option>
        <option value="gestor">Gestor de Patrimônio</option>
        <option value="investidor">Investidor Individual</option>
        <option value="analista">Analista / Research</option>
        <option value="outro">Outro</option>
      </select>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-primary hover:shadow-glow transition-all py-6 text-base font-semibold"
        >
          {loading ? "Enviando..." : "Solicitar acesso antecipado"}
          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground text-center">
        Early access gratuito. Sem compromisso.
      </p>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/*  5 Modules data                                                     */
/* ------------------------------------------------------------------ */
const modules = [
  {
    id: "macro",
    icon: TrendingUp,
    tag: "Módulo 1",
    title: "Panorama Macroeconômico",
    description:
      "Dashboard completo de indicadores macro: Selic, IPCA, câmbio, curva de juros, PIB e balança comercial. Séries históricas interativas com dados do BACEN SGS e PTAX.",
    indicators: ["Selic", "IPCA", "Câmbio (PTAX)", "Curva de Juros", "PIB", "Balança Comercial"],
    source: "BACEN SGS / PTAX",
    status: "Q2 2026",
  },
  {
    id: "credito",
    icon: CreditCard,
    tag: "Módulo 2",
    title: "Overview de Crédito",
    description:
      "Spreads bancários, concessões de crédito, inadimplência por segmento e condições de mercado. Acompanhe o pulso do crédito no Brasil com dados de IF.data e SGS.",
    indicators: ["Spreads bancários", "Concessões", "Inadimplência", "Condições de crédito"],
    source: "BACEN IF.data / SGS",
    status: "Q2 2026",
  },
  {
    id: "fundos",
    icon: PieChart,
    tag: "Módulo 3",
    title: "Fundos de Investimento",
    description:
      "Análise de fundos com performance, drawdown, Sharpe, captação líquida e rankings comparativos. Dados diretos da CVM para todos os fundos registrados no Brasil.",
    indicators: ["Performance", "Drawdown", "Sharpe Ratio", "Captação Líquida", "Rankings"],
    source: "CVM Dados Abertos",
    status: "Q3 2026",
  },
  {
    id: "empresas",
    icon: Building2,
    tag: "Módulo 4",
    title: "Screening de Empresas",
    description:
      "Screening de empresas listadas com P/L, ROE, EV/EBITDA, Dividend Yield e muito mais. Filtros avançados, rankings setoriais e dados CVM/B3 atualizados.",
    indicators: ["P/L", "ROE", "EV/EBITDA", "Dividend Yield", "Rankings setoriais"],
    source: "CVM / B3",
    status: "Q3 2026",
  },
  {
    id: "educacional",
    icon: BookOpen,
    tag: "Módulo 5",
    title: "Educacional",
    description:
      "Blog com conteúdos curados sobre mercado financeiro, economia e educação financeira. Análises de conjuntura, guias práticos e relatórios de mercado.",
    indicators: ["Análises macro", "Guias práticos", "Relatórios de mercado", "Newsletter"],
    source: "Equipe Muuney",
    status: "Disponível",
  },
];

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
const HubLanding = () => {
  return (
    <>
      <Helmet>
        <title>Muuney Hub — Inteligência de Dados do Mercado Financeiro Brasileiro</title>
        <meta
          name="description"
          content="Dados e estatísticas do mercado financeiro brasileiro de fontes primárias oficiais (BACEN e CVM). Panorama Macro, Crédito, Fundos, Empresas e Educacional em uma única plataforma."
        />
        <meta name="keywords" content="dados mercado financeiro, BACEN SGS, CVM dados abertos, indicadores macroeconômicos Brasil, fundos de investimento análise, screening empresas B3, spreads bancários, inteligência financeira, fintech dados" />
        <meta property="og:title" content="Muuney Hub — Inteligência de Dados do Mercado Financeiro" />
        <meta property="og:description" content="Dados de fontes primárias oficiais (BACEN e CVM) organizados, analisados e acessíveis. 5 módulos: Macro, Crédito, Fundos, Empresas e Educacional." />
        <meta property="og:url" content="https://hub.muuney.com.br" />
        <meta property="og:image" content="https://muuney.com.br/og-image-hub.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://muuney.com.br/og-image-hub.png" />
        <link rel="canonical" href="https://hub.muuney.com.br" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Muuney Hub",
          "url": "https://hub.muuney.com.br",
          "description": "Plataforma de inteligência de dados do mercado financeiro brasileiro com dados de fontes primárias oficiais (BACEN e CVM).",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "BRL",
            "description": "Acesso antecipado gratuito"
          },
          "creator": {
            "@type": "Organization",
            "name": "Muuney Tecnologia Ltda.",
            "url": "https://muuney.com.br",
            "logo": "https://muuney.com.br/icon-512x512.png"
          },
          "featureList": [
            "Panorama Macroeconômico (Selic, IPCA, câmbio, PIB)",
            "Overview de Crédito (spreads, inadimplência, concessões)",
            "Fundos de Investimento (CVM Dados Abertos)",
            "Screening de Empresas (B3/CVM)",
            "Conteúdo Educacional"
          ],
          "sourceOrganization": [
            {"@type": "GovernmentOrganization", "name": "Banco Central do Brasil", "url": "https://www.bcb.gov.br"},
            {"@type": "GovernmentOrganization", "name": "Comissão de Valores Mobiliários", "url": "https://www.gov.br/cvm"}
          ]
        })}</script>
      </Helmet>

      <HubNavbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="mb-6">
              <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium border border-primary/20">
                <Database className="w-4 h-4" />
                Dados de fontes primárias oficiais
              </span>
            </motion.div>

            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6 font-display"
              variants={itemVariants}
            >
              Inteligência de dados do{" "}
              <span className="text-secondary">mercado financeiro brasileiro.</span>
            </motion.h1>

            <motion.p
              className="text-lg sm:text-xl text-muted-foreground mb-10 leading-relaxed max-w-2xl mx-auto"
              variants={itemVariants}
            >
              Dados e estatísticas do <strong className="text-foreground">BACEN</strong> e da{" "}
              <strong className="text-foreground">CVM</strong>, organizados, analisados e acessíveis em uma única plataforma.
              Macro, crédito, fundos, empresas e conteúdo educacional — sem filtro de intermediários.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-primary hover:shadow-glow transition-all text-base font-semibold px-8"
                onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
              >
                Acesso antecipado gratuito
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 text-base font-semibold hover:bg-accent/5"
                onClick={() => document.getElementById("modulos")?.scrollIntoView({ behavior: "smooth" })}
              >
                Explorar módulos
              </Button>
            </motion.div>

            {/* Source badges */}
            <motion.div variants={itemVariants} className="flex items-center justify-center gap-6 mt-10">
              {[
                { icon: Landmark, label: "Banco Central do Brasil" },
                { icon: LineChart, label: "CVM — Dados Abertos" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="w-4 h-4 text-primary/60" />
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Value Proposition ────────────────────────────────────── */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                Dados de mercado sem intermediários.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Acesse indicadores financeiros diretamente das fontes primárias oficiais do Brasil — organizados e prontos para análise.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6">
              {[
                { number: "5", label: "Módulos analíticos", sub: "Macro, Crédito, Fundos, Empresas, Educacional" },
                { number: "2", label: "Fontes primárias oficiais", sub: "BACEN (SGS, PTAX, IF.data) e CVM (Dados Abertos)" },
                { number: "100%", label: "Dados públicos oficiais", sub: "Sem curadoria de terceiros, sem viés editorial" },
              ].map(({ number, label, sub }) => (
                <div key={label} className="text-center p-6 rounded-xl bg-card border border-border">
                  <span className="text-4xl font-bold text-primary font-display">{number}</span>
                  <p className="text-foreground font-semibold mt-2">{label}</p>
                  <p className="text-sm text-muted-foreground mt-1">{sub}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── 5 Modules ────────────────────────────────────────────── */}
      <section id="modulos" className="py-20 bg-card/50 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                5 módulos. Uma plataforma.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Do cenário macroeconômico ao screening de empresas — tudo com dados de fontes primárias, atualizados e com visualizações interativas.
              </p>
            </motion.div>

            <div className="space-y-6 max-w-5xl mx-auto">
              {modules.map(({ id, icon: Icon, tag, title, description, indicators, source, status }, i) => (
                <motion.div
                  key={id}
                  variants={itemVariants}
                  className="p-6 md:p-8 rounded-2xl bg-background border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Icon + tag */}
                    <div className="flex-shrink-0">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Icon className="w-7 h-7 text-primary" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{tag}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{status}</span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                      <p className="text-muted-foreground mb-4 leading-relaxed">{description}</p>

                      {/* Indicators */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {indicators.map((ind) => (
                          <span key={ind} className="text-xs text-foreground/70 bg-card border border-border px-2.5 py-1 rounded-md">
                            {ind}
                          </span>
                        ))}
                      </div>

                      {/* Source */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Database className="w-3.5 h-3.5" />
                        <span>Fonte: {source}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Data Sources ─────────────────────────────────────────── */}
      <section id="fontes" className="py-20 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                Fontes primárias. Dados oficiais.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Nada de dados de segunda mão. O Hub consome diretamente das APIs oficiais do Banco Central e da CVM.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
              {/* BACEN */}
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Landmark className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Banco Central do Brasil</h3>
                    <p className="text-xs text-muted-foreground">BACEN — Autarquia federal</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { api: "SGS", desc: "Sistema Gerenciador de Séries Temporais — Selic, IPCA, PIB, câmbio" },
                    { api: "PTAX", desc: "Cotações de câmbio — taxas de compra e venda do dólar" },
                    { api: "IF.data", desc: "Dados de instituições financeiras — spreads, concessões, inadimplência" },
                  ].map(({ api, desc }) => (
                    <div key={api} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{api}:</strong> {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CVM */}
              <div className="p-6 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <LineChart className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Comissão de Valores Mobiliários</h3>
                    <p className="text-xs text-muted-foreground">CVM — Regulador do mercado de capitais</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { api: "Dados Abertos", desc: "Fundos de investimento — patrimônio, captação, performance, composição" },
                    { api: "Empresas", desc: "Dados de companhias listadas — balanços, resultados, indicadores" },
                    { api: "Registros", desc: "Profissionais e empresas registradas — assessores, consultores, gestoras" },
                  ].map(({ api, desc }) => (
                    <div key={api} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">
                        <strong className="text-foreground">{api}:</strong> {desc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── For Who ──────────────────────────────────────────────── */}
      <section id="para-quem" className="py-20 bg-card/50 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                Para quem é o Hub.
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                De investidores individuais a gestoras — inteligência financeira democratizada.
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
              {/* B2C */}
              <div className="p-6 rounded-xl bg-background border border-border">
                <span className="text-xs font-semibold text-emerald-400 bg-emerald-900/30 px-2.5 py-1 rounded-full">Investidores</span>
                <h3 className="text-lg font-semibold text-foreground mt-4 mb-3">Para quem investe</h3>
                <div className="space-y-2.5">
                  {[
                    "Acompanhe indicadores macro sem depender de newsletters",
                    "Analise fundos de investimento com dados oficiais da CVM",
                    "Compare empresas listadas com screening avançado",
                    "Acesso freemium — dados básicos gratuitos, premium para análises avançadas",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* B2B */}
              <div className="p-6 rounded-xl bg-background border border-primary/20">
                <span className="text-xs font-semibold text-blue-400 bg-blue-900/30 px-2.5 py-1 rounded-full">Profissionais</span>
                <h3 className="text-lg font-semibold text-foreground mt-4 mb-3">Para quem trabalha com mercado</h3>
                <div className="space-y-2.5">
                  {[
                    "Assessores e consultores: dados para embasar recomendações",
                    "Gestoras: screening e monitoramento com dados primários",
                    "Research: séries históricas e indicadores prontos para análise",
                    "SaaS por licença — API disponível para integração com seus sistemas",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Differentials ────────────────────────────────────────── */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-4xl mx-auto"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                Por que o Muuney Hub.
              </h2>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Database, title: "Fontes primárias", desc: "Dados diretos do BACEN e CVM — sem intermediários" },
                { icon: Zap, title: "Atualização contínua", desc: "Pipeline automatizado de ingestão e normalização" },
                { icon: Eye, title: "Visualizações interativas", desc: "Gráficos, séries históricas e dashboards responsivos" },
                { icon: Lock, title: "API documentada", desc: "Integre dados do Hub ao seu sistema via REST API" },
              ].map(({ icon: Icon, title, desc }) => (
                <motion.div
                  key={title}
                  variants={itemVariants}
                  className="text-center p-5 rounded-xl bg-card border border-border"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Early Access CTA ─────────────────────────────────────── */}
      <section id="early-access" className="py-20 bg-card/50 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="max-w-2xl mx-auto text-center"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={containerVariants}
          >
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium border border-primary/20 mb-6">
                Early Access
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 font-display">
                Acesse antes de todo mundo.
              </h2>
              <p className="text-lg text-muted-foreground mb-10">
                O Módulo 1 (Panorama Macroeconômico) está em desenvolvimento.
                Cadastre-se para testar em primeira mão e influenciar o roadmap do produto.
              </p>
            </motion.div>

            <motion.div variants={itemVariants}>
              <EarlyAccessForm />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Disclaimer CVM ───────────────────────────────────────── */}
      <section className="py-6 border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs text-muted-foreground/60 text-center max-w-3xl mx-auto leading-relaxed">
            <strong>Aviso legal:</strong> O Muuney Hub é uma plataforma de informações e dados de mercado, não constituindo recomendação de investimento,
            consultoria financeira ou oferta de valores mobiliários. Os dados apresentados são obtidos de fontes públicas oficiais (BACEN e CVM) e
            reproduzidos sem edição ou opinião. Decisões de investimento devem ser tomadas com base em análise própria ou com auxílio de profissional
            habilitado junto à CVM. Rentabilidade passada não é garantia de resultados futuros.
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="bg-primary text-primary-foreground py-10 border-t border-primary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <MuuneySymbol variant="white" size={24} />
              <MuuneyHubLogo variant="white" height={22} />
            </div>
            <div className="flex items-center gap-6 text-sm text-primary-foreground/70">
              <a href={getMainSiteUrl("/")} className="hover:text-primary-foreground transition-colors">
                Muuney App
              </a>
              <a href={getMainSiteUrl("/blog")} className="hover:text-primary-foreground transition-colors">
                Blog
              </a>
              <Link to="/politica-de-privacidade" className="hover:text-primary-foreground transition-colors">
                Privacidade
              </Link>
              <Link to="/termos-de-uso" className="hover:text-primary-foreground transition-colors">
                Termos
              </Link>
              <a href={getMainSiteUrl("/contato")} className="hover:text-primary-foreground transition-colors">
                Contato
              </a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/50">
            © 2026 Muuney Tecnologia Ltda. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </>
  );
};

export default HubLanding;
