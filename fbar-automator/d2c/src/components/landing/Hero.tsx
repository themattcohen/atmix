import Link from "next/link";

export function Hero() {
  return (
    <section className="bg-navy-900 text-white py-20 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">
          File Your FBAR in 10 Minutes
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          The trustworthy, affordable way to file your Report of Foreign Bank
          and Financial Accounts. FinCEN-registered. $59 flat fee. No surprises.
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
        >
          Start Filing Now
        </Link>
        <p className="mt-4 text-sm text-gray-400">
          No credit card required to start. Pay only when you file.
        </p>
      </div>
    </section>
  );
}
