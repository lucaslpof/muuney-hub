import { useEffect, useMemo, useState, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  User as UserIcon,
  Mail,
  Lock,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { HubSEO } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";

type TabId = "profile" | "email" | "password" | "plan";

interface TabMeta {
  id: TabId;
  label: string;
  icon: typeof UserIcon;
  description: string;
}

const TABS: TabMeta[] = [
  { id: "profile", label: "Perfil", icon: UserIcon, description: "Nome e informações pessoais" },
  { id: "email", label: "Email", icon: Mail, description: "Endereço de acesso" },
  { id: "password", label: "Senha", icon: Lock, description: "Credencial de acesso" },
  { id: "plan", label: "Plano", icon: Sparkles, description: "Assinatura e cobrança" },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

export default function HubSettings() {
  const { user, tier, isPro, isAdmin, refreshTier } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId | null) ?? "profile";
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "profile"
  );

  // Profile state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null);

  // Email state
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<Feedback | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback | null>(null);

  // Plan state
  const [tierRow, setTierRow] = useState<{
    pro_since: string | null;
    pro_expires_at: string | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
    current_period_end: string | null;
  } | null>(null);
  const [tierLoading, setTierLoading] = useState(true);

  // Keep URL in sync with active tab
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("tab") !== activeTab) {
      params.set("tab", activeTab);
      setSearchParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load profile row
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      setProfileLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (!error && data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
      }
      setProfileLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Load tier row (billing metadata)
  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      setTierLoading(true);
      const { data, error } = await supabase
        .from("hub_user_tiers")
        .select(
          "pro_since, pro_expires_at, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (!mounted) return;
      if (!error) {
        setTierRow(data ?? null);
      }
      setTierLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  // Initialize email input from current user
  useEffect(() => {
    if (user?.email) setNewEmail(user.email);
  }, [user?.email]);

  const tierBadge = useMemo(() => {
    if (isAdmin) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-500/10 border border-violet-500/30 rounded text-[10px] text-violet-400 font-mono uppercase tracking-wider">
          <Shield className="w-3 h-3" /> Admin
        </span>
      );
    }
    if (isPro) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0B6C3E]/10 border border-[#0B6C3E]/30 rounded text-[10px] text-[#0B6C3E] font-mono uppercase tracking-wider">
          <Sparkles className="w-3 h-3" /> Pro
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-400 font-mono uppercase tracking-wider">
        Free
      </span>
    );
  }, [isAdmin, isPro]);

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    setProfileFeedback(null);
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (error) throw error;
      setProfileFeedback({
        type: "success",
        message: "Perfil atualizado com sucesso.",
      });
    } catch (err) {
      setProfileFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao salvar perfil.",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault();
    setEmailFeedback(null);
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailFeedback({ type: "error", message: "Informe um email válido." });
      return;
    }
    if (trimmed === user?.email?.toLowerCase()) {
      setEmailFeedback({
        type: "error",
        message: "O novo email é igual ao atual.",
      });
      return;
    }
    setEmailSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      setEmailFeedback({
        type: "success",
        message:
          "Enviamos um link de confirmação para o novo email. Clique no link para concluir a alteração.",
      });
    } catch (err) {
      setEmailFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao alterar email.",
      });
    } finally {
      setEmailSaving(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword.length < 8) {
      setPasswordFeedback({
        type: "error",
        message: "A nova senha deve ter no mínimo 8 caracteres.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", message: "As senhas não coincidem." });
      return;
    }
    if (!user?.email) {
      setPasswordFeedback({ type: "error", message: "Sessão inválida." });
      return;
    }
    setPasswordSaving(true);
    try {
      // Reauthenticate with current password to prevent session takeover
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        throw new Error("Senha atual incorreta.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordFeedback({
        type: "success",
        message: "Senha atualizada com sucesso.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Erro ao alterar senha.",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-[#0a0a0a] border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#0B6C3E] focus:ring-1 focus:ring-[#0B6C3E]/50 transition-colors disabled:opacity-60";
  const labelClass =
    "block text-[10px] font-medium text-zinc-500 mb-1.5 uppercase tracking-wider font-mono";

  return (
    <div className="max-w-4xl mx-auto">
      <HubSEO
        title="Configurações"
        description="Gerencie sua conta muuney.hub: perfil, email, senha e plano de assinatura."
        path="/settings"
        isProtected={true}
      />
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
          Configurações da conta
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-zinc-500 font-mono">{user?.email}</span>
          {tierBadge}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar tabs */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors whitespace-nowrap md:whitespace-normal ${
                  isActive
                    ? "bg-[#0B6C3E]/10 text-[#0B6C3E] border border-[#0B6C3E]/30"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50 border border-transparent"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <div className="flex flex-col">
                  <span>{tab.label}</span>
                  <span className="hidden md:inline text-[10px] text-zinc-600 font-normal">
                    {tab.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <div className="bg-[#111111] border border-zinc-800 rounded-xl p-5 md:p-6">
          {activeTab === "profile" && (
            <form onSubmit={handleProfileSave} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">Perfil</h2>
                <p className="text-xs text-zinc-500">
                  Como aparecemos no portal. Esses dados ficam visíveis apenas para você.
                </p>
              </div>
              <div>
                <label className={labelClass}>Nome completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={profileLoading}
                  className={inputClass}
                  placeholder="Seu nome"
                  maxLength={120}
                />
              </div>
              <div>
                <label className={labelClass}>Telefone (opcional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={profileLoading}
                  className={inputClass}
                  placeholder="(11) 99999-9999"
                  maxLength={32}
                />
              </div>
              {profileFeedback && <FeedbackBanner feedback={profileFeedback} />}
              <button
                type="submit"
                disabled={profileSaving || profileLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
              >
                {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {profileSaving ? "Salvando…" : "Salvar perfil"}
              </button>
            </form>
          )}

          {activeTab === "email" && (
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">Email</h2>
                <p className="text-xs text-zinc-500">
                  Ao alterar o email, enviamos um link de confirmação para o novo endereço.
                  A mudança só é efetivada após o clique no link.
                </p>
              </div>
              <div>
                <label className={labelClass}>Email atual</label>
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className={`${inputClass} text-zinc-500`}
                />
              </div>
              <div>
                <label className={labelClass}>Novo email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className={inputClass}
                  placeholder="novo@email.com"
                  autoComplete="email"
                  required
                />
              </div>
              {emailFeedback && <FeedbackBanner feedback={emailFeedback} />}
              <button
                type="submit"
                disabled={emailSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
              >
                {emailSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {emailSaving ? "Enviando…" : "Alterar email"}
              </button>
            </form>
          )}

          {activeTab === "password" && (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">Senha</h2>
                <p className="text-xs text-zinc-500">
                  Use uma senha forte, com no mínimo 8 caracteres. Confirmamos sua senha atual
                  antes de aplicar a alteração.
                </p>
              </div>
              <div>
                <label className={labelClass}>Senha atual</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label className={labelClass}>Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              {passwordFeedback && <FeedbackBanner feedback={passwordFeedback} />}
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
              >
                {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {passwordSaving ? "Atualizando…" : "Atualizar senha"}
              </button>
            </form>
          )}

          {activeTab === "plan" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">Plano</h2>
                <p className="text-xs text-zinc-500">
                  Gerencie sua assinatura e histórico de cobrança.
                </p>
              </div>

              {/* Current plan card */}
              <div className="border border-zinc-800 rounded-lg p-4 bg-[#0a0a0a]">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-1">
                      Plano atual
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-white capitalize">
                        {tier}
                      </span>
                      {tierBadge}
                    </div>
                  </div>
                  {!isPro && !isAdmin && (
                    <Link
                      to="/upgrade"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Fazer upgrade
                    </Link>
                  )}
                </div>

                {tierLoading ? (
                  <div className="text-xs text-zinc-500">Carregando…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <PlanDetailRow
                      label="Status"
                      value={
                        isAdmin
                          ? "Acesso administrativo"
                          : tierRow?.subscription_status ?? (isPro ? "Ativo" : "—")
                      }
                    />
                    <PlanDetailRow
                      label="Pro desde"
                      value={formatDate(tierRow?.pro_since)}
                    />
                    <PlanDetailRow
                      label="Próxima renovação"
                      value={formatDate(tierRow?.current_period_end ?? tierRow?.pro_expires_at)}
                    />
                    <PlanDetailRow
                      label="Stripe customer"
                      value={tierRow?.stripe_customer_id ?? "—"}
                      mono
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                {isPro && !isAdmin ? (
                  <>
                    <a
                      href="mailto:contato@muuney.com.br?subject=Gerenciar%20assinatura%20muuney.hub"
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Gerenciar assinatura
                    </a>
                    <button
                      onClick={() => refreshTier()}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-transparent border border-zinc-800 hover:border-zinc-700 text-zinc-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      Atualizar status
                    </button>
                  </>
                ) : isAdmin ? (
                  <div className="text-xs text-zinc-500">
                    Contas admin têm acesso total ao muuney.hub — sem cobrança associada.
                  </div>
                ) : (
                  <Link
                    to="/upgrade"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#0B6C3E] hover:bg-[#0B6C3E]/90 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Ver planos e fazer upgrade
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  const isSuccess = feedback.type === "success";
  const Icon = isSuccess ? Check : AlertCircle;
  return (
    <div
      role="status"
      className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-xs ${
        isSuccess
          ? "bg-[#0B6C3E]/10 border-[#0B6C3E]/30 text-[#0B6C3E]"
          : "bg-red-500/10 border-red-500/30 text-red-400"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{feedback.message}</span>
    </div>
  );
}

function PlanDetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-0.5">
        {label}
      </div>
      <div
        className={`text-zinc-300 break-all ${mono ? "font-mono text-[11px]" : "text-xs"}`}
      >
        {value}
      </div>
    </div>
  );
}
