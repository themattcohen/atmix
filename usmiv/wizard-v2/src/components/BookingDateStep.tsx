import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { WizardState, WizardAction } from '../types/state';
import { META, TREATMENTS, BUNDLES } from '../data';
import { useAcuityDates } from '../hooks/useAcuityDates';
import { useAnalytics } from '../hooks/useAnalytics';
import { RULES } from '../constants/rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toYYYYMM(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function toYYYYMMDD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function todayYYYYMMDD(): string {
  const d = new Date();
  return toYYYYMMDD(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Return the index of the day-of-week for the 1st of the given month (0=Sun). */
function firstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CalendarSkeleton(): React.ReactElement {
  return (
    <>
      <div className="tw-skeleton tw-skeleton-calendar" aria-hidden="true" />
      <div className="tw-skeleton-timeslots" style={{ marginTop: '1rem' }} aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="tw-skeleton tw-skeleton-timeslot" />
        ))}
      </div>
    </>
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
      <p className="tw-booking-error-title">Unable to load available dates</p>
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
// Calendar grid
// ---------------------------------------------------------------------------

interface CalendarGridProps {
  year: number;
  month: number;
  availableDates: ReadonlySet<string>;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
}

function CalendarGrid({
  year,
  month,
  availableDates,
  selectedDate,
  onSelectDate,
}: CalendarGridProps): React.ReactElement {
  const today = todayYYYYMMDD();
  const startDow = firstDayOfWeek(year, month);
  const totalDays = daysInMonth(year, month);

  // Total cells = leading empties + days. Round up to full week rows.
  const totalCells = Math.ceil((startDow + totalDays) / 7) * 7;

  // Keyboard navigation: track focused cell index within the grid
  const [focusedDay, setFocusedDay] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus management: when focusedDay changes, move DOM focus
  useEffect(() => {
    if (focusedDay !== null) {
      cellRefs.current[focusedDay - 1]?.focus();
    }
  }, [focusedDay]);

  function handleKeyDown(e: React.KeyboardEvent, day: number): void {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = day < totalDays ? day + 1 : null;
    if (e.key === 'ArrowLeft') next = day > 1 ? day - 1 : null;
    if (e.key === 'ArrowDown') next = day + 7 <= totalDays ? day + 7 : null;
    if (e.key === 'ArrowUp') next = day - 7 >= 1 ? day - 7 : null;
    if (next !== null) {
      e.preventDefault();
      setFocusedDay(next);
    }
  }

  const cells: React.ReactNode[] = [];

  // Leading empty cells
  for (let i = 0; i < startDow; i++) {
    cells.push(
      <div
        key={`empty-${i}`}
        className="tw-calendar-day tw-calendar-day--empty"
        role="gridcell"
        aria-hidden="true"
      />,
    );
  }

  // Day cells
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = toYYYYMMDD(year, month, day);
    const isAvailable = availableDates.has(dateStr);
    const isSelected = selectedDate === dateStr;
    const isToday = today === dateStr;

    let cls = 'tw-calendar-day';
    if (isSelected) cls += ' tw-calendar-day--selected';
    else if (isAvailable) cls += ' tw-calendar-day--available';
    else cls += ' tw-calendar-day--unavailable';
    if (isToday) cls += ' tw-calendar-day--today';

    const label = `${MONTH_NAMES[month]} ${day}${isAvailable ? ', available' : ', unavailable'}`;

    cells.push(
      <button
        key={dateStr}
        ref={(el) => { cellRefs.current[day - 1] = el; }}
        type="button"
        className={cls}
        role="gridcell"
        aria-label={label}
        aria-selected={isSelected}
        aria-disabled={!isAvailable}
        disabled={!isAvailable}
        tabIndex={isAvailable ? 0 : -1}
        onClick={isAvailable ? () => onSelectDate(dateStr) : undefined}
        onKeyDown={(e) => handleKeyDown(e, day)}
      >
        {day}
      </button>,
    );
  }

  // Trailing empty cells
  for (let i = startDow + totalDays; i < totalCells; i++) {
    cells.push(
      <div
        key={`trail-${i}`}
        className="tw-calendar-day tw-calendar-day--empty"
        role="gridcell"
        aria-hidden="true"
      />,
    );
  }

  return (
    <>
      <div className="tw-calendar-weekdays" role="row" aria-hidden="true">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="tw-calendar-weekday">{d}</div>
        ))}
      </div>
      <div
        className="tw-calendar-grid"
        role="grid"
        aria-label={`${MONTH_NAMES[month]} ${year}`}
      >
        {cells}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// BookingDateStep
// ---------------------------------------------------------------------------

interface BookingDateStepProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function BookingDateStep({ state, dispatch }: BookingDateStepProps): React.ReactElement {
  const analytics = useAnalytics();
  const { booking } = state;
  const acuityTypeId = booking.acuityTypeId ?? 0;

  // Determine the starting month (today's month)
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  const monthStr = toYYYYMM(viewYear, viewMonth);
  const proxyBase = META.acuityAvailabilityUrl;

  const { dates, loading, error, refetch } = useAcuityDates(proxyBase, acuityTypeId, monthStr);

  // Screen reader announcement for month changes
  const [announcement, setAnnouncement] = useState('');

  // Build a Set of available date strings for fast lookup
  const availableDates = new Set(dates.map((d) => d.date));

  // Direct fallback URL
  const fallbackUrl = `${META.acuityBaseUrl}?appointmentTypeID=${acuityTypeId}`;

  // Month navigation bounds
  const todayDate = new Date();
  const minYear = todayDate.getFullYear();
  const minMonth = todayDate.getMonth();
  const maxDate = new Date(minYear, minMonth + RULES.MAX_BOOKING_MONTHS_FORWARD, 1);
  const isAtMin = viewYear < minYear || (viewYear === minYear && viewMonth <= minMonth);
  const isAtMax =
    viewYear > maxDate.getFullYear() ||
    (viewYear === maxDate.getFullYear() && viewMonth >= maxDate.getMonth());

  const handlePrevMonth = useCallback(() => {
    if (isAtMin) return;
    const newDate = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(newDate.getFullYear());
    setViewMonth(newDate.getMonth());
    setAnnouncement(`${MONTH_NAMES[newDate.getMonth()]} ${newDate.getFullYear()}`);
  }, [isAtMin, viewYear, viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (isAtMax) return;
    const newDate = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(newDate.getFullYear());
    setViewMonth(newDate.getMonth());
    setAnnouncement(`${MONTH_NAMES[newDate.getMonth()]} ${newDate.getFullYear()}`);
  }, [isAtMax, viewYear, viewMonth]);

  const handleSelectDate = useCallback(
    (dateStr: string) => {
      analytics.fireDateSelected(dateStr);
      dispatch({ type: 'SELECT_DATE', date: dateStr });
    },
    [analytics, dispatch],
  );

  const handleBack = () => {
    dispatch({ type: 'GO_BACK' });
  };

  // Resolve treatment name for header subtitle
  const treatmentName: string = (() => {
    if (!booking.treatmentId) return 'your treatment';
    const t = TREATMENTS[booking.treatmentId];
    if (t) return t.name;
    const b = BUNDLES[booking.treatmentId as keyof typeof BUNDLES];
    if (b) return b.name;
    return 'your treatment';
  })();

  return (
    <div className="tw-booking">
      {/* Screen reader live region for month announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="tw-sr-only"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {announcement}
      </div>

      {/* Header */}
      <div className="tw-booking-header">
        <h2 className="tw-booking-title">Select a Date</h2>
        <p className="tw-booking-subtitle">
          Choose an available date for {String(treatmentName)}
        </p>
      </div>

      {/* Calendar content */}
      <div className="tw-calendar">
        {/* Month navigation */}
        <div className="tw-calendar-nav">
          <button
            type="button"
            className="tw-btn-month-prev"
            aria-label="Previous month"
            disabled={isAtMin}
            onClick={handlePrevMonth}
          >
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="11 14 6 9 11 4" />
            </svg>
          </button>

          <p className="tw-calendar-month" aria-live="polite" aria-atomic="true">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>

          <button
            type="button"
            className="tw-btn-month-next"
            aria-label="Next month"
            disabled={isAtMax}
            onClick={handleNextMonth}
          >
            <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="7 4 12 9 7 14" />
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && <CalendarSkeleton />}

        {/* Error */}
        {!loading && error && (
          <ErrorCard onRetry={refetch} fallbackUrl={fallbackUrl} />
        )}

        {/* Calendar grid */}
        {!loading && !error && (
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            availableDates={availableDates}
            selectedDate={booking.selectedDate}
            onSelectDate={handleSelectDate}
          />
        )}
      </div>

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
