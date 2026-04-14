import { useToast } from "@/hooks/use-toast";
import { X, AlertTriangle, CheckCircle } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`relative p-4 rounded-lg border shadow-lg animate-in fade-in slide-in-from-bottom-2 pointer-events-auto ${
            t.variant === "destructive"
              ? "bg-red-950/95 border-red-800/50 text-red-200"
              : "bg-emerald-950/95 border-emerald-800/50 text-emerald-200"
          }`}
        >
          <div className="flex items-start gap-3">
            {t.variant === "destructive" ? (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-sm font-medium">{t.title}</p>}
              {t.description && <p className="text-xs text-zinc-400 mt-1">{t.description}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-zinc-500 hover:text-zinc-300 shrink-0 ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
