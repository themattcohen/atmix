import Link from "next/link";

export function PricingComparison() {
  return (
    <section id="pricing" className="bg-[#f0f0f0] border-y border-[#d9d9d9]">
      <div className="max-w-[960px] mx-auto py-16 px-4 text-center">
        <h2 className="font-serif text-[26px] font-bold text-[#0b2d5b]">Filing fee</h2>
        <div className="mt-8 max-w-md mx-auto bg-white border border-[#d9d9d9] p-8">
          <p className="text-[40px] font-bold text-[#0b2d5b]">$59</p>
          <p className="text-base text-[#5c5c5c]">per filing</p>
          <div className="border-t border-[#d9d9d9] my-6" />
          <ul className="text-left space-y-3">
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-[#2e7d32] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#1b1b1b]">Flat fee with no hidden costs</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-[#2e7d32] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#1b1b1b]">Includes all foreign accounts on one filing</span>
            </li>
            <li className="flex items-start gap-2">
              <svg className="w-4 h-4 text-[#2e7d32] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#1b1b1b]">Pay only when your filing is submitted</span>
            </li>
          </ul>
          <Link
            href="/signup"
            className="mt-6 inline-block w-full text-center px-6 py-3 bg-[#1a4480] text-white text-base font-semibold hover:bg-[#0b2d5b] transition-colors"
          >
            Begin Filing
          </Link>
        </div>
        <p className="mt-4 text-sm text-[#5c5c5c]">
          Covers one FinCEN Form 114 for one calendar year. Joint filers file separately.
        </p>
      </div>
    </section>
  );
}
