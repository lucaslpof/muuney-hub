import { useState, useEffect, FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Client-side rate limiting: 5 attempts, 60s lockout
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;
const STORAGE_KEY = "muuney_hub_login_attempts";

interface AttemptState {
  count: number;
  lockedUntil: number | null;
}

function readAttempts(): AttemptState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeAttempts(state: AttemptState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function HubLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname ||
    "/dashboard";

  // Tick the lockout countdown
  useEffect(() => {
    const state = readAttempts();
    if (!state.lockedUntil) return;
    const remaining = Math.max(0, state.lockedUntil - Date.now());
    if (remaining === 0) {
      writeAttempts({ count: 0, lockedUntil: null });
      setLockoutRemaining(0);
      return;
    }
    setLockoutRemaining(Math.ceil(remaining / 1000));
    const interval = setInterval(() => {
      const rem = Math.max(0, (state.lockedUntil ?? 0) - Date.now());
      if (rem === 0) {
        writeAttempts({ count: 0, lockedUntil: null });
        setLockoutRemaining(0);
        clearInterval(interval);
      } else {
        setLockoutRemaining(Math.ceil(rem / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const state = readAttempts();
    if (state.lockedUntil && state.lockedUntil > Date.now()) {
      const secs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      setError(`Muitas tentativas. Aguarde ${secs}s e tente novamente.`);
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      writeAttempts({ count: 0, lockedUntil: null });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login.";
      const newCount = state.count + 1;
      if (newCount >= MAX_ATTEMPTS) {
        const lockedUntil = Date.now() + LOCKOUT_MS;
        writeAttempts({ count: newCount, lockedUntil });
        setLockoutRemaining(Math.ceil(LOCKOUT_MS / 1000));
        setError(
          `Muitas tentativas falhas. Acesso bloqueado por ${LOCKOUT_MS / 1000}s.`
        );
      } else {
        writeAttempts({ count: newCount, lockedUntil: null });
        if (message.includes("Invalid login credentials")) {
          setError(
            `Email ou senha incorretos. (${MAX_ATTEMPTS - newCount} tentativas restantes)`
          );
        } else {
          setError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockoutRemaining > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      {/* Subtle gradient backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#0B6C3E]/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo + Brand */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            muuney<span className="text-[#0B6C3E]">.hub</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-2">
            Inteligência de mercado em tempo real
          </p>
        </div>

        {/* Login Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#111111] border border-zinc-800 rounded-xl p-8 space-y-6"
        >
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider"
            >
              Email
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

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-[#0B6C3E] focus:ring-1 focus:ring-[#0B6C3E]/50 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Entrando...
              </>
            ) : isLocked ? (
              `Bloqueado (${lockoutRemaining}s)`
            ) : (
              "Entrar"
            )}
          </button>

          <div className="text-center">
            <Link
              to="/forgot-password"
              className="text-zinc-500 hover:text-[#0B6C3E] text-xs transition-colors"
            >
              Esqueci minha senha
            </Link>
          </div>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-6">
          Acesso restrito a usuários autorizados.
        </p>
      </div>
    </div>
  );
}
