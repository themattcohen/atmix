export function WhoNeedsToFile() {
  return (
    <section className="bg-gray-50 py-20 px-4" aria-labelledby="who-files-heading">
      <div className="max-w-4xl mx-auto">
        <h2 id="who-files-heading" className="text-3xl font-bold text-navy-900 text-center mb-8">Who Needs to File an FBAR?</h2>
        <div className="bg-white rounded-lg shadow-md p-8">
          <p className="text-gray-700 mb-6">
            You must file an FBAR (FinCEN Form 114) if you are a U.S. person and:
          </p>
          <ul className="space-y-4" role="list">
            <li className="flex items-start gap-3">
              <svg className="w-6 h-6 text-gold-500 flex-shrink-0 mt-0.5" aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
              <span className="text-gray-700">
                You had a <strong>financial interest in</strong> or <strong>signature authority over</strong> at least one foreign financial account
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-6 h-6 text-gold-500 flex-shrink-0 mt-0.5" aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
              <span className="text-gray-700">
                The <strong>aggregate value</strong> of ALL foreign accounts exceeded <strong>$10,000</strong> at any time during the calendar year
              </span>
            </li>
          </ul>
          <aside className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-md" role="note">
            <p className="text-sm text-amber-800">
              <strong>Penalties for non-filing:</strong> Up to $12,909 per violation for non-willful violations. Willful violations can result in penalties up to $129,210 or 50% of the account balance, whichever is greater.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
