import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function HubFirstAccess() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Uses the same Supabase recovery flow — sends a magic link
      // that lands on /reset-password where the user sets their password.
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar email.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#0B6C3E]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            muuney<span className="text-[#0B6C3E]">.hub</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-2">Primeiro acesso</p>
        </div>

        <div className="bg-[#111111] border border-zinc-800 rounded-xl p-8">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[#0B6C3E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-white font-semibold">Email enviado!</h2>
                <p className="text-zinc-400 text-sm mt-2">
                  Enviamos um link para <span className="text-white">{email}</span>.
                  Clique no link para configurar sua senha e acessar o hub.
                </p>
                <p className="text-zinc-500 text-xs mt-3">
                  Verifique também a caixa de spam.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-block text-[#0B6C3E] hover:text-[#0B6C3E]/80 text-sm font-medium transition-colors"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <p className="text-zinc-400 text-sm">
                  Recebeu um convite para o Muuney Hub? Digite o email que foi convidado
                  para configurar sua senha de acesso.
                </p>
                <div className="px-3 py-2 bg-[#0B6C3E]/5 border border-[#0B6C3E]/20 rounded-lg">
                  <p className="text-[11px] text-[#0B6C3E]/80">
                    Apenas emails convidados pelo time Muuney podem criar conta.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider"
                >
                  Email convidado
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#0B6C3E] focus:ring-1 focus:ring-[#0B6C3E]/50 transition-colors"
                  placeholder="seu@email.com"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "Enviando..." : "Configurar minha senha"}
              </button>

              <div className="flex items-center justify-center gap-4">
                <Link
                  to="/login"
                  className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Ja tenho conta
                </Link>
                <span className="text-zinc-700 text-xs">|</span>
                <Link
                  to="/forgot-password"
                  className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
