"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-navy-900 mb-4">
          Something went wrong
        </h1>
        <p className="text-gray-600 mb-8">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
