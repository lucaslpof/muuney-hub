import { motion } from "framer-motion";
import {
  TrendingUp, CreditCard, PieChart, Building2, BookOpen, Database,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const modules = [
  {
    id: "macro", icon: TrendingUp, tag: "Módulo 1", title: "Panorama Macroeconômico",
    description: "Dashboard completo de indicadores macro: Selic, IPCA, câmbio, curva de juros, PIB e balança comercial. Séries históricas interativas com dados do BACEN SGS e PTAX.",
    indicators: ["Selic", "IPCA", "Câmbio (PTAX)", "Curva de Juros", "PIB", "Balança Comercial"],
    source: "BACEN SGS / PTAX", status: "Q2 2026",
  },
  {
    id: "credito", icon: CreditCard, tag: "Módulo 2", title: "Overview de Crédito",
    description: "Spreads bancários, concessões de crédito, inadimplência por segmento e condições de mercado. Acompanhe o pulso do crédito no Brasil com dados de IF.data e SGS.",
    indicators: ["Spreads bancários", "Concessões", "Inadimplência", "Condições de crédito"],
    source: "BACEN IF.data / SGS", status: "Q2 2026",
  },
  {
    id: "fundos", icon: PieChart, tag: "Módulo 3", title: "Fundos de Investimento",
    description: "Análise de fundos com performance, drawdown, Sharpe, captação líquida e rankings comparativos. Dados diretos da CVM para todos os fundos registrados no Brasil.",
    indicators: ["Performance", "Drawdown", "Sharpe Ratio", "Captação Líquida", "Rankings"],
    source: "CVM Dados Abertos", status: "Q3 2026",
  },
  {
    id: "empresas", icon: Building2, tag: "Módulo 4", title: "Screening de Empresas",
    description: "Screening de empresas listadas com P/L, ROE, EV/EBITDA, Dividend Yield e muito mais. Filtros avançados, rankings setoriais e dados CVM/B3 atualizados.",
    indicators: ["P/L", "ROE", "EV/EBITDA", "Dividend Yield", "Rankings setoriais"],
    source: "CVM / B3", status: "Q3 2026",
  },
  {
    id: "educacional", icon: BookOpen, tag: "Módulo 5", title: "Educacional",
    description: "Blog com conteúdos curados sobre mercado financeiro, economia e educação financeira. Análises de conjuntura, guias práticos e relatórios de mercado.",
    indicators: ["Análises macro", "Guias práticos", "Relatórios de mercado", "Newsletter"],
    source: "Equipe Muuney", status: "Disponível",
  },
];

export const ModulesSection = () => (
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
          {modules.map(({ id, icon: Icon, tag, title, description, indicators, source, status }) => (
            <motion.div
              key={id}
              variants={itemVariants}
              className="p-6 md:p-8 rounded-2xl bg-background border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">{tag}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{status}</span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed">{description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {indicators.map((ind) => (
                      <span key={ind} className="text-xs text-foreground/70 bg-card border border-border px-2.5 py-1 rounded-md">
                        {ind}
                      </span>
                    ))}
                  </div>
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
);
