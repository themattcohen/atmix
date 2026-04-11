import React, { useEffect } from 'react';
import type { ResolvedRecommendation } from '../types/bundle';
import type { SessionItem } from '../types/session';
import type { WizardAction } from '../types/state';
import type { TreatmentId } from '../types/treatment';
import type { WizardMeta } from '../data/meta';
import { RULES } from '../constants/rules';
import { TREATMENTS } from '../data/index';
import { useAnalytics } from '../hooks/useAnalytics';
import { TrustBar } from './TrustBar';
import { BookingButton } from './BookingButton';
import { BundleAddon } from './BundleAddon';
import { AddonChip } from './AddonChip';

interface ResultScreenProps {
  recommendation: ResolvedRecommendation;
  bundleAddonAdded: boolean;
  sessionPlan: readonly SessionItem[];
  meta: WizardMeta;
  dispatch: React.Dispatch<WizardAction>;
}

export function ResultScreen({
  recommendation,
  bundleAddonAdded,
  sessionPlan,
  meta,
  dispatch,
}: ResultScreenProps): React.ReactElement {
  const analytics = useAnalytics();

  // Resolve the primary treatment and display name depending on kind
  const isPrimary = recommendation.kind === 'treatment';
  const treatment = isPrimary ? recommendation.treatment : recommendation.primary;
  const displayName = isPrimary ? recommendation.treatment.name : recommendation.bundle.name;
  const whyMatch = isPrimary ? recommendation.treatment.whyMatch : recommendation.bundle.whyMatch;
  const priceDisplay = treatment.priceLabel ?? `$${treatment.price}`;

  // Addon suggestions from the primary treatment
  const addonSuggestions = treatment.addonSuggestions;
  const injectionCount = sessionPlan.filter((i) => i.isInjection).length;

  // Fire recommendation event once when result renders
  useEffect(() => {
    const id = isPrimary ? recommendation.treatment.id : recommendation.bundle.id;
    const name = displayName;
    const price = treatment.price;
    const isBundle = !isPrimary;
    analytics.fireRecommendation(id, name, price, isBundle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPrimary ? recommendation.treatment.id : recommendation.bundle.id]);

  function handleGoBack(): void {
    dispatch({ type: 'GO_BACK' });
  }

  function handleStartOver(): void {
    analytics.fireRestarted();
    dispatch({ type: 'RESET' });
  }

  function handleLearnMore(): void {
    analytics.fireLearnMore(treatment.id, treatment.name);
  }

  function handleToggleBundleAddon(): void {
    dispatch({ type: 'TOGGLE_BUNDLE_ADDON' });
  }

  function handleToggleAddon(addonId: TreatmentId): void {
    const isCurrentlyAdded = sessionPlan.some((i) => i.treatmentId === addonId);
    if (isCurrentlyAdded) {
      dispatch({ type: 'REMOVE_FROM_SESSION', treatmentId: addonId });
    } else {
      const addonTreatment = TREATMENTS[addonId];
      if (!addonTreatment) return;
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
  }

  // Determine the "booking subject" for BookingButton
  const bookingSubject = isPrimary ? recommendation.treatment : recommendation.bundle;

  return (
    <div className="tw-result">
      {/* Header */}
      <div className="tw-result-header">
        <p className="tw-result-match-label">Your recommended treatment</p>
        <h2 className="tw-result-name">{displayName}</h2>
        <div className="tw-result-price-row">
          <span className="tw-result-price">{priceDisplay}</span>
          <span className="tw-result-duration">{treatment.duration}</span>
        </div>
        {treatment.shortDesc && (
          <p className="tw-result-desc">{treatment.shortDesc}</p>
        )}
      </div>

      {/* Why we matched you */}
      {whyMatch && (
        <div className="tw-result-match">
          <p className="tw-result-match-title">Why this is your match</p>
          <p className="tw-result-match-text">{whyMatch}</p>
        </div>
      )}

      {/* Ingredients / What's inside / What's tested */}
      {treatment.ingredients.length > 0 && (
        <div className="tw-result-ingredients">
          <p className="tw-result-section-title">
            {treatment.category === 'lab' ? RULES.LABEL_LABS : RULES.LABEL_TREATMENT}
          </p>
          <ul className="tw-result-ing-list">
            {treatment.ingredients.map((ing) => (
              <li key={ing.name} className="tw-result-ing-item">
                <span className="tw-result-ing-name">{ing.name}</span>
                <span className="tw-result-ing-benefit">{ing.benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best for tags */}
      {treatment.bestFor.length > 0 && (
        <div className="tw-result-bestfor">
          <span className="tw-result-bestfor-label">Best for:</span>
          <div className="tw-result-bestfor-tags">
            {treatment.bestFor.map((tag) => (
              <span key={tag} className="tw-result-bestfor-tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* GLP-1 / program note */}
      {treatment.note && (
        <p className="tw-result-note">{treatment.note}</p>
      )}

      {/* Bundle add-on (interactive or static) */}
      {recommendation.kind === 'bundle' && recommendation.addOn && (
        <BundleAddon
          addOn={recommendation.addOn}
          label={recommendation.bundle.addOnLabel}
          interactive={recommendation.bundle.addOnInteractive}
          added={bundleAddonAdded}
          onToggle={handleToggleBundleAddon}
        />
      )}

      {/* Injection addon suggestion chips */}
      {addonSuggestions.length > 0 && (
        <div className="tw-addon-section">
          <p className="tw-addon-section-title">Suggested add-ons</p>
          <div className="tw-addon-chips-wrap">
            {addonSuggestions.map((addonId) => {
              const addonTreatment = TREATMENTS[addonId];
              if (!addonTreatment) return null;
              const isAdded = sessionPlan.some((i) => i.treatmentId === addonId);
              const atCap = injectionCount >= RULES.MAX_INJECTIONS && !isAdded;
              return (
                <AddonChip
                  key={addonId}
                  treatment={addonTreatment}
                  added={isAdded}
                  onToggle={() => handleToggleAddon(addonId)}
                  disabled={atCap}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Trust bar */}
      <TrustBar rating="5" reviewCount={meta.reviewCount} />

      {/* CTA buttons */}
      <div className="tw-result-ctas">
        <BookingButton
          treatment={bookingSubject}
          bundleAddonAdded={bundleAddonAdded}
          sessionPlan={sessionPlan}
          meta={meta}
          dispatch={dispatch}
        />
        {treatment.pageUrl && (
          <a
            href={treatment.pageUrl}
            className="tw-btn-secondary"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLearnMore}
            aria-label={`Learn more about ${treatment.name}, opens in new tab`}
          >
            Learn More
          </a>
        )}
      </div>

      {/* Navigation */}
      <nav className="tw-nav" aria-label="Wizard navigation">
        <button
          type="button"
          className="tw-btn-back"
          onClick={handleGoBack}
          aria-label="Go back to previous question"
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
