import React from 'react';
import type { Treatment } from '../types/treatment';
import { useAnalytics } from '../hooks/useAnalytics';

interface AddonChipProps {
  treatment: Treatment;
  added: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function AddonChip({
  treatment,
  added,
  onToggle,
  disabled = false,
}: AddonChipProps): React.ReactElement {
  const analytics = useAnalytics();
  const priceDisplay = treatment.priceLabel ?? `$${treatment.price}`;

  function handleClick(): void {
    if (disabled && !added) return;
    analytics.fireAddonToggled(treatment.id, treatment.name, !added);
    onToggle();
  }

  const ariaLabel = added
    ? `Remove ${treatment.name} ${priceDisplay}`
    : `Add ${treatment.name} ${priceDisplay}`;

  return (
    <button
      type="button"
      className={`tw-addon-chip${added ? ' tw-addon-chip--added' : ''}`}
      role="switch"
      aria-checked={added}
      aria-label={ariaLabel}
      disabled={disabled && !added}
      onClick={handleClick}
    >
      <span className="tw-addon-chip-icon" aria-hidden="true">
        {added ? (
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="10" height="10">
            <polyline points="2,7 5.5,10.5 12,3" />
          </svg>
        ) : (
          '+'
        )}
      </span>
      <span className="tw-addon-chip-name">{treatment.name}</span>
      <span className="tw-addon-chip-price">{priceDisplay}</span>
    </button>
  );
}
