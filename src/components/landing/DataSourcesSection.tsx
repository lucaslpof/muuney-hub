import { motion } from "framer-motion";
import { Landmark, LineChart, CheckCircle2 } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const DataSourcesSection = () => (
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
);
