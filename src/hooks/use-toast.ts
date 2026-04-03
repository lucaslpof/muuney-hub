/**
 * Lightweight toast hook for muuney-hub.
 * No external dependencies — uses a simple in-memory state + listener pattern.
 */

import { useState, useEffect, useCallback } from "react";

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

type ToastListener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let listeners: ToastListener[] = [];
let counter = 0;

function emit() {
  listeners.forEach((l) => l([...toasts]));
}

export function toast(opts: Omit<Toast, "id">) {
  const id = String(++counter);
  toasts = [{ ...opts, id }];
  emit();

  // Auto-dismiss after 4s
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 4000);
}

export function useToast() {
  const [state, setState] = useState<Toast[]>([]);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);

  const dismiss = useCallback((id?: string) => {
    toasts = id ? toasts.filter((t) => t.id !== id) : [];
    emit();
  }, []);

  return { toasts: state, toast, dismiss };
}
