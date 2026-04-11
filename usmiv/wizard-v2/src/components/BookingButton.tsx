import React from 'react';
import type { WizardMeta } from '../data/meta';
import type { Treatment } from '../types/treatment';
import type { Bundle } from '../types/bundle';
import type { SessionItem } from '../types/session';
import type { WizardAction } from '../types/state';
import { useAnalytics } from '../hooks/useAnalytics';

interface BookingButtonProps {
  treatment: Treatment | Bundle;
  bundleAddonAdded: boolean;
  sessionPlan: readonly SessionItem[];
  meta: WizardMeta;
  dispatch: React.Dispatch<WizardAction>;
  label?: string;
}

function getTreatmentId(t: Treatment | Bundle): string {
  return t.id;
}

function getAcuityTypeId(t: Treatment | Bundle): number {
  return t.acuityTypeId;
}

function getAcuityDropdownValue(t: Treatment | Bundle): string | null {
  return t.acuityDropdownValue;
}

function isTreatment(t: Treatment | Bundle): t is Treatment {
  return 'price' in t && 'category' in t;
}

function isBundle(t: Treatment | Bundle): t is Bundle {
  return 'primary' in t;
}

export function BookingButton({
  treatment,
  bundleAddonAdded: _bundleAddonAdded,
  sessionPlan,
  meta,
  dispatch,
  label,
}: BookingButtonProps): React.ReactElement {
  const analytics = useAnalytics();
  const hasMultipleItems = sessionPlan.length > 1;
  const buttonLabel = label ?? (hasMultipleItems ? 'Book Your Session' : 'Book This Treatment');

  const treatmentId = getTreatmentId(treatment);
  const treatmentName = isTreatment(treatment) ? treatment.name : (isBundle(treatment) ? treatment.name : '');
  const acuityTypeId = getAcuityTypeId(treatment);
  const acuityDropdownValue = getAcuityDropdownValue(treatment);

  // Use the availability proxy for inline booking if configured.
  // If proxyBase/acuityAvailabilityUrl is non-empty, trigger the inline date/time flow.
  // Otherwise fall back to a direct Acuity link.
  const proxyBase = meta.acuityAvailabilityUrl ?? '';
  const useInlineBooking = proxyBase.length > 0;

  function buildDirectUrl(): string {
    return `${meta.acuityBaseUrl}?appointmentTypeID=${acuityTypeId}`;
  }

  function handleClick(e: React.MouseEvent): void {
    analytics.fireBookClicked(treatmentId, treatmentName);

    if (useInlineBooking) {
      e.preventDefault();
      analytics.fireBookingStarted(treatmentId);
      dispatch({
        type: 'START_BOOKING',
        treatmentId: treatmentId as import('../types/treatment').TreatmentId,
        acuityTypeId,
        acuityDropdownValue,
      });
    }
    // If not inline booking, the <a> tag handles navigation naturally.
  }

  if (useInlineBooking) {
    return (
      <button
        type="button"
        className="tw-btn-primary"
        onClick={handleClick}
        aria-label={buttonLabel}
      >
        <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="14" height="13" rx="2" />
          <line x1="2" y1="7" x2="16" y2="7" />
          <line x1="6" y1="1" x2="6" y2="5" />
          <line x1="12" y1="1" x2="12" y2="5" />
        </svg>
        {buttonLabel}
      </button>
    );
  }

  return (
    <a
      href={buildDirectUrl()}
      className="tw-btn-primary"
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label={buttonLabel}
    >
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="14" height="13" rx="2" />
        <line x1="2" y1="7" x2="16" y2="7" />
        <line x1="6" y1="1" x2="6" y2="5" />
        <line x1="12" y1="1" x2="12" y2="5" />
      </svg>
      {buttonLabel}
    </a>
  );
}
