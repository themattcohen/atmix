import React, { useEffect, useRef, useCallback } from 'react';
import { useWizard } from '../hooks/useWizard';
import { useAnalytics } from '../hooks/useAnalytics';
import { WizardRouter } from './WizardRouter';

interface WizardModalProps {
  onReady: (open: (source?: string) => void, close: () => void) => void;
}

// All focusable element selectors per WCAG focus management spec
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function WizardModal({ onReady }: WizardModalProps): React.ReactElement | null {
  const { state, dispatch } = useWizard();
  const analytics = useAnalytics();

  // Track the element that was focused before we opened the modal
  const previousFocusRef = useRef<Element | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Expose open / close to the parent entry point (called once after mount)
  useEffect(() => {
    const open = (source?: string) => {
      dispatch({ type: 'OPEN', source: (source === 'exit_intent' ? 'exit_intent' : 'button') });
    };
    const close = () => {
      dispatch({ type: 'CLOSE' });
    };
    onReady(open, close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire wizard_opened and manage focus when isOpen changes
  useEffect(() => {
    if (state.isOpen) {
      // Store current focus before trapping
      previousFocusRef.current = document.activeElement;

      // Fire analytics
      analytics.fireOpened(state.source);

      // Scroll lock
      document.body.style.overflow = 'hidden';

      // Move focus into modal after animation frame
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
          if (focusable.length > 0) {
            focusable[0].focus();
          } else {
            modalRef.current.focus();
          }
        }
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // Release scroll lock
      document.body.style.overflow = '';

      // Restore prior focus
      if (previousFocusRef.current && previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
  }, [state.isOpen]);

  // Focus trap and Escape key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        analytics.fireAbandoned(state.currentQuestionId, state.stepNumber);
        dispatch({ type: 'CLOSE' });
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        ).filter((el) => !el.closest('[aria-hidden="true"]'));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          // Shift+Tab: wrap backward
          if (active === first || !modalRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap forward
          if (active === last || !modalRef.current.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [state.currentQuestionId, state.stepNumber, analytics, dispatch]
  );

  // Always render the overlay -- visibility controlled by CSS class
  return (
    <div
      ref={overlayRef}
      className={`tw-overlay${state.isOpen ? ' tw-overlay--visible' : ''}`}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        // Close on backdrop click (clicking the overlay but not the modal)
        if (e.target === overlayRef.current) {
          analytics.fireAbandoned(state.currentQuestionId, state.stepNumber);
          dispatch({ type: 'CLOSE' });
        }
      }}
      aria-hidden={!state.isOpen}
    >
      <div
        ref={modalRef}
        className="tw-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tw-modal-title"
        tabIndex={-1}
      >
        {/* Hidden title element for aria-labelledby -- actual visible title is inside WizardRouter steps */}
        <span id="tw-modal-title" className="tw-visually-hidden">Treatment Finder</span>

        {/* Close button */}
        <button
          type="button"
          className="tw-close"
          onClick={() => {
            analytics.fireAbandoned(state.currentQuestionId, state.stepNumber);
            dispatch({ type: 'CLOSE' });
          }}
          aria-label="Close treatment finder"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        </button>

        {/* Render wizard content only when open (saves render overhead and prevents focus issues) */}
        {state.isOpen && (
          <WizardRouter state={state} dispatch={dispatch} />
        )}
      </div>
    </div>
  );
}
