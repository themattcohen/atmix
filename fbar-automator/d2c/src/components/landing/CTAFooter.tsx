import Link from "next/link";

export function CTAFooter() {
  return (
    <section className="bg-navy-900 text-white py-16 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to File Your FBAR?</h2>
        <p className="text-gray-300 mb-8">
          It takes about 10 minutes. $59 flat fee. No hidden costs.
        </p>
        <Link
          href="/signup"
          className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
        >
          Start Filing Now
        </Link>
      </div>
    </section>
  );
}
