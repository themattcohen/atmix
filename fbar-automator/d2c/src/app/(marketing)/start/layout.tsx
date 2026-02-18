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
    </div>
  );
}
