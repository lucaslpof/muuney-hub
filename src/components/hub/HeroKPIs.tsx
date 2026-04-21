import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Wallet, Clock, ArrowRight, Database, Radio } from "lucide-react";
import { useFidcV4Overview, useFiiV4Overview, useFipOverview } from "@/hooks/useHubFundos";
import { useHubIngestionStatus } from "@/hooks/useHubData";

/* ──────────────────────────────────────────────────────────────────
 * HeroKPIs — complementary hero strip focused on fund universe stats.
 *
 * Sits below the main indicator hero (Selic/IPCA/PTAX/Inad/Ofertas/Alertas).
 * Pulls live data from hub-fidc-api, hub-fii-api, hub-fip-api + ingestion_status.
 * ────────────────────────────────────────────────────────────────── */

/** Format large currency values into BRL trillions/billions/millions. */
function formatBigBRL(n: number | null | undefined): { value: string; suffix: string } {
  if (n == null || !Number.isFinite(n) || n === 0) return { value: "—", suffix: "" };
  const abs = Math.abs(n);
  if (abs >= 1e12) return { value: (n / 1e12).toFixed(2), suffix: "T" };
  if (abs >= 1e9) return { value: (n / 1e9).toFixed(1), suffix: "B" };
  if (abs >= 1e6) return { value: (n / 1e6).toFixed(1), suffix: "M" };
  if (abs >= 1e3) return { value: (n / 1e3).toFixed(0), suffix: "k" };
  return { value: n.toFixed(0), suffix: "" };
}

/** Portuguese relative time formatter ("há 2 horas", "há 3 dias"). */
function formatDistancePtBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMo = Math.floor(diffDay / 30);

  if (diffSec < 0) return "agora";
  if (diffSec < 60) return "há segundos";
  if (diffMin < 60) return `há ${diffMin} min`;
  if (diffHr < 24) return `há ${diffHr} h`;
  if (diffDay === 1) return "ontem";
  if (diffDay < 30) return `há ${diffDay} dias`;
  if (diffMo < 12) return `há ${diffMo} ${diffMo === 1 ? "mês" : "meses"}`;
  const diffYr = Math.floor(diffMo / 12);
  return `há ${diffYr} ${diffYr === 1 ? "ano" : "anos"}`;
}

export const HeroKPIs = () => {
  const navigate = useNavigate();

  const { data: fidc, isLoading: fidcLoading } = useFidcV4Overview();
  const { data: fii, isLoading: fiiLoading } = useFiiV4Overview();
  const { data: fip, isLoading: fipLoading } = useFipOverview();
  const { data: ingestion } = useHubIngestionStatus();

  const loading = fidcLoading || fiiLoading || fipLoading;

  const totals = useMemo(() => {
    const fidcCount = fidc?.total_fidcs ?? 0;
    const fiiCount = fii?.total_fiis ?? 0;
    const fipCount = fip?.total_fips ?? 0;
    const totalFunds = fidcCount + fiiCount + fipCount;

    const fidcPl = fidc?.total_pl ?? 0;
    const fiiPl = fii?.total_pl ?? 0;
    const fipPl = fip?.total_pl ?? 0;
    const totalPl = fidcPl + fiiPl + fipPl;

    return { fidcCount, fiiCount, fipCount, totalFunds, fidcPl, fiiPl, fipPl, totalPl };
  }, [fidc, fii, fip]);

  /* Last ingestion dates (reduce from ingestion status modules) */
  const lastUpdates = useMemo(() => {
    const modules = ingestion?.modules ?? [];
    const bacenModules = modules.filter((m) => ["macro", "credito", "renda_fixa"].includes(m.module));
    const cvmModules = modules.filter((m) => ["fundos", "fidc", "fii", "fip", "ofertas"].includes(m.module));
    const latest = (list: typeof modules): string | null =>
      list.reduce<string | null>((acc, m) => {
        if (!m.last_success) return acc;
        if (!acc) return m.last_success;
        return m.last_success > acc ? m.last_success : acc;
      }, null);
    return {
      bacen: latest(bacenModules),
      cvm: latest(cvmModules) ?? fidc?.date ?? fii?.date ?? fip?.date ?? null,
    };
  }, [ingestion, fidc, fii, fip]);

  const totalPlFmt = formatBigBRL(totals.totalPl);
  const fidcPlFmt = formatBigBRL(totals.fidcPl);
  const fiiPlFmt = formatBigBRL(totals.fiiPl);
  const fipPlFmt = formatBigBRL(totals.fipPl);

  return (
    <section aria-label="Universo de fundos monitorados">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-[#F59E0B]" />
          <h2 className="text-xs text-zinc-400 uppercase tracking-wider font-mono">
            Universo de Fundos
          </h2>
          <span className="text-[9px] bg-[#F59E0B]/15 text-[#F59E0B] px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
            <Radio className="w-2 h-2 animate-pulse" />
            CVM
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate("/fundos")}
          className="text-[10px] text-[#F59E0B] hover:text-[#F59E0B]/70 flex items-center gap-0.5 font-mono transition-colors"
          aria-label="Ver módulo de fundos"
        >
          Ver módulo <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1 — Total de Fundos */}
        <button
          type="button"
          onClick={() => navigate("/fundos")}
          className="group text-left bg-zinc-900/50 backdrop-blur border border-zinc-800/50 hover:border-[#F59E0B]/30 rounded-lg p-3.5 transition-all duration-150"
          aria-label="Total de fundos monitorados"
          disabled={loading}
        >
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
            <Layers className="w-2.5 h-2.5" />
            Fundos Monitorados
          </p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                {loading ? "—" : totals.totalFunds.toLocaleString("pt-BR")}
              </div>
              <p className="text-[8px] text-zinc-700 font-mono mt-0.5">classes RCVM 175</p>
              <p className="text-[8px] text-zinc-700 font-mono mt-1">FIDC · FII · FIP</p>
            </div>
            <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-[#F59E0B] transition-colors" />
          </div>
        </button>

        {/* Card 2 — PL Agregado */}
        <div
          className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-lg p-3.5"
          aria-label="Patrimônio líquido agregado"
        >
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
            <Wallet className="w-2.5 h-2.5" />
            PL Agregado
          </p>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-3xl font-bold text-zinc-100 font-mono leading-none">
                R$ {totalPlFmt.value}
                <span className="text-lg ml-1 text-zinc-400">{totalPlFmt.suffix}</span>
              </div>
              <p className="text-[8px] text-zinc-700 font-mono mt-0.5">estruturados</p>
              {totals.totalPl > 0 && (
                <p className="text-[8px] text-zinc-700 font-mono mt-1">
                  FIDC {Math.round((totals.fidcPl / totals.totalPl) * 100)}% ·
                  FII {Math.round((totals.fiiPl / totals.totalPl) * 100)}% ·
                  FIP {Math.round((totals.fipPl / totals.totalPl) * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card 3 — Mini-breakdown FIDC / FII / FIP */}
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-lg p-3.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2">
            Classes estruturadas
          </p>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => navigate("/fundos/fidc")}
              className="w-full flex items-center justify-between text-left hover:bg-zinc-800/30 rounded px-1 py-0.5 transition-colors group"
              aria-label="Ver módulo FIDC"
              disabled={loading}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                <span className="text-[10px] text-zinc-400 font-mono">FIDC</span>
              </span>
              <span className="flex items-baseline gap-1.5 font-mono">
                <span className="text-xs text-zinc-200">
                  {loading ? "—" : totals.fidcCount.toLocaleString("pt-BR")}
                </span>
                <span className="text-[9px] text-zinc-600">
                  R$ {fidcPlFmt.value}{fidcPlFmt.suffix}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/fundos/fii")}
              className="w-full flex items-center justify-between text-left hover:bg-zinc-800/30 rounded px-1 py-0.5 transition-colors"
              aria-label="Ver módulo FII"
              disabled={loading}
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899]" />
                <span className="text-[10px] text-zinc-400 font-mono">FII</span>
              </span>
              <span className="flex items-baseline gap-1.5 font-mono">
                <span className="text-xs text-zinc-200">
                  {loading ? "—" : totals.fiiCount.toLocaleString("pt-BR")}
                </span>
                <span className="text-[9px] text-zinc-600">
                  R$ {fiiPlFmt.value}{fiiPlFmt.suffix}
                </span>
              </span>
            </button>
            <div className="w-full flex items-center justify-between px-1 py-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                <span className="text-[10px] text-zinc-400 font-mono">FIP</span>
              </span>
              <span className="flex items-baseline gap-1.5 font-mono">
                <span className="text-xs text-zinc-200">
                  {loading ? "—" : totals.fipCount.toLocaleString("pt-BR")}
                </span>
                <span className="text-[9px] text-zinc-600">
                  R$ {fipPlFmt.value}{fipPlFmt.suffix}
                </span>
              </span>
            </div>
          </div>
          {fip?.pct_integralizacao != null && !loading && (
            <p className="text-[8px] text-zinc-700 font-mono mt-2 pt-2 border-t border-zinc-800/50">
              FIP {fip.pct_integralizacao.toFixed(0)}% integralizado
            </p>
          )}
        </div>

        {/* Card 4 — Última atualização */}
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800/50 rounded-lg p-3.5">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-mono mb-2 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Atualização
          </p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Database className="w-2.5 h-2.5 text-[#0B6C3E]" />
                <span className="text-[10px] text-zinc-400 font-mono">BACEN SGS</span>
              </div>
              <div className="text-sm font-bold text-zinc-200 font-mono">
                {formatDistancePtBR(lastUpdates.bacen)}
              </div>
            </div>
            <div className="border-t border-zinc-800/50 pt-1.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Database className="w-2.5 h-2.5 text-[#F59E0B]" />
                <span className="text-[10px] text-zinc-400 font-mono">CVM</span>
              </div>
              <div className="text-sm font-bold text-zinc-200 font-mono">
                {formatDistancePtBR(lastUpdates.cvm)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroKPIs;
