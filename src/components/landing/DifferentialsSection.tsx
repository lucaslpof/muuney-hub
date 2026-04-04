import { motion } from "framer-motion";
import { Database, Zap, Eye, Lock } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const DifferentialsSection = () => (
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
);
