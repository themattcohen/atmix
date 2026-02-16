import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="w-full bg-white py-12 px-4 border-b border-border-gray">
      <div className="max-w-doc mx-auto text-left">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gov-blue mb-4">
          Report of Foreign Bank and Financial Accounts
        </h1>

        <hr className="border-t border-gray-200 mb-6 w-full" />

        <p className="text-lg text-text-secondary mb-6 font-body font-semibold">
          FinCEN Form 114 — Electronic Filing Service
        </p>

        <div className="max-w-[640px] mb-8">
          <p className="text-base text-text-primary leading-relaxed">
            File your FBAR electronically through our FinCEN-registered BSA
            E-Filing system. Your data is encrypted end-to-end and submitted
            directly to FinCEN. This service is authorized for use by United
            States persons required to file FinCEN Form 114.
          </p>
        </div>

        <div className="flex flex-col items-start space-y-3">
          <Link
            href="/signup"
            className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-base px-6 py-2.5 transition-colors inline-flex items-center"
          >
            Begin Filing <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-[13px] text-text-secondary">
            No account required to check if you need to file.
          </span>
        </div>
      </div>
    </section>
  );
}
