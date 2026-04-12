/**
 * useDebounce.ts — Debounce hook for search inputs and expensive state updates
 *
 * Usage:
 *   const debouncedQuery = useDebouncedValue(query, 300);
 *   // debouncedQuery updates 300ms after last query change
 */
import { useState, useEffect } from "react";

/** Returns a debounced version of the value that only updates after `delay` ms of inactivity */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
