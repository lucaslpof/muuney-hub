import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type FeedbackCategory = "bug" | "sugestao" | "ux" | "dados" | "outro";

interface FeedbackPayload {
  page: string;
  section?: string;
  category: FeedbackCategory;
  rating?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

interface QueuedFeedback extends FeedbackPayload {
  user_id: string;
  queued_at: string;
}

interface UseFeedbackReturn {
  submit: (payload: FeedbackPayload) => Promise<boolean>;
  submitting: boolean;
  submitted: boolean;
  queued: boolean;
  error: string | null;
  reset: () => void;
}

const QUEUE_KEY = "muuney_hub_feedback_queue";
const MAX_QUEUE = 10;

function readQueue(): QueuedFeedback[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedFeedback[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Storage quota exceeded or disabled — silently drop.
  }
}

async function flushQueue(): Promise<void> {
  const queue = readQueue();
  if (!queue.length) return;
  const remaining: QueuedFeedback[] = [];
  for (const item of queue) {
    const { user_id, queued_at, ...payload } = item;
    void queued_at; // retained for diagnostics, not persisted to DB
    try {
      const { error: dbError } = await supabase.from("hub_feedback").insert({
        user_id,
        page: payload.page,
        section: payload.section ?? null,
        category: payload.category,
        rating: payload.rating ?? null,
        message: payload.message ?? null,
        metadata: payload.metadata ?? {},
      });
      if (dbError) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  writeQueue(remaining);
}

export function useFeedback(): UseFeedbackReturn {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attempt to flush queued feedback when connectivity returns or tab regains focus.
  useEffect(() => {
    if (!user) return;
    const tryFlush = () => {
      if (navigator.onLine) void flushQueue();
    };
    tryFlush();
    window.addEventListener("online", tryFlush);
    window.addEventListener("focus", tryFlush);
    return () => {
      window.removeEventListener("online", tryFlush);
      window.removeEventListener("focus", tryFlush);
    };
  }, [user]);

  const submit = useCallback(
    async (payload: FeedbackPayload): Promise<boolean> => {
      if (!user) {
        setError("Faça login para enviar feedback.");
        return false;
      }
      setSubmitting(true);
      setError(null);
      setQueued(false);

      const enqueue = () => {
        const queue = readQueue();
        queue.push({ ...payload, user_id: user.id, queued_at: new Date().toISOString() });
        writeQueue(queue);
        setQueued(true);
        setSubmitted(true);
      };

      // Offline detection — skip network attempt and queue immediately.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue();
        setSubmitting(false);
        return true;
      }

      try {
        const { error: dbError } = await supabase.from("hub_feedback").insert({
          user_id: user.id,
          page: payload.page,
          section: payload.section ?? null,
          category: payload.category,
          rating: payload.rating ?? null,
          message: payload.message ?? null,
          metadata: payload.metadata ?? {},
        });
        if (dbError) throw dbError;
        setSubmitted(true);
        return true;
      } catch (err: unknown) {
        // Network / fetch failures — fall back to queue instead of surfacing error.
        const message = err instanceof Error ? err.message : "";
        const isNetworkError =
          message.toLowerCase().includes("fetch") ||
          message.toLowerCase().includes("network") ||
          (typeof navigator !== "undefined" && navigator.onLine === false);
        if (isNetworkError) {
          enqueue();
          return true;
        }
        setError(message || "Erro ao enviar feedback.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [user]
  );

  const reset = useCallback(() => {
    setSubmitted(false);
    setQueued(false);
    setError(null);
  }, []);

  return { submit, submitting, submitted, queued, error, reset };
}
