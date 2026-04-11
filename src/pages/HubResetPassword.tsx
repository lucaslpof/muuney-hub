import { useState, useEffect, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function HubResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase auto-detects the recovery token in the URL hash
    // and emits PASSWORD_RECOVERY event on onAuthStateChange
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setValidToken(true);
      }
    });

    // Fallback: if user already has a session from the recovery link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidToken(true);
      else if (validToken === null) setValidToken(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Success — redirect to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erro ao redefinir senha.";
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
          <p className="text-zinc-500 text-sm mt-2">Redefinir senha</p>
        </div>

        <div className="bg-[#111111] border border-zinc-800 rounded-xl p-8">
          {validToken === false ? (
            <div className="text-center space-y-4">
              <p className="text-red-400 text-sm">
                Link inválido ou expirado. Solicite uma nova recuperação.
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="text-[#0B6C3E] hover:text-[#0B6C3E]/80 text-sm font-medium transition-colors"
              >
                Solicitar novo link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                  Nova senha
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#0B6C3E] focus:ring-1 focus:ring-[#0B6C3E]/50 transition-colors"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                  Confirmar senha
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#0B6C3E] focus:ring-1 focus:ring-[#0B6C3E]/50 transition-colors"
                  placeholder="Repita a nova senha"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || validToken === null}
                className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
