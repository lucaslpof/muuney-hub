import { useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const EarlyAccessForm = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "", role: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("hub_leads" as "hub_leads" & string).insert({
        name: form.name,
        email: form.email,
        company: form.company || null,
        role: form.role || null,
        source: "hub-landing",
      });

      if (error) throw error;

      setSubmitted(true);
      toast({ title: "Solicitação recebida!", description: "Entraremos em contato em breve." });
    } catch {
      await supabase.from("newsletter_subscribers").insert({
        email: form.email,
        name: form.name,
        source: "hub-early-access",
      });
      setSubmitted(true);
      toast({ title: "Solicitação recebida!", description: "Entraremos em contato em breve." });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Você está na lista!</h3>
        <p className="text-muted-foreground">Entraremos em contato com os próximos passos.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4 max-w-xl mx-auto">
      <input
        type="text"
        placeholder="Seu nome"
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="email"
        placeholder="Seu email"
        required
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <input
        type="text"
        placeholder="Empresa / Escritório (opcional)"
        value={form.company}
        onChange={(e) => setForm({ ...form, company: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
      <select
        value={form.role}
        onChange={(e) => setForm({ ...form, role: e.target.value })}
        className="px-4 py-3 rounded-lg bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <option value="">Perfil</option>
        <option value="assessor">Assessor de Investimentos</option>
        <option value="consultor">Consultor CVM</option>
        <option value="gestor">Gestor de Patrimônio</option>
        <option value="investidor">Investidor Individual</option>
        <option value="analista">Analista / Research</option>
        <option value="outro">Outro</option>
      </select>
      <div className="sm:col-span-2">
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-primary hover:shadow-glow transition-all py-6 text-base font-semibold"
        >
          {loading ? "Enviando..." : "Solicitar acesso antecipado"}
          {!loading && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground text-center">
        Early access gratuito. Sem compromisso.
      </p>
    </form>
  );
};
