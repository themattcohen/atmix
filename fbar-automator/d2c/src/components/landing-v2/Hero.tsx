import Link from "next/link";

export function Hero() {
  return (
    <section className="bg-[#f5f7fa] py-16 px-4">
      <div className="max-w-[960px] mx-auto text-center">
        <h1 className="font-serif text-[32px] font-bold text-[#0b2d5b]">
          Report of Foreign Bank and Financial Accounts
        </h1>
        <p className="text-lg text-[#5c5c5c] mt-2">
          FinCEN Form 114 | Secure Electronic Filing Service
        </p>
        <p className="text-base text-[#1b1b1b] mt-6 max-w-[640px] mx-auto leading-relaxed">
          File your FBAR electronically through our FinCEN-registered BSA
          E-Filing system. Your data is encrypted end-to-end and submitted
          directly to FinCEN.
        </p>
        <Link
          href="/signup"
          className="inline-block mt-8 px-6 py-3 bg-[#1a4480] text-white text-base font-semibold hover:bg-[#0b2d5b] transition-colors"
        >
          Begin Filing
        </Link>
        <p className="text-sm text-[#5c5c5c] mt-3">
          No account required to check if you need to file.
        </p>
      </div>
    </section>
  );
}
