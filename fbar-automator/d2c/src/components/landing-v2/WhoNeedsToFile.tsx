export function WhoNeedsToFile() {
  return (
    <section id="who-must-file" className="bg-white py-16 px-4">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-serif text-[26px] font-bold text-[#0b2d5b]">
          Who must file an FBAR?
        </h2>
        <p className="text-base text-[#1b1b1b] mt-4 leading-relaxed">
          United States persons are required to file FinCEN Form 114 (Report of
          Foreign Bank and Financial Accounts) if they have a financial interest
          in, or signature or other authority over, foreign financial accounts
          with an aggregate value exceeding $10,000 at any time during the
          calendar year.
        </p>
        <div className="mt-8">
          <div className="border-l-4 border-[#1a4480] bg-[#f5f7fa] p-4 mb-4">
            <p className="text-[#1b1b1b]"><strong>United States person</strong></p>
            <p className="text-[#1b1b1b] mt-1">Includes U.S. citizens, U.S. residents, and domestic entities including trusts, estates, corporations, and partnerships.</p>
          </div>
          <div className="border-l-4 border-[#1a4480] bg-[#f5f7fa] p-4 mb-4">
            <p className="text-[#1b1b1b]"><strong>Financial interest or signature authority</strong></p>
            <p className="text-[#1b1b1b] mt-1">Applies to accounts where you are the owner of record, have an interest through a trust or other arrangement, or have authority to control the disposition of assets.</p>
          </div>
          <div className="border-l-4 border-[#1a4480] bg-[#f5f7fa] p-4 mb-4">
            <p className="text-[#1b1b1b]"><strong>Aggregate value exceeding $10,000</strong></p>
            <p className="text-[#1b1b1b] mt-1">The total combined value of ALL foreign financial accounts. If the aggregate exceeds $10,000 at any point during the year, ALL accounts must be reported, even those individually below $10,000.</p>
          </div>
        </div>
        <div className="mt-8 bg-[#fef3cd] border-l-4 border-[#b58b00] p-4">
          <p className="text-sm font-semibold text-[#1b1b1b]">Penalties for non-filing</p>
          <p className="text-sm text-[#1b1b1b] mt-1">
            Non-willful violations may result in penalties up to $12,909 per violation. Willful violations may result in penalties up to $129,210 or 50% of the account balance, whichever is greater. See 31 USC{"\u00A0"}&sect;{"\u00A0"}5321.
          </p>
        </div>
      </div>
    </section>
  );
}
