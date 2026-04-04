import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const ForWhoSection = () => (
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
);
