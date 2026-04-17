import { useCallback } from 'react';

export interface ModuleState {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  data?: unknown[] | null;
  error?: Error | null;
  refetch?: () => void;
}

export interface UseModuleStateResult {
  state: 'loading' | 'error' | 'empty' | 'ready';
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  hasData: boolean;
  refetch: () => void;
}

/**
 * Normaliza o padrão de retorno dos hooks de dados (useHubMacro, useHubCredito, etc.)
 * em um estado único e previsível para consumo em componentes.
 *
 * Uso: const moduleState = useModuleState(data, isLoading, isError, refetch);
 */
export function useModuleState(
  data: unknown[] | null | undefined,
  isLoading: boolean,
  isError: boolean,
  refetch: (() => void) | undefined = () => {}
): UseModuleStateResult {
  const isEmpty = !isLoading && !isError && (!data || data.length === 0);
  const hasData = !isLoading && !isError && !!data && data.length > 0;

  let state: 'loading' | 'error' | 'empty' | 'ready';
  if (isLoading) {
    state = 'loading';
  } else if (isError) {
    state = 'error';
  } else if (isEmpty) {
    state = 'empty';
  } else {
    state = 'ready';
  }

  const handleRefetch = useCallback(() => {
    refetch?.();
  }, [refetch]);

  return {
    state,
    isLoading,
    isError,
    isEmpty,
    hasData,
    refetch: handleRefetch,
  };
}
