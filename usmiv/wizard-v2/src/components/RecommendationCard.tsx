import React, { useState } from 'react';
import type { ScoringCandidate } from '../types/scoring';
import type { Treatment } from '../types/treatment';
import { useAnalytics } from '../hooks/useAnalytics';

interface RecommendationCardProps {
  candidate: ScoringCandidate;
  rank: number;
  treatment: Treatment;
  isInSession: boolean;
  sessionSize: number;
  onAddToSession: () => void;
  topScore: number;
}

function getMatchTier(score: number, topScore: number, rank: number): { label: string; className: string } | null {
  if (topScore === 0) return null;
  const ratio = score / topScore;
  if (rank === 1 || ratio >= 0.85) return { label: 'Best Match', className: 'tw-rec-match-badge tw-rec-match-badge--best' };
  if (ratio >= 0.5) return { label: 'Strong Match', className: 'tw-rec-match-badge tw-rec-match-badge--strong' };
  return { label: 'Good Match', className: 'tw-rec-match-badge tw-rec-match-badge--good' };
}

export function RecommendationCard({
  candidate,
  rank,
  treatment,
  isInSession,
  sessionSize,
  onAddToSession,
  topScore,
}: RecommendationCardProps): React.ReactElement {
  const analytics = useAnalytics();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const priceDisplay = treatment.priceLabel ?? `$${treatment.price}`;
  const matchTier = getMatchTier(candidate.score, topScore, rank);

  function handleAddToSession(): void {
    if (isInSession) return;
    analytics.fireItemAdded(treatment.id, treatment.name, sessionSize + 1);
    onAddToSession();
  }

  function handleLearnMore(): void {
    analytics.fireLearnMore(treatment.id, treatment.name);
  }

  function handleToggleDetails(): void {
    setDetailsOpen((prev) => !prev);
  }

  // Show only the first addressed-by explanation text (brief version on card)
  const briefWhy = candidate.addressedByTexts.length > 0 ? candidate.addressedByTexts[0] : null;

  return (
    <div className="tw-rec-card" data-treatment-id={treatment.id}>
      {/* Rank badge + name row */}
      <div className="tw-rec-rank-row">
        <span
          className={`tw-rec-rank${rank === 1 ? ' tw-rec-rank--top' : ''}`}
          aria-label={`Match number ${rank}`}
        >
          #{rank}
        </span>
        <p className="tw-rec-name">{treatment.name}</p>
        {matchTier && (
          <span className={matchTier.className} aria-label={matchTier.label}>
            {matchTier.label}
          </span>
        )}
      </div>

      <p className="tw-rec-price">{priceDisplay}</p>

      {/* Addresses: symptom pills */}
      {candidate.matchingSymptoms.length > 0 && (
        <div className="tw-rec-addresses">
          <span className="tw-rec-addresses-label">Addresses:</span>
          {candidate.matchingSymptoms.map((symptom) => (
            <span key={symptom} className="tw-rec-address-tag">
              {symptom}
            </span>
          ))}
        </div>
      )}

      {/* Brief why text */}
      {briefWhy && <p className="tw-rec-why">{briefWhy}</p>}

      {/* Expanded details (ingredients + best for) */}
      {detailsOpen && (
        <div id={`tw-details-${treatment.id}`}>
          {treatment.ingredients.length > 0 && (
            <div className="tw-result-ingredients" style={{ margin: '0', borderRadius: 'var(--tw-radius-md)' }}>
              <p className="tw-result-section-title">
                {treatment.category === 'lab' ? "What's tested" : "What's inside"}
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
          {treatment.bestFor.length > 0 && (
            <div className="tw-result-bestfor" style={{ padding: 'var(--tw-space-3) 0 0' }}>
              <span className="tw-result-bestfor-label">Best for:</span>
              <div className="tw-result-bestfor-tags">
                {treatment.bestFor.map((tag) => (
                  <span key={tag} className="tw-result-bestfor-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="tw-rec-actions">
        {isInSession ? (
          <span className="tw-btn-added" aria-label={`${treatment.name} added to session`}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
              <polyline points="2,7 5.5,10.5 12,3" />
            </svg>
            Added
          </span>
        ) : (
          <button
            type="button"
            className="tw-btn-add-session"
            aria-label={`Add ${treatment.name} to session`}
            onClick={handleAddToSession}
          >
            + Add to Session
          </button>
        )}

        <button
          type="button"
          className="tw-btn-details"
          aria-expanded={detailsOpen}
          aria-controls={`tw-details-${treatment.id}`}
          onClick={handleToggleDetails}
        >
          {detailsOpen ? 'Hide details' : 'View details'}
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
            {detailsOpen
              ? <polyline points="2,8 6,4 10,8" />
              : <polyline points="2,4 6,8 10,4" />}
          </svg>
        </button>

        {treatment.pageUrl && (
          <a
            className="tw-btn-details"
            href={treatment.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleLearnMore}
            aria-label={`Learn more about ${treatment.name}, opens in new tab`}
          >
            Learn more
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
              <line x1="2" y1="10" x2="10" y2="2" />
              <polyline points="6,2 10,2 10,6" />
            </svg>
          </a>
        )}
      </div>
    </div>
  );
}
