import React, { useEffect } from 'react';
import type { ScoringCandidate } from '../types/scoring';
import type { TreatmentId, Treatment } from '../types/treatment';
import type { SessionItem } from '../types/session';
import type { WizardAction } from '../types/state';
import type { WizardMeta } from '../data/meta';
import { RULES } from '../constants/rules';
import { useAnalytics } from '../hooks/useAnalytics';
import { RecommendationCard } from './RecommendationCard';
import { AddonChip } from './AddonChip';
import { SessionPlan } from './SessionPlan';

interface MultiResultScreenProps {
  results: readonly ScoringCandidate[];
  sessionPlan: readonly SessionItem[];
  treatments: Readonly<Record<TreatmentId, Treatment>>;
  meta: WizardMeta;
  symptomCount: number;
  dispatch: React.Dispatch<WizardAction>;
}

export function MultiResultScreen({
  results,
  sessionPlan,
  treatments,
  meta: _meta,
  symptomCount,
  dispatch,
}: MultiResultScreenProps): React.ReactElement {
  const analytics = useAnalytics();
  const selectedCount = symptomCount;

  // Fire recommendation event once for the top result
  useEffect(() => {
    if (results.length === 0) return;
    const top = results[0];
    const topTreatment = treatments[top.treatmentId];
    if (!topTreatment) return;
    analytics.fireRecommendation(top.treatmentId, topTreatment.name, topTreatment.price, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.length > 0 ? results[0].treatmentId : '']);

  function handleGoBack(): void {
    dispatch({ type: 'GO_BACK' });
  }

  function handleStartOver(): void {
    analytics.fireRestarted();
    dispatch({ type: 'RESET' });
  }

  function handleAddToSession(candidate: ScoringCandidate): void {
    const t = treatments[candidate.treatmentId];
    if (!t) return;
    // Note: analytics.fireItemAdded is fired by RecommendationCard before calling
    // this callback, so we only dispatch the state update here.
    dispatch({
      type: 'ADD_TO_SESSION',
      item: {
        treatmentId: t.id,
        name: t.name,
        price: t.price,
        priceLabel: t.priceLabel,
        isInjection: t.category === 'injection',
      },
    });
  }

  function handleRemoveFromSession(treatmentId: TreatmentId): void {
    dispatch({ type: 'REMOVE_FROM_SESSION', treatmentId });
  }

  function handleBookSession(): void {
    // Open Acuity directly for the primary (first non-injection) item in the session.
    // If there's no primary, use the top result.
    const primary = sessionPlan.find((i) => !i.isInjection);
    const fallbackId = results[0]?.treatmentId;
    const bookId = primary?.treatmentId ?? fallbackId;
    if (!bookId) return;

    const t = treatments[bookId];
    if (!t) return;

    analytics.fireBookClicked(t.id, t.name);
    analytics.fireBookingStarted(t.id);
    dispatch({
      type: 'START_BOOKING',
      treatmentId: t.id,
      acuityTypeId: t.acuityTypeId,
      acuityDropdownValue: t.acuityDropdownValue,
    });
  }

  // Addon suggestions from the #1 ranked result
  const primaryResult = results[0];
  const primaryTreatment = primaryResult ? treatments[primaryResult.treatmentId] : null;
  const addonSuggestions = primaryTreatment?.addonSuggestions ?? [];
  const injectionCount = sessionPlan.filter((i) => i.isInjection).length;

  return (
    <div className="tw-multi-result">
      {/* Header */}
      <div className="tw-multi-header">
        <h2 className="tw-multi-title">Your Personalized Recommendations</h2>
        <p className="tw-multi-subtitle">
          Based on {selectedCount} symptom{selectedCount !== 1 ? 's' : ''} you selected
        </p>
      </div>

      {/* Recommendation cards */}
      <div className="tw-rec-cards">
        {results.map((candidate, index) => {
          const t = treatments[candidate.treatmentId];
          if (!t) return null;
          const isInSession = sessionPlan.some((i) => i.treatmentId === candidate.treatmentId);
          return (
            <RecommendationCard
              key={candidate.treatmentId}
              candidate={candidate}
              rank={index + 1}
              treatment={t}
              isInSession={isInSession}
              sessionSize={sessionPlan.length}
              onAddToSession={() => handleAddToSession(candidate)}
            />
          );
        })}
      </div>

      {/* Addon suggestion chips (based on #1 result's addonSuggestions) */}
      {addonSuggestions.length > 0 && (
        <div className="tw-addon-section">
          <p className="tw-addon-section-title">Suggested add-ons</p>
          <div className="tw-addon-chips-scroll">
            {addonSuggestions.map((addonId) => {
              const addonTreatment = treatments[addonId];
              if (!addonTreatment) return null;
              const isAdded = sessionPlan.some((i) => i.treatmentId === addonId);
              const atCap = injectionCount >= RULES.MAX_INJECTIONS && !isAdded;
              return (
                <AddonChip
                  key={addonId}
                  treatment={addonTreatment}
                  added={isAdded}
                  onToggle={() => {
                    if (isAdded) {
                      dispatch({ type: 'REMOVE_FROM_SESSION', treatmentId: addonId });
                    } else {
                      dispatch({
                        type: 'ADD_TO_SESSION',
                        item: {
                          treatmentId: addonId,
                          name: addonTreatment.name,
                          price: addonTreatment.price,
                          priceLabel: addonTreatment.priceLabel,
                          isInjection: addonTreatment.category === 'injection',
                        },
                      });
                    }
                  }}
                  disabled={atCap}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Injection promo notice */}
      {addonSuggestions.length > 0 && (
        <div className="tw-promo-notice">
          <p className="tw-promo-notice-text">{RULES.INJECTION_PROMO_TEXT}</p>
        </div>
      )}

      {/* Session plan (sticky cart footer) */}
      <SessionPlan
        items={sessionPlan}
        meta={_meta}
        onRemove={handleRemoveFromSession}
        onBook={handleBookSession}
      />

      {/* Navigation */}
      <nav className="tw-nav" aria-label="Wizard navigation">
        <button
          type="button"
          className="tw-btn-back"
          onClick={handleGoBack}
          aria-label="Go back to symptoms question"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="10,3 5,8 10,13" />
          </svg>
          Back
        </button>
        <button
          type="button"
          className="tw-btn-restart"
          onClick={handleStartOver}
          aria-label="Restart the wizard from the beginning"
        >
          Start Over
        </button>
      </nav>
    </div>
  );
}
