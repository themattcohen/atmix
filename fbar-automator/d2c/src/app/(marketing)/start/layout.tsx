import Link from 'next/link';
import { TrustBar } from '@/components/landing/TrustBar';

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200 py-4 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="font-heading font-bold text-xl text-gov-blue">
            FBAR Direct
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <TrustBar />
      <footer className="border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>&copy; {new Date().getFullYear()} FBAR Direct</span>
          <Link href="/privacy" className="hover:text-gray-700 hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-700 hover:underline">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
