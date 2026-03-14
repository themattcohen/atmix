import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: 'Do I Need to File an FBAR? — Free Eligibility Check',
  description: 'Answer two questions to find out if you need to file an FBAR (FinCEN Form 114). Free, instant result.',
  alternates: { canonical: '/threshold' },
};

export default async function ThresholdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <nav className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-gov-blue">
            FBAR Direct
          </Link>
          <div className="flex items-center gap-4">
            {isLoggedIn ? (
              <>
                <span className="text-sm text-gray-600">
                  {session.user?.name || session.user?.email}
                </span>
                <Link
                  href="/dashboard"
                  className="text-sm bg-gov-blue text-white px-4 py-1.5 rounded-md hover:bg-gov-blue-dark font-medium"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gov-blue hover:underline font-medium">
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-gov-blue text-white px-4 py-1.5 rounded-md hover:bg-gov-blue-dark font-medium"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
