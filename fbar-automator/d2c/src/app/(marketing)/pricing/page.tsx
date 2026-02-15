import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-navy-900 mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600">One price. No hidden fees. No surprises.</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-8 md:p-12 text-center max-w-lg mx-auto mb-16">
          <p className="text-gray-500 uppercase tracking-wider text-sm font-medium mb-2">FBAR Filing</p>
          <div className="mb-6">
            <span className="text-5xl font-bold text-navy-900">$59</span>
            <span className="text-gray-500 ml-2">per filing</span>
          </div>
          <ul className="text-left space-y-3 mb-8">
            {[
              "Guided step-by-step process",
              "Automated data verification",
              "FinCEN XML generation",
              "Direct SDTM submission to FinCEN",
              "BSA tracking ID confirmation",
              "Email confirmation with receipt",
              "Form 114a digital signature",
              "AES-256 encrypted data handling",
              "Resubmission at no extra charge if rejected",
            ].map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className="inline-block w-full py-3 bg-gold-500 text-navy-900 rounded-md font-bold text-lg hover:bg-gold-600 transition-colors"
          >
            Start Filing Now
          </Link>
          <p className="mt-3 text-sm text-gray-500">No credit card required to start</p>
        </div>

        <div className="bg-navy-50 rounded-lg p-6 text-center">
          <p className="text-navy-900 font-medium">
            100% money-back guarantee if we are unable to file your FBAR.
          </p>
        </div>
      </div>
    </div>
  );
}
