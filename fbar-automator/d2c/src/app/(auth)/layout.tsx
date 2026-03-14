import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <Link href="/" className="flex flex-col items-center mb-8">
          <span className="font-heading font-bold text-2xl text-gov-blue leading-tight">
            FBAR Direct
          </span>
          <span className="text-xs text-text-secondary mt-0.5">
            FinCEN-Registered BSA E-Filing Institution
          </span>
        </Link>
        {children}
      </div>
    </div>
  );
}
