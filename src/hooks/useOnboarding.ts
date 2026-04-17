import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  tourId: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Navegação Principal',
    description: 'Use a barra lateral para navegar entre os 5 módulos principais da plataforma.',
    tourId: 'sidebar-nav',
    position: 'right',
  },
  {
    id: 2,
    title: 'Módulo Macro',
    description: 'Acompanhe indicadores macroeconômicos, séries BACEN e análises narrativas do mercado.',
    tourId: 'nav-macro',
    position: 'right',
  },
  {
    id: 3,
    title: 'Módulo Crédito',
    description: 'Explore dados de crédito, spreads e operações do Sistema Financeiro Nacional.',
    tourId: 'nav-credito',
    position: 'right',
  },
  {
    id: 4,
    title: 'Módulo Fundos',
    description: 'Screener de fundos, lâminas RCVM 175 e insights de alocação estratégica.',
    tourId: 'nav-fundos',
    position: 'right',
  },
  {
    id: 5,
    title: 'Feedback & Sugestões',
    description: 'Envie feedback contextual sobre qualquer seção. Sua opinião nos ajuda a melhorar.',
    tourId: 'feedback-widget',
    position: 'left',
  },
  {
    id: 6,
    title: 'Recursos Premium',
    description: 'Upgrade para PRO para acessar análises avançadas, relatórios customizados e API.',
    tourId: 'tier-badge',
    position: 'bottom',
  },
  {
    id: 7,
    title: 'Você está pronto!',
    description: 'Explore a plataforma. Você pode retornar a este tour a qualquer momento nas configurações.',
    tourId: 'onboarding-complete',
    position: 'top',
  },
];

export interface UseOnboardingResult {
  isActive: boolean;
  currentStep: OnboardingStep | null;
  currentStepIndex: number;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
  restartTour: () => void;
  isLoading: boolean;
}

/**
 * Hook para gerenciar o tour onboarding.
 * Persiste estado no Supabase (hub_user_preferences.onboarding_completed).
 * Auto-ativa no primeiro acesso se user.tier === 'free'.
 */
export function useOnboarding(): UseOnboardingResult {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const queryClient = useQueryClient();

  const currentStep = isActive ? ONBOARDING_STEPS[currentStepIndex] || null : null;

  const { data: preferences, isLoading: isLoadingPrefs } = useQuery({
    queryKey: ['hub_user_preferences', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('hub_user_preferences')
        .select('onboarding_completed, tier')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (onboardingCompleted: boolean) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('hub_user_preferences')
        .upsert(
          {
            user_id: user.id,
            onboarding_completed: onboardingCompleted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['hub_user_preferences', user?.id],
      });
    },
  });

  useEffect(() => {
    if (!isLoadingPrefs && user?.id && preferences?.onboarding_completed === false) {
      setIsActive(true);
      setCurrentStepIndex(0);
    }
  }, [isLoadingPrefs, user?.id, preferences?.onboarding_completed]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= ONBOARDING_STEPS.length) {
        setIsActive(false);
        updatePreferencesMutation.mutate(true);
        return prev;
      }
      return next;
    });
  }, [updatePreferencesMutation]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    setIsActive(false);
    updatePreferencesMutation.mutate(true);
    setCurrentStepIndex(0);
  }, [updatePreferencesMutation]);

  const completeTour = useCallback(() => {
    setIsActive(false);
    updatePreferencesMutation.mutate(true);
    setCurrentStepIndex(0);
  }, [updatePreferencesMutation]);

  const restartTour = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
    updatePreferencesMutation.mutate(false);
  }, [updatePreferencesMutation]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: ONBOARDING_STEPS.length,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    restartTour,
    isLoading: isLoadingPrefs,
  };
}
