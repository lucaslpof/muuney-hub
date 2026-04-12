import { useState, useCallback } from "react";
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

interface UseFeedbackReturn {
  submit: (payload: FeedbackPayload) => Promise<boolean>;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  reset: () => void;
}

export function useFeedback(): UseFeedbackReturn {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: FeedbackPayload): Promise<boolean> => {
      if (!user) {
        setError("Faça login para enviar feedback.");
        return false;
      }
      setSubmitting(true);
      setError(null);
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
        setError(err instanceof Error ? err.message : "Erro ao enviar feedback.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [user]
  );

  const reset = useCallback(() => {
    setSubmitted(false);
    setError(null);
  }, []);

  return { submit, submitting, submitted, error, reset };
}
