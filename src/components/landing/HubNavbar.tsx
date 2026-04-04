import { Link } from "react-router-dom";
import { MuuneySymbol } from "@/components/brand/MuuneySymbol";
import { MuuneyHubLogo } from "@/components/brand/MuuneyHubLogo";
import { Button } from "@/components/ui/button";

export const HubNavbar = () => {
  const hubHome = "/";

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={hubHome} className="flex items-center gap-2">
            <MuuneySymbol variant="green" size={32} />
            <MuuneyHubLogo variant="green" height={26} />
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#modulos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Módulos</a>
            <a href="#fontes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Fontes de Dados</a>
            <a href="#para-quem" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Para Quem</a>
            <Button
              size="sm"
              className="bg-gradient-primary hover:shadow-glow transition-all"
              onClick={() => document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" })}
            >
              Acesso antecipado
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};
