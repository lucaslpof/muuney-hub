/**
 * HubLanding — Landing page do Muuney Hub
 * Decomposed into section components for maintainability.
 * Original: 731 LOC → Now: ~80 LOC (composition only)
 */

import { motion } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { HubNavbar } from "@/components/landing/HubNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { ModulesSection } from "@/components/landing/ModulesSection";
import { DataSourcesSection } from "@/components/landing/DataSourcesSection";
import { ForWhoSection } from "@/components/landing/ForWhoSection";
import { DifferentialsSection } from "@/components/landing/DifferentialsSection";
import { EarlyAccessForm } from "@/components/landing/EarlyAccessForm";
import { HubFooter } from "@/components/landing/HubFooter";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

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
      <HeroSection />

      {/* ── Value Proposition ── */}
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

      <ModulesSection />
      <DataSourcesSection />
      <ForWhoSection />
      <DifferentialsSection />

      {/* ── Early Access CTA ── */}
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

      <HubFooter />
    </>
  );
};

export default HubLanding;
