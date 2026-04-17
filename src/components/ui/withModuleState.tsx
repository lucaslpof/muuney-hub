import React, { ComponentType, ReactNode } from 'react';
import {
  SkeletonSection,
  SkeletonChart,
  SkeletonTableRow,
  SkeletonKPI,
} from '@/components/hub/SkeletonLoader';
import { EmptyState } from '@/components/hub/EmptyState';

export type ModuleSkeletonVariant = 'Section' | 'Chart' | 'Table' | 'KPI';

export interface WithModuleStateProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry?: () => void;
  skeletonVariant?: ModuleSkeletonVariant;
  skeletonCount?: number;
  errorTitle?: string;
  errorDescription?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}

/**
 * Renders the appropriate skeleton based on variant + count.
 * Internal helper for ModuleStateWrapper.
 */
function renderSkeleton(variant: ModuleSkeletonVariant, count: number): ReactNode {
  switch (variant) {
    case 'Chart':
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonChart key={i} />
          ))}
        </div>
      );
    case 'Table':
      return (
        <div className="space-y-1">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </div>
      );
    case 'KPI':
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonKPI key={i} />
          ))}
        </div>
      );
    case 'Section':
    default:
      return (
        <>
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonSection key={i} />
          ))}
        </>
      );
  }
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
    return <>{renderSkeleton(skeletonVariant, skeletonCount)}</>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center">
        <EmptyState
          variant="section-error"
          title={errorTitle}
          description={errorDescription}
        />
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 px-4 py-2 rounded-lg bg-[#0B6C3E]/20 border border-[#0B6C3E]/30 text-[#0B6C3E] text-xs font-medium hover:bg-[#0B6C3E]/30 transition-colors hub-focus-ring"
          >
            Tentar novamente
          </button>
        )}
      </div>
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
