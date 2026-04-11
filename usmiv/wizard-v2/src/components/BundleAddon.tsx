import React from 'react';
import type { Treatment } from '../types/treatment';
import { useAnalytics } from '../hooks/useAnalytics';

interface BundleAddonProps {
  addOn: Treatment;
  label?: string;
  interactive: boolean;
  added: boolean;
  onToggle: () => void;
}

export function BundleAddon({
  addOn,
  label,
  interactive,
  added,
  onToggle,
}: BundleAddonProps): React.ReactElement {
  const analytics = useAnalytics();
  const priceDisplay = addOn.priceLabel ?? `$${addOn.price}`;
  const displayLabel = label ?? `Add ${addOn.name} (+${priceDisplay})`;

  function handleToggle(): void {
    analytics.fireAddonToggled(addOn.id, addOn.name, !added);
    // v1 bug fix: dispatches to state via onToggle (which calls dispatch TOGGLE_BUNDLE_ADDON),
    // so bundleAddonAdded is written to booking state rather than being purely visual.
    onToggle();
  }

  return (
    <div className={`tw-result-bundle${added ? ' tw-result-bundle--added' : ''}`}>
      <div className="tw-result-bundle-icon" aria-hidden="true">
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2l1.5 3 3.5.5-2.5 2.5.6 3.5L9 10 6.9 11.5l.6-3.5L5 5.5 8.5 5z" />
        </svg>
      </div>

      <div className="tw-result-bundle-text">
        <span className="tw-result-bundle-label">{displayLabel}</span>
        <span className="tw-result-bundle-desc">{addOn.shortDesc}</span>

        {interactive ? (
          <button
            type="button"
            className={`tw-btn-bundle-toggle${added ? ' tw-btn-bundle-toggle--added' : ''}`}
            role="switch"
            aria-checked={added}
            aria-label={added ? `Remove ${addOn.name}` : `Add ${addOn.name}`}
            onClick={handleToggle}
          >
            {added ? (
              <>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                  <polyline points="2,7 5.5,10.5 12,3" />
                </svg>
                Added
              </>
            ) : (
              <>
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                  <line x1="7" y1="2" x2="7" y2="12" />
                  <line x1="2" y1="7" x2="12" y2="7" />
                </svg>
                Add to Session
              </>
            )}
          </button>
        ) : (
          // Static display (e.g., weight loss consultation — phone call required)
          <span className="tw-result-bundle-desc" style={{ fontStyle: 'italic' }}>
            Included with this program
          </span>
        )}
      </div>
    </div>
  );
}
