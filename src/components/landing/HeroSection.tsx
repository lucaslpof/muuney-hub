import { motion } from "framer-motion";
import { Database, ArrowRight, Landmark, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const HeroSection = () => (
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
);
