import Link from "next/link";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="w-full bg-white py-10 px-4 border-b border-border-gray"
    >
      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-4">
          Pricing
        </h2>
        <p className="text-sm text-text-secondary mb-6 max-w-md">
          Other services prepare your FBAR and leave you to file it yourself. FBAR Direct files it for you.
        </p>

        <div className="bg-bg-gray border border-border-gray p-6 max-w-md">
          <p className="text-3xl font-bold text-gov-blue mb-1">
            Starting at $59
          </p>
          <p className="text-sm text-text-secondary mb-4">per filing</p>
          <ul className="space-y-2 text-sm text-text-primary mb-6">
            <li className="flex items-start gap-2">
              <span className="text-gov-blue font-bold mt-0.5">✓</span>
              <span>We file your FBAR directly to FinCEN</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gov-blue font-bold mt-0.5">✓</span>
              <span>BSA tracking ID as proof of filing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gov-blue font-bold mt-0.5">✓</span>
              <span>AES-256 encrypted data handling</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gov-blue font-bold mt-0.5">✓</span>
              <span>Free resubmission if rejected</span>
            </li>
          </ul>
          <Link
            href="/pricing"
            className="text-gov-blue text-sm font-semibold hover:underline"
          >
            View all plans and features →
          </Link>
        </div>
      </div>
    </section>
  );
}
