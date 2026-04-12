/**
 * OnboardingTour.tsx -- Interactive step-by-step tour for the Wizard Admin Dashboard.
 *
 * Renders a welcome screen on first visit, then a spotlight+tooltip walkthrough
 * of each major dashboard tab. localStorage key: `wizard-admin-tour-seen`.
 *
 * Never imported from production builds -- only used by WizardDevDashboard.tsx,
 * which itself is guarded by `import.meta.env.DEV`.
 */

import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import '../../styles/dev/tour.css';

// ── Types ────────────────────────────────────────────────────────────────────

export type TourPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** CSS selector for the element to spotlight. Empty string = no spotlight (centered tooltip). */
  target: string;
  title: string;
  description: string | React.ReactNode;
  /** If set, call onSwitchTab with this value before showing the step. */
  tabToActivate?: string;
  position: TourPosition;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPos {
  top: number;
  left: number;
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchTab: (tab: string) => void;
}

// ── Tour step definitions ────────────────────────────────────────────────────

const TOUR_STEPS: TourStep[] = [
  {
    target: '',
    title: 'How patients use the wizard',
    description: (
      <>
        Before managing treatments, it helps to understand how a patient experiences the wizard.
        They answer a series of questions — "What are you looking for?" then "Which feeling best describes you?" — and
        the wizard recommends the right treatment at the end. Every path through those questions must lead somewhere.
        This dashboard shows you what those paths are and whether they all work correctly.
      </>
    ),
    tabToActivate: 'editor',
    position: 'bottom',
  },
  {
    target: '[data-tour="editor-tab"]',
    title: 'Managing your treatments',
    description: (
      <>
        The Editor is where you update treatment details — pricing, description, ingredients, and add-on suggestions.
        Select any treatment from the sidebar on the left to edit it.
        <br /><br />
        The <strong>scoring weights</strong> control how the wizard ranks multiple matching treatments. A higher
        weight means the wizard is more likely to recommend that treatment when several could fit a patient's answers.
        Most treatments can stay at the default weight unless you want to push a specific option.
      </>
    ),
    tabToActivate: 'editor',
    position: 'bottom',
  },
  {
    target: '[data-tour="paths-tab"]',
    title: 'How patients find each treatment',
    description: (
      <>
        Every treatment is reached through a specific sequence of question answers. The Paths tab shows you every
        route patients can take through the wizard, and which treatment each route ends at.
        <br /><br />
        Switch to <strong>"By Treatment"</strong> to see all routes that lead to one specific treatment. If a treatment
        shows zero paths, no patient can ever find it — that's either intentional (it's meant to be off-menu) or a bug
        you'll want to fix.
        <br /><br />
        Example: the Hangover IV is reached when a patient picks "I need relief right now" then "Hangover." You'd see
        that exact sequence listed here.
      </>
    ),
    tabToActivate: 'paths',
    position: 'bottom',
  },
  {
    target: '[data-tour="flow-tab"]',
    title: 'Visual map of the entire wizard',
    description: (
      <>
        The Flow view draws the whole wizard as a tree. Blue boxes are questions; colored pills are treatments. Follow
        any branch from left to right to trace a patient's journey from their first answer to their final recommendation.
        <br /><br />
        Click any treatment pill to see which question paths lead to it. Use this tab when you want to understand the
        big picture — for example, to check that a new question branch actually connects to the right treatments, or to
        spot questions that lead to dead ends.
        <br /><br />
        Use the zoom controls to navigate. Collapse branches to reduce noise when you're focused on one area.
      </>
    ),
    tabToActivate: 'tree',
    position: 'bottom',
  },
  {
    target: '[data-tour="coverage-tab"]',
    title: 'Spotting missing or incomplete data',
    description: (
      <>
        Coverage gives you a one-page health check across all treatments. Each column is a data field; each row is a
        treatment. The color tells you the status:
        <br /><br />
        <strong style={{ color: '#16a34a' }}>Green</strong> — complete and correct.{' '}
        <strong style={{ color: '#ca8a04' }}>Yellow</strong> — working but missing something optional (like a
        description or an ingredient list). Fix these to improve what patients see.{' '}
        <strong style={{ color: '#dc2626' }}>Red</strong> — a real error that will cause problems.
        <br /><br />
        Hover any column header for a plain-English explanation of what that field does. Click <strong>Edit</strong> on
        any row to jump straight to that treatment in the Editor.
      </>
    ),
    tabToActivate: 'coverage',
    position: 'bottom',
  },
  {
    target: '[data-tour="health-tab"]',
    title: 'Finding and fixing problems',
    description: (
      <>
        The Health tab runs a full check of your configuration every time you open it. Each issue tells you exactly
        what's wrong, why it matters for patients, and the specific steps to fix it.
        <br /><br />
        Start here after making any changes to the wizard config. If Health shows zero issues, you're in good shape.
        Click <strong>"Fix in Editor"</strong> on any issue to go directly to the treatment that needs attention.
        <br /><br />
        That's the whole dashboard. A good weekly habit: open Coverage to scan for yellows, then open Health to check
        for errors. The Editor is where you make the actual changes.
      </>
    ),
    tabToActivate: 'validation',
    position: 'bottom',
  },
];

const TOOLTIP_GAP = 14;   // px between spotlight ring and tooltip edge
const TOOLTIP_WIDTH = 380; // must match CSS max-width
const TOOLTIP_PADDING = 12; // viewport edge padding

// ── Geometry helpers ─────────────────────────────────────────────────────────

function getSpotlightRect(selector: string): SpotlightRect | null {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const pad = 6;
  return {
    top: r.top - pad,
    left: r.left - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function computeTooltipPos(
  spotlight: SpotlightRect | null,
  position: TourPosition,
  tooltipHeight: number,
): TooltipPos {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!spotlight) {
    // Centered fallback
    return {
      top: Math.max(TOOLTIP_PADDING, (vh - tooltipHeight) / 2),
      left: Math.max(TOOLTIP_PADDING, (vw - TOOLTIP_WIDTH) / 2),
    };
  }

  let top = 0;
  let left = 0;

  switch (position) {
    case 'bottom':
      top = spotlight.top + spotlight.height + TOOLTIP_GAP;
      left = spotlight.left;
      break;
    case 'top':
      top = spotlight.top - tooltipHeight - TOOLTIP_GAP;
      left = spotlight.left;
      break;
    case 'right':
      top = spotlight.top;
      left = spotlight.left + spotlight.width + TOOLTIP_GAP;
      break;
    case 'left':
      top = spotlight.top;
      left = spotlight.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
      break;
  }

  // Clamp to viewport
  left = Math.max(TOOLTIP_PADDING, Math.min(left, vw - TOOLTIP_WIDTH - TOOLTIP_PADDING));
  top = Math.max(TOOLTIP_PADDING, Math.min(top, vh - tooltipHeight - TOOLTIP_PADDING));

  return { top, left };
}

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingTour({ isOpen, onClose, onSwitchTab }: OnboardingTourProps): React.ReactElement | null {
  // -1 = welcome screen; 0-N = step index
  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0 });
  const [tooltipHeight, setTooltipHeight] = useState<number>(200);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const welcomeStartRef = useRef<HTMLButtonElement>(null);
  const tooltipNextRef = useRef<HTMLButtonElement>(null);

  // Reset to welcome screen whenever the tour is opened
  useEffect(() => {
    if (isOpen) {
      setStepIndex(-1);
    }
  }, [isOpen]);

  // Move focus to primary action when step or screen changes
  useEffect(() => {
    if (!isOpen) return;
    if (stepIndex === -1) {
      // Small delay to let the DOM render
      const t = setTimeout(() => welcomeStartRef.current?.focus(), 50);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => tooltipNextRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [isOpen, stepIndex]);

  // Global Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const positionTooltip = useCallback(
    (idx: number, height: number) => {
      if (idx < 0 || idx >= TOUR_STEPS.length) return;
      const step = TOUR_STEPS[idx];
      const rect = getSpotlightRect(step.target);
      setSpotlight(rect);
      setTooltipPos(computeTooltipPos(rect, step.position, height));
    },
    [],
  );

  // After stepping to a new index, measure tooltip height then position
  useLayoutEffect(() => {
    if (!isOpen || stepIndex < 0) return;
    const h = tooltipRef.current?.offsetHeight ?? tooltipHeight;
    setTooltipHeight(h);
    positionTooltip(stepIndex, h);
  }, [isOpen, stepIndex, positionTooltip, tooltipHeight]);

  // Reposition on resize
  useEffect(() => {
    if (!isOpen || stepIndex < 0) return;
    const handleResize = () => {
      const h = tooltipRef.current?.offsetHeight ?? tooltipHeight;
      positionTooltip(stepIndex, h);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, stepIndex, positionTooltip, tooltipHeight]);

  const goToStep = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= TOUR_STEPS.length) return;
      const step = TOUR_STEPS[idx];
      if (step.tabToActivate) {
        onSwitchTab(step.tabToActivate);
      }
      // Wait a tick for the tab content to render before measuring
      requestAnimationFrame(() => {
        setStepIndex(idx);
      });
    },
    [onSwitchTab],
  );

  const handleStartTour = useCallback(() => {
    goToStep(0);
  }, [goToStep]);

  const handleNext = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      goToStep(stepIndex + 1);
    } else {
      // Final step -- complete tour
      localStorage.setItem('wizard-admin-tour-seen', '1');
      onSwitchTab('editor');
      onClose();
    }
  }, [stepIndex, goToStep, onSwitchTab, onClose]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
    }
  }, [stepIndex, goToStep]);

  const handleSkip = useCallback(() => {
    localStorage.setItem('wizard-admin-tour-seen', '1');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  // ── Welcome screen ───────────────────────────────────────────────────────

  if (stepIndex === -1) {
    return (
      <div
        className="wdd-tour-welcome"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wdd-tour-welcome-title"
        aria-describedby="wdd-tour-welcome-desc"
      >
        <div className="wdd-tour-welcome-card">
          <div id="wdd-tour-welcome-title" className="wdd-tour-welcome-title">
            You're in the admin dashboard
          </div>
          <div id="wdd-tour-welcome-desc" className="wdd-tour-welcome-desc">
            This is where you control everything patients see in the IV treatment wizard — what treatments are
            available, how they're described, and which questions lead patients to them. The 2-minute tour walks you
            through each section so you know where to go when something needs updating.
          </div>
          <div className="wdd-tour-welcome-actions">
            <button
              ref={welcomeStartRef}
              className="wdd-tour-welcome-start"
              onClick={handleStartTour}
            >
              Take the 2-minute tour
            </button>
            <button className="wdd-tour-welcome-skip" onClick={handleSkip} aria-label="Skip tour and go to dashboard">
              Skip — I know my way around
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step tooltip ─────────────────────────────────────────────────────────

  const step = TOUR_STEPS[stepIndex];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const arrowClass = `wdd-tour-arrow wdd-tour-arrow--${step.position === 'bottom' ? 'top' : step.position === 'top' ? 'bottom' : step.position === 'right' ? 'left' : 'right'}`;
  const descId = `wdd-tour-desc-${stepIndex}`;

  return (
    <>
      {/* Semi-transparent backdrop -- pointer-events disabled so the highlighted element is still visible */}
      <div className="wdd-tour-overlay" aria-hidden="true" />

      {/* Spotlight ring */}
      {spotlight && (
        <div
          className="wdd-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="wdd-tour-tooltip"
        role="dialog"
        aria-modal="false"
        aria-labelledby={`wdd-tour-title-${stepIndex}`}
        aria-describedby={descId}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Arrow pointing toward target */}
        {step.target && <div className={arrowClass} aria-hidden="true" />}

        {/* Progress dots */}
        <div className="wdd-tour-dots" role="list" aria-label={`Tour progress: step ${stepIndex + 1} of ${TOUR_STEPS.length}`}>
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`wdd-tour-dot${i === stepIndex ? ' wdd-tour-dot--active' : ''}`}
              role="listitem"
              aria-current={i === stepIndex ? 'step' : undefined}
              aria-label={`Step ${i + 1}${i === stepIndex ? ' (current)' : ''}`}
            />
          ))}
        </div>

        <div id={`wdd-tour-title-${stepIndex}`} className="wdd-tour-title">{step.title}</div>
        <div id={descId} className="wdd-tour-desc">{step.description}</div>

        <div className="wdd-tour-actions">
          {/* Left side: back or skip */}
          {stepIndex > 0 ? (
            <button className="wdd-tour-back" onClick={handleBack} aria-label="Go to previous step">
              Back
            </button>
          ) : (
            <button className="wdd-tour-skip" onClick={handleSkip} aria-label="Skip tour">
              Skip tour
            </button>
          )}

          {/* Right side: skip (when back is shown) + next/done */}
          <div className="wdd-tour-actions-right">
            {stepIndex > 0 && (
              <button className="wdd-tour-skip" onClick={handleSkip} aria-label="Skip tour">
                Skip
              </button>
            )}
            <button
              ref={tooltipNextRef}
              className="wdd-tour-next"
              onClick={handleNext}
              aria-label={isLastStep ? 'Finish tour and go to Editor' : `Next: ${TOUR_STEPS[stepIndex + 1]?.title ?? ''}`}
            >
              {isLastStep ? 'Start editing' : 'Next'}
            </button>
          </div>
        </div>

        <div className="wdd-tour-step-counter" aria-hidden="true">
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </div>
      </div>
    </>
  );
}
