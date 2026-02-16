import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="w-full bg-bg-gray py-10 px-4 border-b border-border-gray"
    >
      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-6">
          Filing Fee
        </h2>

        <div className="mb-6">
          <div className="flex items-baseline mb-4">
            <span className="text-xl font-bold text-text-primary">
              FinCEN Form 114 (per filing):
            </span>
            <span className="text-xl font-bold text-gov-blue ml-2">$59.00</span>
          </div>

          <div className="mb-6">
            <p className="text-sm font-bold text-text-primary mb-2">
              Fee includes:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-text-primary text-sm">
              <li>FinCEN Form 114 preparation and review</li>
              <li>Direct electronic submission to FinCEN</li>
              <li>BSA tracking ID confirmation</li>
              <li>Secure record retention</li>
            </ul>
          </div>

          <Link
            href="/signup"
            className="bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-base px-6 py-2.5 transition-colors inline-flex items-center"
          >
            Begin Filing <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <p className="text-xs text-text-secondary max-w-[600px]">
          Fee covers one FinCEN Form 114 for one calendar year. Additional years
          filed separately. No hidden fees or subscription requirements.
        </p>
      </div>
    </section>
  );
}
