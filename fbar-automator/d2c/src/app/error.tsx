"use client";

import { useEffect, useRef } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Move focus to the error heading when the error boundary renders
    headingRef.current?.focus();
  }, []);

  return (
    <div role="alert" aria-live="assertive" className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-4xl font-bold text-navy-900 mb-4 outline-none"
        >
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
