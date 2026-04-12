/**
 * OnboardingTour.tsx -- Interactive step-by-step tour for the Wizard Admin Dashboard.
 *
 * Renders a welcome screen on first visit, then a spotlight+tooltip walkthrough
 * of each major dashboard tab. localStorage key: `wizard-admin-tour-seen`.
 *
 * Never imported from production builds -- only used by WizardDevDashboard.tsx,
 * which itself is guarded by `import.meta.env.DEV`.
 */

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import '../../styles/dev/tour.css';

// ── Types ────────────────────────────────────────────────────────────────────

export type TourPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  /** CSS selector for the element to spotlight. Empty string = no spotlight (centered tooltip). */
  target: string;
  title: string;
  description: string;
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
    target: '[data-tour="editor-tab"]',
    title: 'Editor Tab',
    description:
      'The Editor is where you manage treatments. Select a treatment from the sidebar, edit its details (pricing, ingredients, addon suggestions, scoring weights), and save your changes. This is your home base -- everything else helps you understand what\'s happening here.',
    tabToActivate: 'editor',
    position: 'bottom',
  },
  {
    target: '[data-tour="paths-tab"]',
    title: 'Paths Tab',
    description:
      'Paths show every possible journey a patient can take through the wizard. Think of it as: "If a patient clicks X, then Y, they end up at Z treatment." Use "By Treatment" to see all the ways patients can find a specific treatment. If a treatment has zero paths, patients can never reach it.',
    tabToActivate: 'paths',
    position: 'bottom',
  },
  {
    target: '[data-tour="flow-tab"]',
    title: 'Flow Tab',
    description:
      'The Flow view is a visual map of the entire wizard. Each blue box is a question, each colored pill is a treatment. Click any treatment to see which paths lead to it. Use the zoom controls to navigate. Collapse branches to focus on specific areas.',
    tabToActivate: 'tree',
    position: 'bottom',
  },
  {
    target: '[data-tour="coverage-tab"]',
    title: 'Coverage Tab',
    description:
      'Coverage shows the health of each treatment\'s configuration at a glance. Green = good. Yellow = warning (missing optional data). Red = error (something will break). Hover any column header for an explanation. Click "Edit" on any row to jump straight to that treatment in the Editor.',
    tabToActivate: 'coverage',
    position: 'bottom',
  },
  {
    target: '[data-tour="health-tab"]',
    title: 'Health Tab',
    description:
      'Health checks your entire configuration for problems. Each issue tells you what\'s wrong, why it matters, and exactly how to fix it. Click "Fix in Editor" on any issue to jump directly to the treatment that needs attention.',
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

  // Reset to welcome screen whenever the tour is opened
  useEffect(() => {
    if (isOpen) {
      setStepIndex(-1);
    }
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
      <div className="wdd-tour-welcome" role="dialog" aria-modal="true" aria-label="Welcome to the Wizard Admin Dashboard">
        <div className="wdd-tour-welcome-card">
          <div className="wdd-tour-welcome-title">Welcome to the Wizard Admin Dashboard</div>
          <div className="wdd-tour-welcome-desc">
            This tool lets you manage your IV treatment wizard -- see how patients find
            treatments, edit treatment details, and check for configuration issues.
          </div>
          <div className="wdd-tour-welcome-actions">
            <button className="wdd-tour-welcome-start" onClick={handleStartTour}>
              Take a 2-minute tour
            </button>
            <button className="wdd-tour-welcome-skip" onClick={handleSkip}>
              Skip tour
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
        aria-label={`Tour step ${stepIndex + 1} of ${TOUR_STEPS.length}: ${step.title}`}
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Arrow pointing toward target */}
        <div className={arrowClass} aria-hidden="true" />

        {/* Progress dots */}
        <div className="wdd-tour-dots" role="tablist" aria-label="Tour progress">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`wdd-tour-dot${i === stepIndex ? ' wdd-tour-dot--active' : ''}`}
              role="tab"
              aria-selected={i === stepIndex}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="wdd-tour-title">{step.title}</div>
        <div className="wdd-tour-desc">{step.description}</div>

        <div className="wdd-tour-actions">
          {/* Left side: back or skip */}
          {stepIndex > 0 ? (
            <button className="wdd-tour-back" onClick={handleBack} aria-label="Previous step">
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
              className="wdd-tour-next"
              onClick={handleNext}
              aria-label={isLastStep ? 'Finish tour' : 'Next step'}
            >
              {isLastStep ? 'Done' : 'Next'}
            </button>
          </div>
        </div>

        {/* Step counter text below actions */}
        <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
          Step {stepIndex + 1} of {TOUR_STEPS.length}
        </div>
      </div>
    </>
  );
}
