import { useState } from "react";
import { Link } from "react-router-dom";
import { MuuneySymbol } from "@/components/brand/MuuneySymbol";
import { MuuneyHubLogo } from "@/components/brand/MuuneyHubLogo";
import { Button } from "@/components/ui/button";
import { LogIn, Menu, X } from "lucide-react";

export const HubNavbar = () => {
  const hubHome = "/";
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={hubHome} className="flex items-center gap-2">
            <MuuneySymbol variant="green" size={32} />
            <MuuneyHubLogo variant="green" height={26} />
          </Link>

          {/* Desktop nav */}
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
            <Link to="/login">
              <Button size="sm" variant="outline" className="gap-2 border-[#0B6C3E]/40 text-[#0B6C3E] hover:bg-[#0B6C3E]/10 hover:text-[#0B6C3E]">
                <LogIn className="w-4 h-4" />
                Entrar
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-border space-y-3">
            <a href="#modulos" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-2">Módulos</a>
            <a href="#fontes" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-2">Fontes de Dados</a>
            <a href="#para-quem" onClick={() => setMobileOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-2">Para Quem</a>
            <div className="flex flex-col gap-2 pt-2">
              <Button
                size="sm"
                className="bg-gradient-primary hover:shadow-glow transition-all w-full"
                onClick={() => {
                  setMobileOpen(false);
                  document.getElementById("early-access")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Acesso antecipado
              </Button>
              <Link to="/login" onClick={() => setMobileOpen(false)}>
                <Button size="sm" variant="outline" className="gap-2 border-[#0B6C3E]/40 text-[#0B6C3E] hover:bg-[#0B6C3E]/10 hover:text-[#0B6C3E] w-full">
                  <LogIn className="w-4 h-4" />
                  Entrar
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
