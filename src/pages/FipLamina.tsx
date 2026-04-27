import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { DataAsOfStamp } from "@/components/hub/DataAsOfStamp";
import { HubSEO } from "@/lib/seo";
import { SectionErrorBoundary } from "@/components/hub/SectionErrorBoundary";
import { EmptyState } from "@/components/hub/EmptyState";
import { useFipDetailV2, type FundMeta } from "@/hooks/useHubFundos";
import { FipPerformancePanel } from "@/components/hub/FipPerformancePanel";
import { FipCotistasPanel } from "@/components/hub/FipCotistasPanel";
import { FundEventsBanner } from "@/components/hub/FundEventsBanner";
import { FundLaminaPolicyPanel } from "@/components/hub/FundLaminaPolicyPanel";
import { GestorRiskBadge } from "@/components/hub/GestorRiskBadge";
import { FundPerfilCotistasPanel } from "@/components/hub/FundPerfilCotistasPanel";
import { FundAssembleiasPanel } from "@/components/hub/FundAssembleiasPanel";
import { ExportPdfButton } from "@/components/hub/ExportPdfButton";
import { PrintFooter } from "@/components/hub/PrintFooter";

const FIP_ACCENT = "#06B6D4";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `R$ ${(v / 1e9).toFixed(2)} bi`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(0)} mi`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} k`;
  return `R$ ${v.toFixed(0)}`;
}

export default function FipLamina() {
  const { slug } = useParams<{ slug: string }>();
  const identifier = slug ? decodeURIComponent(slug) : null;
  const { data, isLoading, error } = useFipDetailV2(identifier);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-zinc-900/50 rounded animate-pulse w-2/3" />
        <div className="h-32 bg-zinc-900/50 rounded animate-pulse" />
        <div className="h-64 bg-zinc-900/50 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data || !data.meta) {
    return (
      <div className="space-y-3">
        <Breadcrumbs items={[{ label: "Fundos", to: "/fundos" }, { label: "FIPs", to: "/fundos/fip" }, { label: "Não encontrado" }]} />
        <EmptyState
          variant="no-results"
          title="FIP não encontrado"
          description={`Não localizamos o fundo "${slug}". Pode ter sido cancelado ou ainda não foi indexado.`}
        />
        <Link to="/fundos/fip" className="text-[10px] font-mono text-[#06B6D4] hover:underline">
          ← voltar para FIPs
        </Link>
      </div>
    );
  }

  const { meta, latest, similar, pe_metrics: peMetrics } = data;
  const metaTyped = meta as FundMeta & { cnpj_fundo_legado?: string | null };
  const fundName = metaTyped.denom_social ?? latest?.nome_fundo ?? slug ?? "FIP";
  const cnpjFundo = metaTyped.cnpj_fundo_legado ?? metaTyped.cnpj_fundo_classe ?? metaTyped.cnpj_fundo;

  return (
    <div className="space-y-4">
      <HubSEO title={`${fundName} — FIP | Hub Muuney`} description={`Lâmina do FIP ${fundName}: TVPI, vintage, J-curve, breakdown de cotistas subscritores.`} />

      <Breadcrumbs
        items={[
          { label: "Fundos", to: "/fundos" },
          { label: "FIPs", to: "/fundos/fip" },
          { label: fundName },
        ]}
      />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-4 flex items-start justify-between gap-3 flex-wrap"
      >
        <div className="flex-1 min-w-[280px]">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-[#06B6D4]" />
            <span className="text-[10px] font-mono uppercase tracking-wide text-[#06B6D4]">FIP — Private Equity</span>
          </div>
          <h1 className="text-base font-mono text-zinc-200 leading-snug">{fundName}</h1>
          <div className="text-[10px] font-mono text-zinc-500 mt-1">
            {cnpjFundo}
            {metaTyped.gestor_nome && <> · Gestor: <span className="text-zinc-400">{metaTyped.gestor_nome}</span></>}
          </div>
          {latest && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{latest.tp_fundo_classe ?? "—"}</span>
              {latest.publico_alvo && <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{latest.publico_alvo}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {latest && (
            <DataAsOfStamp
              date={latest.dt_comptc}
              cadence="quarterly"
              source="CVM Inf Quadrimestral"
              compact
            />
          )}
          <ExportPdfButton title={`${fundName} — FIP`} accent={FIP_ACCENT} />
        </div>
      </motion.div>

      {/* Eventos Relevantes (DEEP-S1) */}
      <FundEventsBanner cnpj={metaTyped.cnpj_fundo_classe || cnpjFundo} days={30} limit={5} />

      {/* Lâmina CVM (DEEP-S1) — política e taxas */}
      <FundLaminaPolicyPanel cnpj={metaTyped.cnpj_fundo_classe || cnpjFundo} accent="#06B6D4" />

      {/* Risco regulatório gestor/admin (DEEP-S2) */}
      <GestorRiskBadge nome={metaTyped.gestor_nome ?? null} tipo="gestor" />
      <GestorRiskBadge nome={metaTyped.admin_nome ?? null} tipo="admin" />

      {/* Perfil cotistas (DEEP-S2) */}
      <FundPerfilCotistasPanel cnpj={metaTyped.cnpj_fundo_classe || cnpjFundo} accent="#06B6D4" />

      {/* Atas/Editais (DEEP-S4) */}
      <FundAssembleiasPanel cnpj={metaTyped.cnpj_fundo_classe || cnpjFundo} accent="#06B6D4" limit={6} />

      {/* Resumo */}
      {latest && (
        <SectionErrorBoundary sectionName="Resumo">
          <section>
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">Resumo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiBox label="PL atual" value={fmtMoney(latest.patrimonio_liquido)} />
              <KpiBox label="Capital comprometido" value={fmtMoney(latest.vl_cap_comprom)} />
              <KpiBox label="Capital integralizado" value={fmtMoney(latest.vl_cap_integr)} />
              <KpiBox label="Cotistas atuais" value={latest.nr_cotistas?.toString() ?? "—"} />
            </div>
          </section>
        </SectionErrorBoundary>
      )}

      {/* Performance — TVPI / J-curve */}
      <SectionErrorBoundary sectionName="Performance">
        <section>
          <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">
            Performance — métricas Private Equity
          </h2>
          {cnpjFundo ? (
            <FipPerformancePanel identifier={cnpjFundo} />
          ) : (
            <EmptyState variant="no-data" title="Sem identificador" description="" />
          )}
          {peMetrics?.vintage_year && (
            <div className="text-[9px] font-mono text-zinc-600 mt-2">
              Nota: vintage {peMetrics.vintage_year} pode ser truncado pela cobertura histórica
              disponível (3 quadrimestres em CVM atual). Refinaremos com mais histórico ao longo do tempo.
            </div>
          )}
        </section>
      </SectionErrorBoundary>

      {/* Cotistas */}
      <SectionErrorBoundary sectionName="Cotistas">
        <section>
          <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">
            Cotistas — perfil do investidor (subscritores)
          </h2>
          {cnpjFundo ? (
            <FipCotistasPanel identifier={cnpjFundo} />
          ) : (
            <EmptyState variant="no-data" title="Sem identificador" description="" />
          )}
        </section>
      </SectionErrorBoundary>

      {/* Similar */}
      {similar && similar.length > 0 && (
        <SectionErrorBoundary sectionName="Similares">
          <section>
            <h2 className="text-[10px] font-mono uppercase tracking-wide text-zinc-500 mb-2">
              Outros FIPs do mesmo tipo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {similar.slice(0, 6).map((s, i) => {
                const sCnpj = (s as any).cnpj_fundo as string;
                const sSlug = (s as any).slug as string | null;
                const target = sSlug ? `/fundos/fip/${sSlug}` : `/fundos/fip/${encodeURIComponent(sCnpj)}`;
                return (
                  <Link
                    key={i}
                    to={target}
                    className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-2 hover:border-[#06B6D4]/40"
                  >
                    <div className="text-[11px] font-mono text-zinc-200 truncate mb-1">
                      {(s as any).denom_social ?? s.nome_fundo ?? sCnpj}
                    </div>
                    <div className="flex items-baseline justify-between text-[9px] font-mono text-zinc-500">
                      <span>{s.tp_fundo_classe ?? "—"}</span>
                      <span className="text-zinc-300">{fmtMoney(s.patrimonio_liquido)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </SectionErrorBoundary>
      )}

      <PrintFooter
        fundName={fundName}
        dataAsOf={latest?.dt_comptc}
        source="CVM Inf Quadrimestral FIP"
      />
    </div>
  );
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/40 p-2">
      <div className="text-[9px] font-mono uppercase text-zinc-500 truncate">{label}</div>
      <div className="text-sm font-mono text-zinc-200 mt-0.5">{value}</div>
    </div>
  );
}
