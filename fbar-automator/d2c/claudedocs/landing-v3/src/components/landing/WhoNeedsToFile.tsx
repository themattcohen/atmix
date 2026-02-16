import React from 'react';
export function WhoNeedsToFile() {
  return (
    <section
      id="who-must-file"
      className="w-full bg-white py-10 px-4 border-b border-border-gray">

      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-4">
          Who must file an FBAR?
        </h2>

        <p className="text-text-primary mb-6 leading-relaxed max-w-[700px]">
          The Bank Secrecy Act requires you to file an FBAR if you have a
          financial interest in, or signature authority over, foreign financial
          accounts and the aggregate value of these accounts exceeds $10,000 at
          any time during the calendar year.
        </p>

        <div className="mb-8">
          <h3 className="text-lg font-bold text-gov-blue mb-3">
            Filing Requirements
          </h3>
          <ul className="list-disc pl-5 space-y-2 text-text-primary">
            <li>
              <strong>Citizens & Residents:</strong> United States citizens,
              Green Card holders, and resident aliens.
            </li>
            <li>
              <strong>Aggregate Value &gt; $10,000:</strong> If the total value
              of all foreign accounts combined exceeded $10,000 at any point
              during the calendar year.
            </li>
            <li>
              <strong>Entities:</strong> Corporations, partnerships, LLCs,
              trusts, and estates formed under US laws.
            </li>
            <li>
              <strong>Signature Authority:</strong> Anyone with authority to
              control the disposition of assets in a foreign account.
            </li>
          </ul>
        </div>

        <div className="bg-alert-bg border-l-4 border-alert-border p-4 mb-8 max-w-[700px]">
          <h3 className="font-bold text-gov-blue mb-1 text-sm">
            Penalties for Failure to File
          </h3>
          <p className="text-sm text-text-primary mb-1">
            Failure to file an FBAR when required can result in significant
            civil and criminal penalties. Civil penalties for non-willful
            violations can exceed $16,000 per violation. Willful violations can
            result in penalties of $100,000 or 50% of the account balance,
            whichever is greater.
          </p>
          <p className="text-xs text-text-secondary italic">
            Source: 31 USC 5321
          </p>
        </div>

        <hr className="border-t border-gray-200 mb-8" />

        <div>
          <h3 className="text-lg font-heading font-bold text-gov-blue mb-2">
            "United States Person" Definition
          </h3>
          <p className="text-text-primary leading-relaxed max-w-[700px]">
            A United States person includes a citizen or resident of the United
            States, a domestic partnership, a domestic corporation, and a
            domestic estate or trust. This definition applies regardless of
            where the person lives or where the business is located.
          </p>
        </div>
      </div>
    </section>);

}