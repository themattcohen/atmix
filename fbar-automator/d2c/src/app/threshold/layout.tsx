import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: 'Do I Need to File an FBAR? — Free Eligibility Check',
  description: 'Answer two questions to find out if you need to file an FBAR (FinCEN Form 114). Free, instant result.',
  alternates: { canonical: '/threshold' },
};

export default function ThresholdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-navy-900">
            FBAR Direct
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-navy-900 hover:underline font-medium">
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-navy-900 text-white px-4 py-1.5 rounded-md hover:bg-navy-800 font-medium"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
