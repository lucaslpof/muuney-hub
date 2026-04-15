import React, { ComponentType, ReactNode } from 'react';
import { SkeletonLoader } from '@/components/hub/SkeletonLoader';
import { EmptyState } from '@/components/hub/EmptyState';

export interface WithModuleStateProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry?: () => void;
  skeletonVariant?: 'Section' | 'Chart' | 'Table' | 'KPI';
  skeletonCount?: number;
  errorTitle?: string;
  errorDescription?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}

/**
 * HOC wrapper que encapsula o padrão de loading, error e empty states
 * para uso simplificado nos 5 módulos (Macro, Crédito, Renda Fixa, Fundos, Portfolio).
 *
 * Uso:
 * <ModuleStateWrapper
 *   isLoading={isLoading}
 *   isError={isError}
 *   isEmpty={isEmpty}
 *   onRetry={refetch}
 * >
 *   <YourModuleContent />
 * </ModuleStateWrapper>
 */
export const ModuleStateWrapper: React.FC<WithModuleStateProps> = ({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  skeletonVariant = 'Section',
  skeletonCount = 3,
  errorTitle = 'Erro ao carregar dados',
  errorDescription = 'Ocorreu um problema. Tente novamente em alguns instantes.',
  emptyTitle = 'Sem dados disponíveis',
  emptyDescription = 'Os dados serão atualizados automaticamente quando disponíveis.',
  children,
}) => {
  if (isLoading) {
    return <SkeletonLoader variant={skeletonVariant} count={skeletonCount} />;
  }

  if (isError) {
    return (
      <EmptyState
        variant="error"
        title={errorTitle}
        description={errorDescription}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        variant="no-data"
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return <>{children}</>;
};

/**
 * HOC para envolver componentes de seção com state management.
 * Retorna um novo componente que injeta automaticamente os handlers.
 *
 * Uso:
 * const MySection = withModuleState(MySectionComponent);
 *
 * const MySectionComponent: React.FC<{ data: any[] }> = ({ data }) => (
 *   <div>{data.map(...)}</div>
 * );
 */
export function withModuleState<P extends object>(
  Component: ComponentType<P>
): ComponentType<P & WithModuleStateProps> {
  return function WrappedComponent({
    isLoading,
    isError,
    isEmpty,
    onRetry,
    skeletonVariant,
    skeletonCount,
    errorTitle,
    errorDescription,
    emptyTitle,
    emptyDescription,
    ...props
  }: P & WithModuleStateProps) {
    return (
      <ModuleStateWrapper
        isLoading={isLoading}
        isError={isError}
        isEmpty={isEmpty}
        onRetry={onRetry}
        skeletonVariant={skeletonVariant}
        skeletonCount={skeletonCount}
        errorTitle={errorTitle}
        errorDescription={errorDescription}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      >
        <Component {...(props as P)} />
      </ModuleStateWrapper>
    );
  };
}
