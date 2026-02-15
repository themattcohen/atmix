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
      {/* Progress indicator */}
      <nav className="mb-8">
        <ol className="flex items-center justify-between">
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
                >
                  {step.label}
                </span>
              </div>
            );

            return (
              <li key={step.key} className="flex items-center flex-1 last:flex-none">
                {isCompleted ? (
                  <Link href={step.path}>{stepIndicator}</Link>
                ) : (
                  stepIndicator
                )}
                {index < WIZARD_STEPS.length - 1 && (
                  <div
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
      {children}

      {/* Previous button */}
      {currentStep > 1 && onPrevious && (
        <div className="mt-6">
          <Link
            href={onPrevious}
            className="inline-flex items-center gap-2 text-navy-900 hover:text-navy-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Link>
        </div>
      )}
    </div>
  );
}
