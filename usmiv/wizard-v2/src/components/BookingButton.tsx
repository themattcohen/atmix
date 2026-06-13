import React from 'react';
import type { Treatment } from '../types/treatment';
import type { Bundle } from '../types/bundle';
import type { SessionItem } from '../types/session';
import type { WizardMeta } from '../data/meta';
import type { WizardAction } from '../types/state';
import { useAnalytics } from '../hooks/useAnalytics';
import { mangomintBookingUrl } from '../data/mangomint';

interface BookingButtonProps {
  treatment: Treatment | Bundle;
  bundleAddonAdded: boolean;
  sessionPlan: readonly SessionItem[];
  meta: WizardMeta;
  dispatch: React.Dispatch<WizardAction>;
  label?: string;
}

function isTreatment(t: Treatment | Bundle): t is Treatment {
  return 'price' in t && 'category' in t;
}

export function BookingButton({
  treatment,
  sessionPlan,
}: BookingButtonProps): React.ReactElement {
  const analytics = useAnalytics();
  const hasMultipleItems = sessionPlan.length > 1;
  const buttonLabel = hasMultipleItems ? 'Book Your Session' : 'Book This Treatment';

  const treatmentId = treatment.id;
  const treatmentName = isTreatment(treatment) ? treatment.name : treatment.name;

  // Pass id + category to the URL helper so it can pick the right serviceId/serviceCategoryId.
  // Bundles don't have a category field; the helper falls back to a service-ID lookup or BASE.
  const bookingHref = mangomintBookingUrl(
    isTreatment(treatment)
      ? { id: treatmentId, category: treatment.category }
      : { id: treatmentId }
  );

  function handleClick(): void {
    analytics.fireBookClicked(treatmentId, treatmentName);
    // No preventDefault — let the <a> navigate so Mangomint's embed script
    // intercepts via event delegation and opens the overlay in-page.
  }

  return (
    <a
      href={bookingHref}
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
    </a>
  );
}
