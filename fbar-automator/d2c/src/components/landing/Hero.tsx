import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="w-full bg-white py-12 px-4 border-b border-border-gray">
      <div className="max-w-doc mx-auto text-left">
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gov-blue mb-4">
          We File Your FBAR for You
        </h1>

        <hr className="border-t border-gray-200 mb-6 w-full" />

        <p className="text-lg text-text-secondary mb-6 font-body font-semibold">
          FinCEN Form 114 — Filed Directly to FinCEN on Your Behalf
        </p>

        <div className="max-w-[640px] mb-8">
          <p className="text-base text-text-primary leading-relaxed">
            Answer a few questions, review your filing, and we handle the rest
            — including submitting directly to FinCEN. No government portals to
            navigate. No CPA fees. From $59.
          </p>
        </div>

        <div className="flex flex-col items-start space-y-3">
          <Link
            href="/threshold"
            className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-base px-6 py-2.5 transition-colors inline-flex items-center"
          >
            Begin Filing <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-[13px] text-text-secondary">
            Free threshold check — no account required
          </span>
        </div>
      </div>
    </section>
  );
}
