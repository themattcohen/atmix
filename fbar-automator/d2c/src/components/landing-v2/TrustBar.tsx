export function TrustBar() {
  return (
    <section className="bg-[#f0f0f0] border-y border-[#d9d9d9]">
      <div className="max-w-[960px] mx-auto py-4 px-4 flex flex-wrap justify-center gap-8 md:gap-12">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#2e7d32] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-sm font-semibold text-[#0b2d5b]">FinCEN-Registered BSA E-Filer</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#2e7d32] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="text-sm font-semibold text-[#0b2d5b]">256-bit SSL Encryption</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#2e7d32] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span className="text-sm font-semibold text-[#0b2d5b]">Direct FinCEN Submission</span>
        </div>
      </div>
    </section>
  );
}
