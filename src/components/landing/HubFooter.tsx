import { Link } from "react-router-dom";
import { MuuneySymbol } from "@/components/brand/MuuneySymbol";
import { MuuneyHubLogo } from "@/components/brand/MuuneyHubLogo";
import { getMainSiteUrl } from "@/lib/domain";

export const HubFooter = () => (
  <>
    {/* CVM Disclaimer */}
    <section className="py-6 border-t border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-xs text-muted-foreground/60 text-center max-w-3xl mx-auto leading-relaxed">
          <strong>Aviso legal:</strong> O Muuney Hub é uma plataforma de informações e dados de mercado, não constituindo recomendação de investimento,
          consultoria financeira ou oferta de valores mobiliários. Os dados apresentados são obtidos de fontes públicas oficiais (BACEN e CVM) e
          reproduzidos sem edição ou opinião. Decisões de investimento devem ser tomadas com base em análise própria ou com auxílio de profissional
          habilitado junto à CVM. Rentabilidade passada não é garantia de resultados futuros.
        </p>
      </div>
    </section>

    {/* Footer */}
    <footer className="bg-primary text-primary-foreground py-10 border-t border-primary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <MuuneySymbol variant="white" size={24} />
            <MuuneyHubLogo variant="white" height={22} />
          </div>
          <div className="flex items-center gap-6 text-sm text-primary-foreground/70">
            <a href={getMainSiteUrl("/")} className="hover:text-primary-foreground transition-colors">
              Muuney App
            </a>
            <a href={getMainSiteUrl("/blog")} className="hover:text-primary-foreground transition-colors">
              Blog
            </a>
            <Link to="/politica-de-privacidade" className="hover:text-primary-foreground transition-colors">
              Privacidade
            </Link>
            <Link to="/termos-de-uso" className="hover:text-primary-foreground transition-colors">
              Termos
            </Link>
            <a href={getMainSiteUrl("/contato")} className="hover:text-primary-foreground transition-colors">
              Contato
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-primary-foreground/10 text-center text-sm text-primary-foreground/50">
          &copy; 2026 Muuney Tecnologia Ltda. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  </>
);
