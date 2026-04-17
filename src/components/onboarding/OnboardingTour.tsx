import React, { useEffect, useState } from 'react';
import { useOnboarding } from '../../hooks/useOnboarding';
import './OnboardingTour.css';

/**
 * Componente OnboardingTour - Tour interativo guiado para AAIs no primeiro acesso.
 * Usa CSS puro + React state. Zero dependências externas.
 *
 * Features:
 * - 7 steps com highlight do elemento alvo (data-tour-id)
 * - Overlay com posição dinâmica (top/bottom/left/right)
 * - Botões: Anterior, Próximo, Pular, Concluir
 * - Estilo Tech-Noir com accent #0B6C3E
 * - Persiste estado no Supabase
 */
export const OnboardingTour: React.FC = () => {
  const { isActive, currentStep, currentStepIndex, totalSteps, nextStep, prevStep, skipTour } =
    useOnboarding();

  const [highlightBox, setHighlightBox] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
    position: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);

  useEffect(() => {
    if (!isActive || !currentStep) {
      setHighlightBox(null);
      setTooltipPosition(null);
      return;
    }

    const element = document.querySelector(`[data-tour-id="${currentStep.tourId}"]`);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    setHighlightBox(rect);

    const tooltipWidth = 320;
    const tooltipHeight = 160;
    const offset = 20;

    let top = rect.top + scrollTop;
    let left = rect.left + scrollLeft;
    let position: 'top' | 'bottom' | 'left' | 'right' = currentStep.position || 'bottom';

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    if (position === 'bottom') {
      top = rect.bottom + scrollTop + offset;
      left = rect.left + scrollLeft + rect.width / 2 - tooltipWidth / 2;

      if (top + tooltipHeight > scrollTop + viewportHeight) {
        position = 'top';
        top = rect.top + scrollTop - offset - tooltipHeight;
      }
    } else if (position === 'top') {
      top = rect.top + scrollTop - offset - tooltipHeight;
      left = rect.left + scrollLeft + rect.width / 2 - tooltipWidth / 2;

      if (top < scrollTop) {
        position = 'bottom';
        top = rect.bottom + scrollTop + offset;
      }
    } else if (position === 'right') {
      left = rect.right + scrollLeft + offset;
      top = rect.top + scrollTop + rect.height / 2 - tooltipHeight / 2;

      if (left + tooltipWidth > scrollLeft + viewportWidth) {
        position = 'left';
        left = rect.left + scrollLeft - offset - tooltipWidth;
      }
    } else if (position === 'left') {
      left = rect.left + scrollLeft - offset - tooltipWidth;
      top = rect.top + scrollTop + rect.height / 2 - tooltipHeight / 2;

      if (left < scrollLeft) {
        position = 'right';
        left = rect.right + scrollLeft + offset;
      }
    }

    left = Math.max(scrollLeft + 8, Math.min(left, scrollLeft + viewportWidth - tooltipWidth - 8));
    top = Math.max(scrollTop + 8, Math.min(top, scrollTop + viewportHeight - tooltipHeight - 8));

    setTooltipPosition({ top, left, position });
  }, [isActive, currentStep]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <div className="onboarding-tour-container">
      {/* Overlay escuro */}
      <div className="onboarding-overlay" onClick={skipTour} />

      {/* Highlight box ao redor do elemento alvo */}
      {highlightBox && (
        <div
          className="onboarding-highlight"
          style={{
            top: `${highlightBox.top + (window.scrollY || document.documentElement.scrollTop)}px`,
            left: `${highlightBox.left + (window.scrollX || document.documentElement.scrollLeft)}px`,
            width: `${highlightBox.width}px`,
            height: `${highlightBox.height}px`,
          }}
        />
      )}

      {/* Tooltip com conteúdo */}
      {tooltipPosition && (
        <div
          className={`onboarding-tooltip onboarding-tooltip-${tooltipPosition.position}`}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="onboarding-tooltip-content">
            <div className="onboarding-tooltip-header">
              <h3 className="onboarding-tooltip-title">{currentStep.title}</h3>
              <span className="onboarding-step-counter">
                {currentStepIndex + 1} de {totalSteps}
              </span>
            </div>
            <p className="onboarding-tooltip-description">{currentStep.description}</p>

            <div className="onboarding-tooltip-footer">
              <div className="onboarding-progress-bar">
                <div
                  className="onboarding-progress-fill"
                  style={{
                    width: `${((currentStepIndex + 1) / totalSteps) * 100}%`,
                  }}
                />
              </div>

              <div className="onboarding-button-group">
                {currentStepIndex > 0 && (
                  <button
                    className="onboarding-btn onboarding-btn-secondary"
                    onClick={prevStep}
                    aria-label="Passo anterior"
                  >
                    ← Anterior
                  </button>
                )}

                <button
                  className="onboarding-btn onboarding-btn-secondary"
                  onClick={skipTour}
                  aria-label="Pular tour"
                >
                  Pular
                </button>

                <button
                  className="onboarding-btn onboarding-btn-primary"
                  onClick={nextStep}
                  aria-label={
                    currentStepIndex === totalSteps - 1 ? 'Concluir tour' : 'Próximo passo'
                  }
                >
                  {currentStepIndex === totalSteps - 1 ? 'Concluir →' : 'Próximo →'}
                </button>
              </div>
            </div>
          </div>

          {/* Seta apontando para o elemento */}
          <div className={`onboarding-tooltip-arrow onboarding-arrow-${tooltipPosition.position}`} />
        </div>
      )}
    </div>
  );
};
