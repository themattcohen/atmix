import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | FBAR Direct",
};

export default function NotFound() {
  return (
    <main aria-live="polite" className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-navy-900 mb-4">404</h1>
        <p className="text-2xl font-semibold text-gray-800 mb-4">
          Page Not Found
        </p>
        <p className="text-gray-600 mb-4">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          You can return to the home page or check the URL for typos.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-offset-2"
        >
          Go to Home Page
        </Link>
      </div>
    </main>
  );
}
