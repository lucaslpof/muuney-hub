import { useMemo, useState } from "react";
import { useProductData, type CreditProduct } from "@/hooks/useHubData";
import { ShoppingBag, Users, Building2, ArrowUpDown, ChevronDown, ChevronUp, Loader2, AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/format";

/* ─── Product type (view model) ─── */
interface Product {
  nome: string;
  taxa_aa: number;
  taxa_am: number;
  spread_aa: number;
  spread_am: number;
  inadimplencia: number;
}

/* ─── Map API response to view model ─── */
function toProduct(p: CreditProduct): Product {
  return {
    nome: p.nome,
    taxa_aa: Number(p.taxa_aa),
    taxa_am: Number(p.taxa_am),
    spread_aa: Number(p.spread_aa),
    spread_am: Number(p.spread_am),
    inadimplencia: Number(p.inadimplencia),
  };
}

/* ─── Color helpers ─── */
function rateColor(val: number): string {
  if (val > 100) return "bg-red-500/30 text-red-300";
  if (val > 50) return "bg-red-500/15 text-red-400";
  if (val > 25) return "bg-amber-500/15 text-amber-400";
  if (val > 15) return "bg-yellow-500/10 text-yellow-400";
  return "bg-emerald-500/10 text-emerald-400";
}

function spreadColor(val: number): string {
  if (val > 50) return "bg-red-500/30 text-red-300";
  if (val > 20) return "bg-red-500/15 text-red-400";
  if (val > 10) return "bg-amber-500/15 text-amber-400";
  if (val > 0) return "bg-yellow-500/10 text-yellow-400";
  return "bg-emerald-500/10 text-emerald-400";
}

function nplColor(val: number): string {
  if (val > 15) return "bg-red-500/30 text-red-300";
  if (val > 8) return "bg-red-500/15 text-red-400";
  if (val > 4) return "bg-amber-500/15 text-amber-400";
  if (val > 2) return "bg-yellow-500/10 text-yellow-400";
  return "bg-emerald-500/10 text-emerald-400";
}

function barWidth(val: number, max: number): string {
  return `${Math.min((Math.abs(val) / max) * 100, 100)}%`;
}

/* ─── Sort logic ─── */
type SortKey = "nome" | "taxa_aa" | "spread_aa" | "inadimplencia";

function sortProducts(products: Product[], key: SortKey, asc: boolean): Product[] {
  return [...products].sort((a, b) => {
    const av = key === "nome" ? a.nome : a[key];
    const bv = key === "nome" ? b.nome : b[key];
    if (typeof av === "string" && typeof bv === "string") return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });
}

/* ─── Loading skeleton ─── */
const TableSkeleton = () => (
  <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg p-6">
    <div className="flex items-center justify-center gap-2 text-zinc-500">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-[10px] font-mono">Carregando produtos do BACEN...</span>
    </div>
  </div>
);

/* ─── Error state ─── */
const ErrorState = () => (
  <div className="bg-[#0f0f0f] border border-red-500/20 rounded-lg p-6">
    <div className="flex items-center justify-center gap-2 text-red-400">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-[10px] font-mono">Erro ao carregar dados de produtos. Tentando novamente...</span>
    </div>
  </div>
);

/* ─── Product Table ─── */
const ProductTable = ({ title, icon: Icon, products, accentColor }: {
  title: string;
  icon: React.ElementType;
  products: Product[];
  accentColor: string;
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("taxa_aa");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => sortProducts(products, sortKey, sortAsc), [products, sortKey, sortAsc]);

  const maxTaxa = useMemo(() => Math.max(...products.map((p) => p.taxa_aa), 1), [products]);
  const maxSpread = useMemo(() => Math.max(...products.map((p) => Math.abs(p.spread_aa)), 1), [products]);
  const maxNPL = useMemo(() => Math.max(...products.map((p) => p.inadimplencia), 1), [products]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-2.5 h-2.5 text-zinc-700" />;
    return sortAsc ? <ChevronUp className="w-2.5 h-2.5 text-zinc-300" /> : <ChevronDown className="w-2.5 h-2.5 text-zinc-300" />;
  };

  if (products.length === 0) return null;

  return (
    <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#141414]">
        <Icon className="w-4 h-4" style={{ color: accentColor }} />
        <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
        <span className="text-[9px] text-zinc-600 font-mono ml-auto">{products.length} produtos</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr className="border-b border-[#141414] text-zinc-500">
              <th className="text-left py-2 px-3 min-w-[180px] sticky left-0 bg-[#0f0f0f] z-10">
                <button onClick={() => handleSort("nome")} className="flex items-center gap-1 hover:text-zinc-300 transition-colors">
                  Produto <SortIcon col="nome" />
                </button>
              </th>
              <th className="text-right py-2 px-2 min-w-[140px]">
                <button onClick={() => handleSort("taxa_aa")} className="flex items-center gap-1 ml-auto hover:text-zinc-300 transition-colors">
                  Taxa a.a. <SortIcon col="taxa_aa" />
                </button>
              </th>
              <th className="text-right py-2 px-2 min-w-[60px]">Taxa a.m.</th>
              <th className="text-right py-2 px-2 min-w-[140px]">
                <button onClick={() => handleSort("spread_aa")} className="flex items-center gap-1 ml-auto hover:text-zinc-300 transition-colors">
                  Spread a.a. <SortIcon col="spread_aa" />
                </button>
              </th>
              <th className="text-right py-2 px-2 min-w-[60px]">Spread a.m.</th>
              <th className="text-right py-2 px-2 min-w-[140px]">
                <button onClick={() => handleSort("inadimplencia")} className="flex items-center gap-1 ml-auto hover:text-zinc-300 transition-colors">
                  Inadimplência <SortIcon col="inadimplencia" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.nome} className="border-t border-[#111] hover:bg-[#0c0c0c] transition-colors group">
                <td className="py-2 px-3 text-zinc-300 font-medium sticky left-0 bg-[#0f0f0f] group-hover:bg-[#0c0c0c] z-10 transition-colors">
                  {p.nome}
                </td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-3 bg-[#111] rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all" style={{ width: barWidth(p.taxa_aa, maxTaxa), backgroundColor: accentColor, opacity: 0.7 }} />
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${rateColor(p.taxa_aa)}`}>
                      {fmtNum(p.taxa_aa, 2)}%
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right text-zinc-500">{fmtNum(p.taxa_am, 2)}%</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-3 bg-[#111] rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all" style={{ width: barWidth(p.spread_aa, maxSpread), backgroundColor: p.spread_aa >= 0 ? "#F59E0B" : "#10B981", opacity: 0.6 }} />
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${spreadColor(p.spread_aa)}`}>
                      {p.spread_aa >= 0 ? "+" : ""}{fmtNum(p.spread_aa, 2)}%
                    </span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right text-zinc-500">{p.spread_am >= 0 ? "+" : ""}{fmtNum(p.spread_am, 2)}%</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-3 bg-[#111] rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all" style={{ width: barWidth(p.inadimplencia, maxNPL), backgroundColor: "#EF4444", opacity: 0.6 }} />
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${nplColor(p.inadimplencia)}`}>
                      {fmtNum(p.inadimplencia, 2)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#141414] text-[8px] text-zinc-700 font-mono space-y-0.5">
        <div>Taxa: último mês publicado · Spread: média sobre CDI nos últimos 12 meses</div>
        <div>Inadimplência: &gt;90 dias, último mês publicado</div>
      </div>
    </div>
  );
};

/* ─── Top 5 ranking cards ─── */
const RankingCards = ({ pfProducts, pjProducts }: { pfProducts: Product[]; pjProducts: Product[] }) => {
  const all = useMemo(() => [
    ...pfProducts.map((p) => ({ ...p, tipo: "PF" as const })),
    ...pjProducts.map((p) => ({ ...p, tipo: "PJ" as const })),
  ], [pfProducts, pjProducts]);

  const topTaxa = useMemo(() => [...all].sort((a, b) => b.taxa_aa - a.taxa_aa).slice(0, 5), [all]);
  const topInadim = useMemo(() => [...all].sort((a, b) => b.inadimplencia - a.inadimplencia).slice(0, 5), [all]);
  const topSpread = useMemo(() => [...all].sort((a, b) => b.spread_aa - a.spread_aa).slice(0, 5), [all]);
  const lowCost = useMemo(() => [...all].filter((p) => p.taxa_aa > 0).sort((a, b) => a.taxa_aa - b.taxa_aa).slice(0, 5), [all]);

  const RankList = ({ title, items, valueKey, unit, colorFn }: {
    title: string;
    items: (Product & { tipo: string })[];
    valueKey: "taxa_aa" | "inadimplencia" | "spread_aa";
    unit: string;
    colorFn: (v: number) => string;
  }) => (
    <div className="bg-[#0a0a0a] border border-[#141414] rounded-lg p-3">
      <div className="text-[10px] font-mono font-bold text-zinc-400 mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={item.nome} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-zinc-600 w-4 text-right">{i + 1}.</span>
            <span className="text-[9px] text-zinc-400 flex-1 truncate">{item.nome}</span>
            <span className={`text-[8px] px-1 py-0.5 rounded font-mono ${item.tipo === "PF" ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-400"}`}>
              {item.tipo}
            </span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${colorFn(item[valueKey])}`}>
              {fmtNum(item[valueKey], 1)}{unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (all.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <RankList title="Maiores Taxas" items={topTaxa} valueKey="taxa_aa" unit="%" colorFn={rateColor} />
      <RankList title="Maior Inadimpl." items={topInadim} valueKey="inadimplencia" unit="%" colorFn={nplColor} />
      <RankList title="Maiores Spreads" items={topSpread} valueKey="spread_aa" unit=" p.p." colorFn={spreadColor} />
      <RankList title="Menor Custo" items={lowCost} valueKey="taxa_aa" unit="%" colorFn={rateColor} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* MAIN COMPONENT                                                     */
/* ═══════════════════════════════════════════════════════════════════ */

export const CreditProductPanel = () => {
  const { data: allProducts, isLoading, isError } = useProductData();

  const pfProducts = useMemo(
    () => (allProducts || []).filter((p) => p.tipo === "PF").map(toProduct),
    [allProducts]
  );

  const pjProducts = useMemo(
    () => (allProducts || []).filter((p) => p.tipo === "PJ").map(toProduct),
    [allProducts]
  );

  const updatedAt = allProducts?.[0]?.updated_at
    ? new Date(allProducts[0].updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <ShoppingBag className="w-4 h-4 text-[#10B981]" />
        <h2 className="text-sm font-bold text-zinc-100 tracking-tight">Produtos de Crédito</h2>
        <span className="text-[9px] text-zinc-600 font-mono">Taxas, spreads e inadimplência por modalidade</span>
        {updatedAt && (
          <span className="text-[8px] text-zinc-700 font-mono ml-auto">Atualizado: {updatedAt}</span>
        )}
      </div>

      {isLoading && <TableSkeleton />}
      {isError && <ErrorState />}

      {!isLoading && !isError && (
        <>
          <RankingCards pfProducts={pfProducts} pjProducts={pjProducts} />

          <ProductTable
            title="Pessoas Físicas"
            icon={Users}
            products={pfProducts}
            accentColor="#10B981"
          />

          <ProductTable
            title="Pessoas Jurídicas"
            icon={Building2}
            products={pjProducts}
            accentColor="#6366F1"
          />
        </>
      )}

      {/* Source footer */}
      <div className="border-t border-[#141414] pt-3 flex items-center justify-between text-[9px] text-zinc-700 font-mono">
        <span>Fonte: Banco Central do Brasil — Estatísticas de Crédito · Supabase</span>
        <span>Dados: Último mês publicado · Atualização dinâmica</span>
      </div>
    </div>
  );
};
