import React, { useState } from 'react';
import type { SessionItem } from '../types/session';
import type { TreatmentId } from '../types/treatment';
import type { WizardMeta } from '../data/meta';
import { calculateSessionTotal } from '../engine/session';
import { RULES } from '../constants/rules';

interface SessionPlanProps {
  items: readonly SessionItem[];
  meta: WizardMeta;
  onRemove: (treatmentId: TreatmentId) => void;
  onBook: () => void;
}

export function SessionPlan({
  items,
  meta: _meta,
  onRemove,
  onBook,
}: SessionPlanProps): React.ReactElement | null {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const total = calculateSessionTotal(items);
  const hasInjections = items.some((i) => i.isInjection);
  const injectionCount = items.filter((i) => i.isInjection).length;

  return (
    <div className={`tw-session-plan${collapsed ? ' tw-session-plan--collapsed' : ''}`} aria-label="Your session plan">
      {/* Collapse toggle (for mobile) */}
      <button
        type="button"
        className="tw-btn-session-toggle"
        aria-expanded={!collapsed}
        aria-controls="tw-session-items"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        {collapsed ? 'Show session' : 'Hide session'}
        <svg viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="8" aria-hidden="true">
          {collapsed
            ? <polyline points="1,1 6,7 11,1" />
            : <polyline points="1,7 6,1 11,7" />}
        </svg>
      </button>

      {/* Items list */}
      <ul className="tw-session-items" id="tw-session-items" aria-label="Session items">
        {items.map((item) => (
          <li key={item.treatmentId} className="tw-session-item">
            <span className="tw-session-item-name">{item.name}</span>
            <span className="tw-session-item-price">
              {item.priceLabel ?? `$${item.price}`}
            </span>
            <button
              type="button"
              className="tw-btn-remove-item"
              aria-label={`Remove ${item.name} from session`}
              onClick={() => onRemove(item.treatmentId)}
            >
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="2" y1="2" x2="12" y2="12" />
                <line x1="12" y1="2" x2="2" y2="12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      {/* Injection promo notice */}
      {hasInjections && injectionCount < RULES.MAX_INJECTIONS && (
        <p className="tw-session-promo" aria-live="polite">
          {RULES.INJECTION_PROMO_TEXT}
        </p>
      )}

      {/* Total row */}
      <div className="tw-session-total-row">
        <span className="tw-session-total-label">Session total</span>
        <span className="tw-session-total-price">${total}</span>
      </div>

      {/* Book session CTA */}
      <button
        type="button"
        className="tw-btn-book-session"
        onClick={onBook}
        aria-label="Book your session"
      >
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
          <rect x="2" y="3" width="14" height="13" rx="2" />
          <line x1="2" y1="7" x2="16" y2="7" />
          <line x1="6" y1="1" x2="6" y2="5" />
          <line x1="12" y1="1" x2="12" y2="5" />
        </svg>
        Book Your Session
      </button>
    </div>
  );
}
