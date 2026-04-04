import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Info } from "lucide-react";

interface KPIData {
  serie_code: string;
  category: string;
  display_name: string;
  last_value: number;
  change_pct: number;
  trend: "up" | "down" | "stable";
  unit: string;
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  metric: string;
  value: string;
}

interface AlertCardProps {
  kpis: KPIData[];
  module?: "macro" | "credito";
}

/* ─── Rule engine: evaluates KPI data against thresholds ─── */
function evaluateCreditAlerts(kpis: KPIData[]): Alert[] {
  const alerts: Alert[] = [];

  const inadTotal = kpis.find((k) => k.serie_code === "inadimplencia_total");
  const inadPF = kpis.find((k) => k.serie_code === "inadimplencia_pf");
  const spreadPF = kpis.find((k) => k.serie_code === "spread_pf");
  // spreadPJ reserved for future alert rules
  void kpis.find((k) => k.serie_code === "spread_pj");
  const taxaPF = kpis.find((k) => k.serie_code === "taxa_pf");
  const creditoPIB = kpis.find((k) => k.serie_code === "credito_pib");

  /* Rule 1: Inadimplência PF alta */
  if (inadPF && inadPF.last_value > 4.0) {
    alerts.push({
      id: "inad_pf_high",
      severity: inadPF.last_value > 5.0 ? "critical" : "warning",
      title: "Inadimplência PF elevada",
      message: `Taxa de inadimplência PF em ${inadPF.last_value.toFixed(2)}%, acima do patamar de 4%. ${
        inadPF.trend === "up" ? "Tendência de alta nos últimos períodos." : "Porém com tendência de estabilização."
      }`,
      metric: inadPF.display_name,
      value: `${inadPF.last_value.toFixed(2)}%`,
    });
  }

  /* Rule 2: Inadimplência total subindo */
  if (inadTotal && inadTotal.trend === "up" && inadTotal.change_pct > 0.05) {
    alerts.push({
      id: "inad_total_rising",
      severity: "warning",
      title: "Inadimplência total em alta",
      message: `Taxa total subiu ${inadTotal.change_pct > 0 ? "+" : ""}${inadTotal.change_pct.toFixed(2)}% no período. Monitore a correlação com Selic no módulo Macro.`,
      metric: inadTotal.display_name,
      value: `${inadTotal.last_value.toFixed(2)}%`,
    });
  }

  /* Rule 3: Spread PF acima da média histórica (>28 p.p.) */
  if (spreadPF && spreadPF.last_value > 28) {
    alerts.push({
      id: "spread_pf_above_avg",
      severity: spreadPF.last_value > 35 ? "critical" : "warning",
      title: "Spread PF acima da média histórica",
      message: `Spread bancário PF em ${spreadPF.last_value.toFixed(1)} p.p., acima da média histórica de ~28 p.p. Custo do crédito para pessoa física está pressionado.`,
      metric: spreadPF.display_name,
      value: `${spreadPF.last_value.toFixed(1)} p.p.`,
    });
  }

  /* Rule 4: Taxa média PF alta (>50% a.a.) */
  if (taxaPF && taxaPF.last_value > 50) {
    alerts.push({
      id: "taxa_pf_high",
      severity: "warning",
      title: "Custo do crédito PF elevado",
      message: `Taxa média de empréstimos PF em ${taxaPF.last_value.toFixed(1)}% a.a. Considere avaliar modalidades alternativas para clientes.`,
      metric: taxaPF.display_name,
      value: `${taxaPF.last_value.toFixed(1)}% a.a.`,
    });
  }

  /* Rule 5: Crédito/PIB — relação saudável vs excessiva */
  if (creditoPIB && creditoPIB.last_value > 55) {
    alerts.push({
      id: "credito_pib_high",
      severity: "info",
      title: "Relação Crédito/PIB em patamar elevado",
      message: `Crédito/PIB em ${creditoPIB.last_value.toFixed(1)}%, acima de 55%. Sinaliza expansão do crédito, mas atenção ao risco sistêmico.`,
      metric: creditoPIB.display_name,
      value: `${creditoPIB.last_value.toFixed(1)}%`,
    });
  }

  /* If no alerts, push a positive signal */
  if (alerts.length === 0) {
    alerts.push({
      id: "all_clear",
      severity: "info",
      title: "Indicadores dentro da normalidade",
      message: "Todos os indicadores de crédito estão dentro dos parâmetros esperados. Nenhum alerta ativo no momento.",
      metric: "",
      value: "",
    });
  }

  return alerts;
}

function evaluateMacroAlerts(kpis: KPIData[]): Alert[] {
  const alerts: Alert[] = [];

  const selic = kpis.find((k) => k.serie_code === "selic_meta");
  const ipca = kpis.find((k) => k.category?.includes("ipca") && k.serie_code === "ipca_12m");

  if (selic && selic.last_value >= 14) {
    alerts.push({
      id: "selic_high",
      severity: "warning",
      title: "Selic em patamar restritivo",
      message: `Selic Meta em ${selic.last_value.toFixed(2)}% a.a. Política monetária contracionista. Impacto direto no custo do crédito.`,
      metric: selic.display_name,
      value: `${selic.last_value.toFixed(2)}%`,
    });
  }

  if (ipca && ipca.last_value > 4.5) {
    alerts.push({
      id: "ipca_above_target",
      severity: ipca.last_value > 6 ? "critical" : "warning",
      title: "IPCA 12m acima do teto da meta",
      message: `Inflação acumulada em ${ipca.last_value.toFixed(2)}%, acima do teto de 4,5% da meta de inflação.`,
      metric: ipca.display_name,
      value: `${ipca.last_value.toFixed(2)}%`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all_clear",
      severity: "info",
      title: "Cenário macro estável",
      message: "Indicadores macroeconômicos dentro dos parâmetros esperados.",
      metric: "",
      value: "",
    });
  }

  return alerts;
}

/* ─── Visual config per severity ─── */
const severityConfig = {
  critical: {
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    icon: ShieldAlert,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    titleColor: "text-red-300",
    badge: "bg-red-500/20 text-red-400",
    badgeLabel: "CRÍTICO",
  },
  warning: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    titleColor: "text-amber-300",
    badge: "bg-amber-500/20 text-amber-400",
    badgeLabel: "ATENÇÃO",
  },
  info: {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    icon: Info,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    titleColor: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-400",
    badgeLabel: "INFO",
  },
};

/* ─── Main Component ─── */
export const AlertCard = ({ kpis, module = "credito" }: AlertCardProps) => {
  const alerts = useMemo(
    () => (module === "credito" ? evaluateCreditAlerts(kpis) : evaluateMacroAlerts(kpis)),
    [kpis, module]
  );

  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      <AnimatePresence>
      {alerts.map((alert, index) => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;

        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
            className={`${config.bg} border ${config.border} rounded-lg px-4 py-3 transition-all`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-md ${config.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={`text-sm font-medium ${config.titleColor}`}>{alert.title}</h3>
                  <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${config.badge}`}>
                    {config.badgeLabel}
                  </span>
                  {alert.value && (
                    <span className="text-[10px] font-mono text-zinc-500 ml-auto">{alert.value}</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          </motion.div>
        );
      })}
      </AnimatePresence>
      <p className="text-[8px] text-zinc-700 font-mono px-1">
        Alertas gerados automaticamente com base nos últimos dados disponíveis. Não constitui recomendação.
      </p>
    </div>
  );
};
