import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WizardState, WizardAction } from '../types/state';
import { META, TREATMENTS, BUNDLES } from '../data';
import { useAcuityTimes } from '../hooks/useAcuityTimes';
import { useAnalytics } from '../hooks/useAnalytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO datetime string as "10:00 AM" in the user's local timezone. */
function formatTimeDisplay(isoTime: string): string {
  const d = new Date(isoTime);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

/** Format a YYYY-MM-DD date string as "Saturday, April 12" for display. */
function formatDateDisplay(dateStr: string): string {
  // Parse as local date to avoid UTC-offset surprises
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TimeSlotSkeleton(): React.ReactElement {
  return (
    <div className="tw-skeleton-timeslots" aria-hidden="true">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="tw-skeleton tw-skeleton-timeslot" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error card
// ---------------------------------------------------------------------------

interface ErrorCardProps {
  onRetry: () => void;
  fallbackUrl: string;
}

function ErrorCard({ onRetry, fallbackUrl }: ErrorCardProps): React.ReactElement {
  return (
    <div className="tw-booking-error" role="alert">
      <p className="tw-booking-error-title">Unable to load available times</p>
      <p className="tw-booking-error-text">
        We could not connect to the scheduling system. You can retry or book directly.
      </p>
      <div className="tw-booking-error-actions">
        <button type="button" className="tw-btn-retry" onClick={onRetry}>
          Try Again
        </button>
        <a
          href={fallbackUrl}
          className="tw-booking-fallback-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Book Directly
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Time slot grid
// ---------------------------------------------------------------------------

interface TimeSlotGridProps {
  times: readonly { time: string; slotsAvailable: number }[];
  selectedTime: string | null;
  onSelectTime: (isoTime: string) => void;
}

function TimeSlotGrid({ times, selectedTime, onSelectTime }: TimeSlotGridProps): React.ReactElement {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (focusedIndex !== null) {
      buttonRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  function handleKeyDown(e: React.KeyboardEvent, index: number): void {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = index < times.length - 1 ? index + 1 : null;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = index > 0 ? index - 1 : null;
    }
    if (next !== null) {
      e.preventDefault();
      setFocusedIndex(next);
    }
  }

  if (times.length === 0) {
    return (
      <div className="tw-timeslots">
        <p className="tw-booking-subtitle" style={{ margin: 0 }}>
          No times available for this date. Please select another date.
        </p>
      </div>
    );
  }

  return (
    <div className="tw-timeslots">
      <p className="tw-timeslots-title">Available Times</p>
      <div
        className="tw-timeslots-grid"
        role="listbox"
        aria-label="Available times"
        aria-orientation="horizontal"
      >
        {times.map((slot, index) => {
          const isSelected = selectedTime === slot.time;
          const label = formatTimeDisplay(slot.time);
          const cls = isSelected
            ? 'tw-timeslot tw-timeslot--selected'
            : 'tw-timeslot';

          return (
            <button
              key={slot.time}
              ref={(el) => { buttonRefs.current[index] = el; }}
              type="button"
              className={cls}
              role="option"
              aria-selected={isSelected}
              tabIndex={index === 0 ? 0 : -1}
              onClick={() => onSelectTime(slot.time)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Treatment summary bar
// ---------------------------------------------------------------------------

interface TreatmentSummaryProps {
  treatmentName: string;
  priceLabel: string;
  selectedDate: string;
}

function TreatmentSummary({ treatmentName, priceLabel, selectedDate }: TreatmentSummaryProps): React.ReactElement {
  return (
    <div className="tw-booking-header">
      <h2 className="tw-booking-title">Select a Time</h2>
      <p className="tw-booking-subtitle">
        {treatmentName}
        {priceLabel ? ` \u00b7 ${priceLabel}` : ''}
        {' \u00b7 '}
        {formatDateDisplay(selectedDate)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

/**
 * Builds the pre-filled Acuity booking URL.
 * Mirrors buildSmartAcuityUrl from engine/acuity.ts but uses the
 * data/meta.ts WizardMeta shape (acuityBaseUrl rather than acuityScheduleBase).
 */
function buildBookingUrl(
  acuityTypeId: number,
  selectedTime: string,
  acuityDropdownValue: string | null,
  sessionPlan: WizardState['sessionPlan'],
  bundleAddonAdded: boolean,
  bundleAddonName: string | null,
): string {
  const params = new URLSearchParams();
  params.set('appointmentTypeID', String(acuityTypeId));
  params.set('datetime', selectedTime);

  if (acuityDropdownValue) {
    params.set('field:' + META.acuityFieldId, acuityDropdownValue);
  }

  const addOnNames: string[] = [];
  if (bundleAddonAdded && bundleAddonName) {
    addOnNames.push(bundleAddonName);
  }
  for (const item of sessionPlan) {
    if (item.isInjection) {
      addOnNames.push(item.name);
    }
  }
  if (addOnNames.length > 0) {
    const primaryName = sessionPlan.find((i) => !i.isInjection)?.name ?? '';
    params.set('notes', `Session: ${primaryName} + ${addOnNames.join(', ')}`);
  }

  return `${META.acuityBaseUrl}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// BookingTimeStep
// ---------------------------------------------------------------------------

interface BookingTimeStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function BookingTimeStep({ state, dispatch }: BookingTimeStepProps): React.ReactElement {
  const analytics = useAnalytics();
  const { booking, sessionPlan, bundleAddonAdded } = state;

  const acuityTypeId = booking.acuityTypeId ?? 0;
  const selectedDate = booking.selectedDate ?? '';
  const proxyBase = META.acuityAvailabilityUrl;

  const { times, loading, error, refetch } = useAcuityTimes(proxyBase, acuityTypeId, selectedDate);

  // Direct fallback URL (also shown in nav bar)
  const fallbackUrl = `${META.acuityBaseUrl}?appointmentTypeID=${acuityTypeId}`;

  // Resolve treatment name and price for summary bar
  const { treatmentName, priceLabel, bundleAddonName } = (() => {
    if (!booking.treatmentId) {
      return { treatmentName: 'Your Treatment', priceLabel: '', bundleAddonName: null };
    }
    const t = TREATMENTS[booking.treatmentId];
    if (t) {
      return {
        treatmentName: t.name,
        priceLabel: t.priceLabel ?? `$${t.price}`,
        bundleAddonName: null,
      };
    }
    const b = BUNDLES[booking.treatmentId as keyof typeof BUNDLES];
    if (b) {
      const addOnName = b.addOn ? (TREATMENTS[b.addOn]?.name ?? null) : null;
      const primary = TREATMENTS[b.primary];
      const price = primary ? (primary.priceLabel ?? `$${primary.price}`) : '';
      return {
        treatmentName: b.name,
        priceLabel: price,
        bundleAddonName: addOnName,
      };
    }
    return { treatmentName: 'Your Treatment', priceLabel: '', bundleAddonName: null };
  })();

  const handleSelectTime = useCallback(
    (isoTime: string) => {
      // Dispatch SELECT_TIME to update state
      dispatch({ type: 'SELECT_TIME', time: isoTime });

      // Fire analytics
      analytics.fireTimeSelected(selectedDate, isoTime, booking.treatmentId ?? '');
      analytics.fireBookClicked(
        booking.treatmentId ?? '',
        treatmentName,
        'inline_availability',
      );

      // Build and open the pre-filled Acuity URL
      const url = buildBookingUrl(
        acuityTypeId,
        isoTime,
        booking.acuityDropdownValue,
        sessionPlan,
        bundleAddonAdded,
        bundleAddonName,
      );
      window.open(url, '_blank', 'noopener,noreferrer');

      // Close the wizard
      dispatch({ type: 'CLOSE' });
    },
    [
      dispatch,
      analytics,
      selectedDate,
      booking.treatmentId,
      booking.acuityDropdownValue,
      treatmentName,
      acuityTypeId,
      sessionPlan,
      bundleAddonAdded,
      bundleAddonName,
    ],
  );

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  return (
    <div className="tw-booking">
      {/* Treatment summary header */}
      {selectedDate && (
        <TreatmentSummary
          treatmentName={treatmentName}
          priceLabel={priceLabel}
          selectedDate={selectedDate}
        />
      )}

      {/* Loading */}
      {loading && <TimeSlotSkeleton />}

      {/* Error */}
      {!loading && error && (
        <ErrorCard onRetry={refetch} fallbackUrl={fallbackUrl} />
      )}

      {/* Time slots */}
      {!loading && !error && (
        <TimeSlotGrid
          times={times}
          selectedTime={booking.selectedTime}
          onSelectTime={handleSelectTime}
        />
      )}

      {/* Sticky nav bar */}
      <div className="tw-booking-nav">
        <button type="button" className="tw-btn-back" onClick={handleBack}>
          Back
        </button>
        <a
          href={fallbackUrl}
          className="tw-booking-fallback-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Book Directly on Acuity
        </a>
      </div>
    </div>
  );
}
