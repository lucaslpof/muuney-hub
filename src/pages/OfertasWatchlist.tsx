/**
 * OfertasWatchlist — Página dedicada "Minhas ofertas acompanhadas"
 *
 * Rota: /ofertas/watchlist
 * Wrapper minimalista sobre WatchlistSection (componente reusável).
 */

import { Link } from "react-router-dom";
import { ArrowLeft, Bell } from "lucide-react";
import { Breadcrumbs } from "@/components/hub/Breadcrumbs";
import { HubSEO } from "@/lib/seo";
import { WatchlistSection } from "@/components/hub/WatchlistSection";

export default function OfertasWatchlist() {
  return (
    <>
      <HubSEO
        title="Minhas ofertas acompanhadas"
        description="Acompanhe ofertas públicas que você marcou como prioritárias. Veja status, calendário e abra a ficha completa de cada uma."
        path="/ofertas/watchlist"
      />

      <div className="px-4 md:px-8 py-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Breadcrumbs
            items={[
              { label: "Ofertas", to: "/ofertas" },
              { label: "Watchlist" },
            ]}
          />
          <div className="flex items-center gap-2">
            <Link
              to="/ofertas/alertas"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border border-zinc-800 text-zinc-400 rounded hover:border-[#0B6C3E]/40 hover:text-[#0B6C3E] transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              Configurar alertas
            </Link>
            <Link
              to="/ofertas"
              className="inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 hover:text-[#0B6C3E] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              voltar
            </Link>
          </div>
        </div>

        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-zinc-100">
            Minhas ofertas acompanhadas
          </h1>
          <p className="text-[11px] font-mono text-zinc-500 max-w-2xl">
            Lista das ofertas que você marcou como prioritárias. Ordenadas por status
            (em distribuição primeiro) e depois pela data em que foram adicionadas.
            Adicione novas ofertas pela ficha individual (botão "Acompanhar") ou
            configure regras automáticas em <span className="text-zinc-300">Alertas</span>.
          </p>
        </header>

        <WatchlistSection />
      </div>
    </>
  );
}
