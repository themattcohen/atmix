"use client";

import Link from "next/link";
import { WIZARD_STEPS } from "@/types";

interface WizardLayoutProps {
  currentStep: number; // 1-7
  children: React.ReactNode;
  onPrevious?: string; // path to previous step
}

export function WizardLayout({ currentStep, children, onPrevious }: WizardLayoutProps) {
  return (
    <div>
      {/* Skip to content link for keyboard/screen reader users */}
      <a
        href="#wizard-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow-md focus:ring-2 focus:ring-navy-900"
      >
        Skip to content
      </a>

      {/* Progress indicator */}
      <nav aria-label="Filing progress" className="mb-8">
        <ol className="flex items-center justify-between" role="list">
          {WIZARD_STEPS.map((step, index) => {
            const stepNum = index + 1;
            const isCompleted = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            const stepIndicator = (
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    isCompleted
                      ? "bg-green-500 text-white cursor-pointer hover:bg-green-600"
                      : isCurrent
                      ? "bg-navy-900 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`mt-1 text-xs md:text-sm ${
                    isCurrent ? "text-navy-900 font-medium" : "text-gray-500"
                  }`}
                  aria-hidden="true"
                >
                  {step.label}
                </span>
              </div>
            );

            return (
              <li
                key={step.key}
                className="flex items-center flex-1 last:flex-none"
                role="listitem"
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`Step ${stepNum} of ${WIZARD_STEPS.length}: ${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
              >
                {isCompleted ? (
                  <Link href={step.path} aria-label={`Go back to step ${stepNum}: ${step.label} (completed)`}>
                    {stepIndicator}
                  </Link>
                ) : (
                  stepIndicator
                )}
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`flex-1 h-0.5 mx-2 ${
                      stepNum < currentStep ? "bg-green-500" : "bg-gray-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Page content */}
      <main id="wizard-content" role="main">
        {children}
      </main>

      {/* Previous button */}
      {currentStep > 1 && onPrevious && (
        <div className="mt-6">
          <Link
            href={onPrevious}
            className="inline-flex items-center gap-2 text-navy-900 hover:text-navy-700 font-medium"
            aria-label={`Go back to previous step`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Link>
        </div>
      )}
    </div>
  );
}
