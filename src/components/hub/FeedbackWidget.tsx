import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquarePlus, X, Send, Check, Bug, Lightbulb, MousePointerClick, Database, HelpCircle } from "lucide-react";
import { useFeedback, type FeedbackCategory } from "@/hooks/useFeedback";

const CATEGORIES: { value: FeedbackCategory; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "bug", label: "Bug", icon: <Bug size={14} />, color: "text-red-400 border-red-500/30 bg-red-500/10" },
  { value: "sugestao", label: "Sugestão", icon: <Lightbulb size={14} />, color: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { value: "ux", label: "UX/UI", icon: <MousePointerClick size={14} />, color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { value: "dados", label: "Dados", icon: <Database size={14} />, color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { value: "outro", label: "Outro", icon: <HelpCircle size={14} />, color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/10" },
];

interface FeedbackWidgetProps {
  /** Current section name, if contextual */
  section?: string;
}

export function FeedbackWidget({ section }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const { submit, submitting, submitted, error, reset } = useFeedback();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCategory(null);
        setMessage("");
        setRating(null);
        reset();
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, reset]);

  const handleSubmit = async () => {
    if (!category) return;
    const ok = await submit({
      page: location.pathname,
      section: section ?? undefined,
      category,
      rating: rating ?? undefined,
      message: message.trim() || undefined,
      metadata: {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      },
    });
    if (ok) {
      setTimeout(() => setOpen(false), 1500);
    }
  };

  // Success state
  if (open && submitted) {
    return (
      <div ref={panelRef} className="fixed bottom-6 right-6 z-50">
        <div className="bg-zinc-900/50 border border-[#0B6C3E]/40 rounded-xl p-5 shadow-2xl shadow-[#0B6C3E]/10 w-72 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[#0B6C3E]/20 flex items-center justify-center">
              <Check size={20} className="text-[#0B6C3E]" />
            </div>
            <p className="text-sm text-zinc-200 font-medium">Obrigado pelo feedback!</p>
            <p className="text-[11px] text-zinc-500">Sua opinião nos ajuda a melhorar.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {/* Expanded panel */}
      {open && (
        <div className="mb-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl shadow-2xl shadow-black/40 w-[calc(100vw-2rem)] sm:w-80 max-w-80 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
            <div>
              <h3 className="text-sm font-medium text-zinc-200">Feedback</h3>
              <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                {location.pathname}{section ? ` → ${section}` : ""}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-400 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Category pills */}
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Categoria
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                      category === cat.value
                        ? cat.color
                        : "text-zinc-500 border-[#222] bg-transparent hover:border-zinc-600"
                    }`}
                  >
                    {cat.icon}
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating (optional) */}
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Avaliação <span className="text-zinc-700">(opcional)</span>
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`w-8 h-8 rounded-md border text-xs font-mono transition-all ${
                      rating !== null && n <= rating
                        ? "bg-[#0B6C3E]/20 border-[#0B6C3E]/40 text-[#0B6C3E]"
                        : "border-[#222] text-zinc-600 hover:border-zinc-600"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider mb-2 block">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Descreva o que aconteceu ou o que poderia melhorar..."
                rows={3}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-[#0B6C3E]/50 resize-none transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-[11px] text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!category || submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#0B6C3E] hover:bg-[#0B6C3E]/80 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-medium transition-colors"
            >
              {submitting ? (
                <span className="animate-pulse">Enviando...</span>
              ) : (
                <>
                  <Send size={14} />
                  Enviar feedback
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${
          open
            ? "bg-zinc-800 text-zinc-400 scale-90"
            : "bg-[#0B6C3E] text-white hover:bg-[#0B6C3E]/80 hover:scale-105"
        }`}
        title="Enviar feedback"
      >
        {open ? <X size={18} /> : <MessageSquarePlus size={18} />}
      </button>
    </div>
  );
}
