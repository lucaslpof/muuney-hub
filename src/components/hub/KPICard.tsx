import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { fmtNum } from "@/lib/format";

interface SparklinePoint {
  value: number;
}

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  trend?: "up" | "down" | "stable";
  unit?: string;
  lastDate?: string;
  loading?: boolean;
  sparklineData?: SparklinePoint[];
  onClick?: () => void;
  hint?: string;
}

/**
 * KPI_HINTS — centralized educational tooltips for common financial KPIs
 * Mapped by lowercase label (e.g. "sharpe", "max dd", "vol 12m").
 * Usage: <SimpleKPICard hint={KPI_HINTS.sharpe} ... />
 */
export const KPI_HINTS: Record<string, string> = {
  sharpe:
    "Sharpe Ratio: retorno em excesso ao ativo livre de risco (CDI) por unidade de volatilidade. >1 é bom, >2 excepcional.",
  sortino:
    "Sortino Ratio: variante do Sharpe que considera apenas volatilidade negativa (downside). Útil para estratégias assimétricas.",
  vol:
    "Volatilidade anualizada: desvio-padrão dos retornos escalado para 12 meses. Mede amplitude de oscilação.",
  "vol 12m":
    "Volatilidade 12 meses anualizada: desvio-padrão dos retornos diários/mensais × √(252) ou × √(12).",
  "max dd":
    "Máximo Drawdown: maior perda acumulada peak-to-trough observada no período. Mede dor máxima histórica.",
  drawdown:
    "Drawdown: queda percentual do pico até o vale. Max DD é o pior já registrado.",
  "retorno anual":
    "Retorno anualizado: taxa composta equivalente a 12 meses. Permite comparar períodos diferentes.",
  "retorno a.a.":
    "Retorno anualizado: taxa composta equivalente a 12 meses.",
  "alpha vs cdi":
    "Alpha vs CDI: retorno do fundo menos o CDI no período. Mede o quanto o gestor adiciona além do benchmark livre de risco.",
  "prêmio dy":
    "Prêmio DY: diferença entre o DY anualizado do FII e a Selic anual. Positivo = compensa o risco de tijolo/papel.",
  cushion:
    "Cushion: razão entre subordinação e inadimplência. >1 significa que o colchão subordinado cobre a inadimplência atual.",
  subordinação:
    "Subordinação: fração da estrutura de capital do FIDC que absorve primeiro as perdas. >15% é conservador.",
  inadimplência:
    "Inadimplência: fração da carteira em atraso ou prejuízo. Abaixo de 3% é considerado saudável.",
  dy:
    "Dividend Yield: provento distribuído no período dividido pela cota de mercado. Equivalente ao cupom do fundo imobiliário.",
  "dy anual":
    "DY Anualizado: DY mensal × 12. Comparável com Selic ou IPCA anualizado.",
  "fund score":
    "Muuney Fund Score™: nota 0-100 composta por Rentabilidade (35%) + Risco (30%) + Liquidez (20%) + Custos (15%), normalizado dentro do peer group.",
  pl:
    "Patrimônio Líquido: valor total de ativos do fundo líquidos de passivos. Mede o tamanho do fundo.",
  cotistas:
    "Número de Cotistas: quantidade de investidores no fundo. Maior número indica diluição de risco de resgate.",
  hhi:
    "Índice Herfindahl-Hirschman: soma dos quadrados das participações de mercado. <1500 pulverizado, >2500 concentrado.",

  // ── Crédito — Inadimplência (inadimplência genérica já definida acima) ──
  "inadim. total":
    "Inadimplência Total SFN: carteira em atraso >90d no Sistema Financeiro Nacional consolidado. Alerta >4%.",
  "inadim. pf":
    "Inadimplência PF: carteira de pessoa física em atraso >90 dias. Segue ciclo PNAD/desemprego com lag ~3m.",
  "inadim. pj":
    "Inadimplência PJ: carteira corporativa em atraso >90 dias. Correlaciona com PIB e concessões.",
  "inadim. livres":
    "Inadimplência em Recursos Livres: segmento mais sensível a ciclo monetário (excluindo crédito direcionado).",

  // ── Crédito — Spreads ──
  spread:
    "Spread Bancário: diferença entre taxa de captação e taxa ao tomador. Mede margem + custos + inadimplência esperada.",
  "spread pf":
    "Spread PF: margem bancária no crédito pessoa física. Histórico ~30pp. Tende a expandir em ciclos de Selic alta.",
  "spread pj":
    "Spread PJ: margem bancária no crédito corporativo. Menor que PF (~12pp) por maior concorrência entre grandes bancos.",
  "spread médio":
    "Spread Médio SFN: média ponderada spread PF + PJ. Benchmark para custo do crédito na economia.",

  // ── Crédito — Taxas ──
  "taxa pf":
    "Taxa Média PF: custo médio do crédito pessoa física (% a.a.). Divulgada mensalmente pelo BACEN.",
  "taxa pj":
    "Taxa Média PJ: custo médio do crédito pessoa jurídica (% a.a.). Referência para decisões de alavancagem.",
  "taxa veículos":
    "Taxa Veículos PF: custo CDC automóveis. Geralmente abaixo da taxa média PF por existência de garantia.",
  "taxa micro":
    "Taxa Microempresas: custo do crédito para PJ de pequeno porte. Tende a ser mais alta por maior risco percebido.",

  // ── Crédito — Saldos ──
  "saldo total":
    "Saldo Total SFN: estoque de crédito concedido e não quitado. Mede profundidade do sistema financeiro.",
  "saldo pf":
    "Saldo PF: estoque de crédito a pessoas físicas. Sensível a ciclos de consumo e renda.",
  "saldo pj":
    "Saldo PJ: estoque de crédito corporativo. Reflete decisões de investimento e capital de giro.",
  "saldo pj livres":
    "Saldo PJ Livres: operações com taxa de mercado (exclui BNDES direcionado, rural subsidiado, etc.).",
  "saldo pme":
    "Saldo PME: crédito para pequenas e médias empresas. Segmento considerado estratégico para política pública.",

  // ── Crédito — Concessões ──
  concessões:
    "Concessões: volume de novas operações contratadas no período. Indicador antecedente de atividade econômica.",
  "concessões pf":
    "Concessões PF: fluxo mensal de novo crédito a pessoas físicas. Lidera IBC-Br em ~2 meses.",
  "concessões pj":
    "Concessões PJ: fluxo mensal de novo crédito corporativo. Reflete apetite por investimento.",
  consignado:
    "Crédito Consignado: desconto em folha, menor risco de inadimplência. Teto de taxa regulado (INSS ≈ 1,84%/mês).",

  // ── Crédito — Macro ──
  "crédito/pib":
    "Relação Crédito/PIB: profundidade financeira. Brasil ~55%, EUA ~180%. >60% sinaliza risco sistêmico em emergentes.",
  "cartões de crédito":
    "Cartões Emitidos: estoque de cartões de crédito ativos. Proxy de bancarização e consumo.",
  "cartão de crédito":
    "Cartão de Crédito PF: saldo rotativo + parcelado. Segmento de maior taxa do sistema (~300% a.a. rotativo).",

  // ── Monetária (referências) ──
  selic:
    "Taxa Selic Meta: instrumento de política monetária do COPOM. Define o custo do dinheiro na economia.",
  tlp:
    "TLP — Taxa de Longo Prazo: remuneração dos financiamentos BNDES. Substituiu TJLP em 2018. Referência: NTN-B 5 anos.",
  tjlp:
    "TJLP — Taxa de Juros de Longo Prazo: histórica, substituída pela TLP. Usada em contratos legados.",
  tr:
    "TR — Taxa Referencial: remuneração da poupança e FGTS. Calculada pelo BCB com base em LFTs.",

  // ── Volatilidade / Risco (sinônimos) ──
  volatilidade:
    "Volatilidade: desvio-padrão dos retornos, indicador de risco. Anualizada pela √(252) para retornos diários.",
  "desvio padrão":
    "Desvio-padrão: dispersão dos retornos em torno da média. Base de Sharpe/Sortino/VaR.",

  // ── Renda Fixa — Taxas de referência ──
  cdi:
    "CDI — Certificado de Depósito Interbancário: taxa média dos empréstimos entre bancos. Benchmark livre de risco para fundos e CDBs.",
  "cdi acumulado":
    "CDI Acumulado: CDI composto nos últimos 12 meses. Benchmark padrão para comparar fundos DI e CDBs pós-fixados.",
  "selic efetiva":
    "Selic Efetiva: taxa média apurada no SELIC (custódia). Expressa em % a.d. — anualização: (1+v/100)^252 − 1.",
  "selic meta":
    "Selic Meta: taxa definida pelo COPOM. Referência para CDI e política monetária. Decisões: 8 reuniões/ano.",
  poupança:
    "Poupança — Rendimento: hoje Selic > 8,5% → 0,5%/mês + TR. Comparação essencial para decisão de renda fixa PF.",
  "taxa referencial":
    "TR — Taxa Referencial: remuneração de poupança/FGTS/financiamentos SFH. Calculada pelo BCB com base em LFTs.",

  // ── Renda Fixa — Curva DI × Pré ──
  "curva di":
    "Curva de Juros (DI × Pré): taxas pré-fixadas negociadas no mercado futuro DI. Reflete expectativa de Selic para cada prazo.",
  "di 30d":
    "Swap DI × Pré 30d: taxa pré-fixada para 30 dias úteis. Proxy de curto prazo da expectativa de Selic.",
  "di 360d":
    "Swap DI × Pré 360d (1a): expectativa de Selic média no próximo ano. Benchmark para CDBs 1a.",
  "di 1800d":
    "Swap DI × Pré 1800d (5a): expectativa de Selic média em 5 anos. Benchmark para prefixados médios.",
  inclinação:
    "Inclinação da Curva: diferença entre longo e curto. Positiva = expectativa de alta da Selic; Negativa (invertida) = expectativa de corte/recessão.",
  "curva invertida":
    "Curva Invertida: vértices longos abaixo dos curtos. Historicamente antecede ciclos de corte da Selic ou recessão.",

  // ── Renda Fixa — Títulos públicos / NTN-B ──
  "ntn-b":
    "NTN-B / Tesouro IPCA+: título público indexado ao IPCA + juro real. Protege contra inflação e trava rentabilidade real.",
  "ltn":
    "LTN / Tesouro Prefixado: título sem cupom (zero-coupon), pago a valor de face no vencimento. Trava taxa nominal.",
  "lft":
    "LFT / Tesouro Selic: título pós-fixado, rende Selic. Baixa volatilidade MaM (marcação a mercado), ideal para reserva.",
  "ntn-f":
    "NTN-F / Tesouro Prefixado com Juros Semestrais: título pré-fixado com cupom de 10% a.a. pago em janeiro e julho.",
  "breakeven inflation":
    "Breakeven Inflation (BEI): diferença entre juro nominal (LTN/DI) e real (NTN-B) para o mesmo prazo. Reflete IPCA esperado pelo mercado.",
  breakeven:
    "Breakeven Inflation: IPCA implícito no preço dos títulos = taxa prefixada − taxa real. Comparar com Focus para detectar desancoragem.",
  "juro real":
    "Juro Real: taxa nominal − inflação esperada. Ex-ante: Selic − Focus IPCA 12m. Positivo elevado = política monetária restritiva.",
  "juro real ex-ante":
    "Juro Real Ex-Ante: Selic − expectativa Focus IPCA 12m. Métrica de aperto monetário. >6% historicamente restritivo para EM.",

  // ── Renda Fixa — Tesouro Direto ──
  "tesouro direto":
    "Tesouro Direto: plataforma B3 de venda pulverizada de títulos públicos a PF. Custódia B3 0,20% a.a. sobre saldo.",
  "estoque td":
    "Estoque Tesouro Direto: valor total em custódia de investidores PF. Cresce com ciclos de Selic alta e aversão a risco.",
  "vendas td":
    "Vendas Líquidas Tesouro Direto: compras − resgates no período. Positivo = fluxo entrando em RF pública.",
  "custódia b3":
    "Taxa de Custódia B3: 0,20% a.a. sobre saldo no Tesouro Direto (isento até R$ 10k em Tesouro Selic). Cobrada semestralmente.",
  "ir regressivo":
    "IR Regressivo RF: 22,5% (≤180d), 20% (181-360d), 17,5% (361-720d), 15% (>720d). Incide no resgate sobre o lucro.",

  // ── Renda Fixa — Métricas de preço e risco ──
  duration:
    "Duration (Macaulay): prazo médio ponderado dos fluxos de caixa, em anos. Mede sensibilidade de preço a variações de taxa.",
  "duration modificada":
    "Duration Modificada: Duration / (1 + taxa). Estima variação % de preço: ΔP/P ≈ −DMod × Δy.",
  convexidade:
    "Convexidade: segunda derivada do preço em relação à taxa. Ajuste para grandes variações de taxa (termo quadrático).",
  dv01:
    "DV01 (Dollar Value of 01 bp): variação de preço em R$ para deslocamento de 1 ponto-base (0,01%) na taxa. Mede exposição absoluta.",
  "marcação a mercado":
    "Marcação a Mercado (MaM): reavaliação diária do preço do título pela taxa de negociação atual. Pode gerar ganho/perda antes do vencimento.",
  mam:
    "Marcação a Mercado: preço do título hoje dado a taxa de mercado. Vender antes do vencimento cristaliza ganho/perda por MaM.",

  // ── Renda Fixa — Crédito privado ──
  "ima-b":
    "IMA-B: índice Anbima que replica cesta de NTN-Bs. Benchmark para fundos IPCA+ de longo prazo.",
  debênture:
    "Debênture: título de dívida corporativa. Pode ser incentivada (isenta IR PF) ou comum. Risco de crédito do emissor.",
  "debênture incentivada":
    "Debênture Incentivada (Lei 12.431): título de dívida de projetos de infraestrutura. Isenta de IR para PF, ideal após CDI 100%.",
  "cra":
    "CRA — Certificado de Recebíveis do Agronegócio: securitização de recebíveis agro. Isento IR PF. Risco de crédito do originador.",
  "cri":
    "CRI — Certificado de Recebíveis Imobiliários: securitização de recebíveis imobiliários. Isento IR PF. Lastro em imóveis/aluguéis.",
  "spread cdi+":
    "Spread CDI+: prêmio de risco sobre o CDI em título pós-fixado. Ex: CDI+2,5% = CDI + 2,5pp ao ano.",
  "spread aa":
    "Spread AA (crédito privado): prêmio médio exigido em debêntures rating AA sobre o CDI. Benchmark para high grade corporativo.",
  "spread a":
    "Spread A (crédito privado): prêmio médio em debêntures rating A sobre o CDI. Maior que AA pelo aumento de risco.",
  // FIP V2 (private equity)
  "tvpi":
    "TVPI (Total Value to Paid-In) = PL atual / Capital Integralizado. Mede quanto o fundo vale hoje em relação ao que foi colocado. > 1x = gerou valor. CAVEAT: CVM não publica capital_distribuído, então DPI puro não está disponível — TVPI mistura realizado + unrealizado.",
  "vintage":
    "Vintage year = ano da primeira chamada de capital do fundo. Útil para comparar performance entre fundos da mesma geração (cohort).",
  "call-down":
    "Call-down ratio = % do capital comprometido que já foi integralizado. Fundos jovens têm call-down baixo (10-30%), maduros chegam a 80-100%. Acima de 100% indica reuso de capital.",
  "dry powder":
    "Dry powder = capital comprometido ainda não chamado. Reserva que o gestor pode acionar para novos investimentos. Comum diluir ao longo dos primeiros 3-5 anos do fundo.",
};

export function getKpiHint(label: string): string | undefined {
  const key = label.toLowerCase().trim();
  return KPI_HINTS[key];
}

/* Small info hint icon with native tooltip */
const HintIcon = ({ hint }: { hint: string }) => (
  <span
    title={hint}
    aria-label={hint}
    className="inline-flex items-center justify-center text-zinc-600 hover:text-zinc-400 cursor-help transition-colors"
  >
    <Info className="w-2.5 h-2.5" />
  </span>
);

/* Tiny inline SVG sparkline - no deps, 30-point max */
const Sparkline = ({ data, trend }: { data: SparklinePoint[]; trend?: string }) => {
  const { path, areaPath } = useMemo(() => {
    if (!data.length || data.length < 2) return { path: "", areaPath: "" };
    const vals = data.map((d) => d.value).filter((v) => Number.isFinite(v));
    if (vals.length < 2) return { path: "", areaPath: "" };
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const w = 80;
    const h = 24;
    const step = w / (vals.length - 1);

    const points = vals.map((v, i) => ({
      x: i * step,
      y: h - ((v - min) / range) * h,
    }));

    const linePath = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
    const area = `${linePath} L${points[points.length - 1].x},${h} L0,${h} Z`;
    return { path: linePath, areaPath: area };
  }, [data]);

  const color = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#71717a";
  const fillColor = trend === "up" ? "#34d399" : trend === "down" ? "#f87171" : "#71717a";

  return (
    <svg width="80" height="24" viewBox="0 0 80 24" className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
      <path d={areaPath} fill={fillColor} opacity={0.1} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

/* Loading skeleton - Bloomberg-dense */
const KPICardSkeleton = () => (
  <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-md px-3 py-2.5 animate-pulse">
    <div className="h-2.5 bg-zinc-800 rounded w-2/3 mb-2" />
    <div className="flex items-end justify-between">
      <div>
        <div className="h-5 bg-zinc-800 rounded w-16 mb-1.5" />
        <div className="h-2 bg-zinc-800 rounded w-10" />
      </div>
      <div className="h-5 bg-zinc-800 rounded w-16" />
    </div>
  </div>
);

/* --- Simple KPI Card - compact variant for deep modules (FIDC, FII, FIP) --- */
export interface SimpleKPICardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  sublabel?: string;
  hint?: string;
}

export const SimpleKPICard = ({
  label,
  value,
  unit = "",
  color = "text-zinc-400",
  sublabel,
  hint,
}: SimpleKPICardProps) => {
  const resolvedHint = hint ?? getKpiHint(label);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3"
      role="status"
      aria-label={`${label}: ${value}${unit}`}
    >
      <div className="flex items-center gap-1 text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">
        <span className="truncate">{label}</span>
        {resolvedHint && <HintIcon hint={resolvedHint} />}
      </div>
      <div className={`text-sm font-semibold font-mono ${color}`}>
        {value}{unit && <span className="text-xs ml-0.5">{unit}</span>}
      </div>
      {sublabel && (
        <div className="text-[9px] text-zinc-600 mt-0.5 font-mono">{sublabel}</div>
      )}
    </motion.div>
  );
};

export const KPICard = ({
  title,
  value,
  change,
  trend,
  unit,
  lastDate,
  loading,
  sparklineData,
  onClick,
  hint,
}: KPICardProps) => {
  if (loading) return <KPICardSkeleton />;

  const trendColor =
    trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-zinc-500";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendBg =
    trend === "up"
      ? "bg-emerald-400/10"
      : trend === "down"
      ? "bg-red-400/10"
      : "bg-zinc-500/10";

  const resolvedHint = hint ?? getKpiHint(title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      className={`group bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 rounded-md px-3 py-2.5 transition-all duration-150 ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {/* Title row */}
      <div className="flex items-center gap-1 mb-1.5">
        <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono truncate">
          {title}
        </p>
        {resolvedHint && <HintIcon hint={resolvedHint} />}
      </div>

      {/* Value + Sparkline row */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          {/* Value */}
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-zinc-100 font-mono leading-none">{value}</span>
            {unit && <span className="text-[10px] text-zinc-600 font-mono">{unit}</span>}
          </div>

          {/* Change badge + date */}
          <div className="flex items-center gap-1.5 mt-1">
            {change !== undefined && (
              <span
                className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono ${trendColor} ${trendBg}`}
              >
                <TrendIcon className="w-2.5 h-2.5" />
                {change > 0 ? "+" : ""}
                {fmtNum(change, 2)}%
              </span>
            )}
            {lastDate && (
              <span className="text-[8px] text-zinc-600 font-mono">{lastDate}</span>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 2 && (
          <Sparkline data={sparklineData} trend={trend} />
        )}
      </div>
    </motion.div>
  );
};
