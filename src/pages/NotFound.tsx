import { Link } from "react-router-dom";
import { HubSEO } from "@/lib/seo";

const NotFound = () => (
  <>
    <HubSEO
      title="Página não encontrada"
      description="A página solicitada não existe no Muuney Hub. Volte ao painel para acessar os módulos de inteligência de mercado."
      isProtected={true}
    />
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-zinc-800 font-mono">404</h1>
        <p className="text-zinc-500 mt-2 text-sm">Página não encontrada</p>
        <Link
          to="/"
          className="inline-block mt-4 px-4 py-2 bg-[#0B6C3E] text-white text-sm rounded-md hover:bg-[#0B6C3E]/80 transition-colors"
        >
          Voltar ao Hub
        </Link>
      </div>
    </div>
  </>
);

export default NotFound;
