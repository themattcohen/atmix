export function WhatYouNeed() {
  return (
    <section id="what-you-need" className="bg-[#f0f0f0] border-y border-[#d9d9d9] py-16 px-4">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-serif text-[26px] font-bold text-[#0b2d5b]">What you will need to file</h2>
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <div>
            <p className="text-base font-semibold text-[#0b2d5b]">Personal information</p>
            <p className="text-sm text-[#5c5c5c] mt-1">Your full legal name, date of birth, and Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN).</p>
          </div>
          <div>
            <p className="text-base font-semibold text-[#0b2d5b]">Foreign account details</p>
            <p className="text-sm text-[#5c5c5c] mt-1">Account numbers, financial institution names, and institution mailing addresses for each foreign account.</p>
          </div>
          <div>
            <p className="text-base font-semibold text-[#0b2d5b]">Maximum account values</p>
            <p className="text-sm text-[#5c5c5c] mt-1">The highest balance or value in each foreign financial account at any point during the calendar year, in the account&apos;s local currency.</p>
          </div>
          <div>
            <p className="text-base font-semibold text-[#0b2d5b]">Account types</p>
            <p className="text-sm text-[#5c5c5c] mt-1">Whether each account is a bank/deposit account, securities account, or other type of financial account.</p>
          </div>
        </div>
        <p className="mt-8 text-sm text-[#5c5c5c]">You do not need to upload bank statements. You will enter account information directly into the guided form.</p>
      </div>
    </section>
  );
}
