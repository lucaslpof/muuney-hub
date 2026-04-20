import { useState, useEffect, useRef, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { HubSEO } from "@/lib/seo";

type OtpType = "recovery" | "invite" | "magiclink" | "signup" | "email_change";

export default function HubResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Listen for PASSWORD_RECOVERY (fallback if Supabase auto-parses hash)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!isMountedRef.current) return;
      if (event === "PASSWORD_RECOVERY") {
        setValidToken(true);
      }
    });

    (async () => {
      // Primary flow: our Send Email Hook delivers ?token_hash=...&type=... directly
      // to this page. Verify via the SDK (which handles apikey automatically).
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") as OtpType | null;

      if (tokenHash && type) {
        const { error: otpError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        });
        if (!isMountedRef.current) return;
        if (otpError) {
          console.error("verifyOtp failed:", otpError);
          setValidToken(false);
          setError(
            otpError.message?.toLowerCase().includes("expired")
              ? "Link expirado. Solicite um novo link de recuperação."
              : "Link inválido ou já utilizado. Solicite um novo link."
          );
          return;
        }
        setValidToken(true);
        return;
      }

      // Fallback: user already has an active session (e.g., Supabase auto-parsed hash)
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMountedRef.current) return;
      if (session) {
        setValidToken(true);
      } else {
        setValidToken(false);
      }
    })();

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
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
    <>
      <HubSEO
        title="Redefinir senha"
        description="Defina sua nova senha no Muuney Hub para retomar o acesso ao painel de inteligência de mercado."
        path="/reset-password"
        isProtected={true}
      />
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
                {error ?? "Link inválido ou expirado. Solicite uma nova recuperação."}
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="text-[#0B6C3E] hover:text-[#0B6C3E]/80 text-sm font-medium transition-colors"
              >
                Solicitar novo link
              </button>
            </div>
          ) : validToken === null ? (
            <div className="text-center space-y-3">
              <div className="w-8 h-8 mx-auto rounded-full border-2 border-zinc-800 border-t-[#0B6C3E] animate-spin" />
              <p className="text-zinc-500 text-sm">Validando link...</p>
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
    </>
  );
}
