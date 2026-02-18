import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { COUNTRIES } from '@/lib/countries-seo';
import { JsonLd } from '@/components/JsonLd';

export function generateStaticParams() {
  return COUNTRIES.map((c) => ({ country: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}): Promise<Metadata> {
  const { country } = await params;
  const data = COUNTRIES.find((c) => c.slug === country);
  if (!data) return {};
  return {
    title: `FBAR Filing for US Expats in ${data.name} — ${data.currency} Accounts`,
    description: `File your FBAR for ${data.name} bank accounts. Auto ${data.currencyCode}/USD conversion. ${data.commonBanks.slice(0, 3).join(', ')} supported. From $59.`,
    alternates: { canonical: `/fbar/${data.slug}` },
    openGraph: {
      title: `FBAR Filing for ${data.name} Bank Accounts`,
      description: `File your FBAR for ${data.name} accounts. Automatic ${data.currencyCode}/USD conversion. From $59.`,
      url: `/fbar/${data.slug}`,
    },
  };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params;
  const data = COUNTRIES.find((c) => c.slug === country);
  if (!data) notFound();

  return (
    <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: `Do I need to file an FBAR for ${data.name} bank accounts?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: `Yes. If you are a US person with ${data.name} bank accounts and the aggregate value of all your foreign accounts exceeds $10,000 at any time during the year, you must file FinCEN Form 114 (FBAR). This includes ${data.accountTypes.slice(0, 3).join(', ')}, and other financial accounts.`,
                },
              },
              {
                '@type': 'Question',
                name: `Are ${data.name} pension accounts reportable on FBAR?`,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: data.pensionImplications,
                },
              },
            ],
          }}
        />

        <nav className="mb-8">
          <Link href="/about" className="text-sm text-blue-700 hover:underline">
            &larr; Back to About
          </Link>
        </nav>

        <h1 className="text-4xl font-bold text-navy-900 mb-4">
          FBAR Filing for US Expats in {data.name}
        </h1>
        <p className="text-xl text-gray-600 mb-8">{data.overview}</p>

        {/* Expat population */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-sm text-blue-900 font-medium">{data.expatPopulation}</p>
        </div>

        {/* Common banks */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-navy-900 mb-4">
            Common {data.name} Banks Reported on FBAR
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.commonBanks.map((bank) => (
              <div key={bank} className="bg-gray-50 rounded-md p-3 text-sm text-gray-700 font-medium">
                {bank}
              </div>
            ))}
          </div>
        </section>

        {/* Account types */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-navy-900 mb-4">
            {data.name} Account Types Reportable on FBAR
          </h2>
          <ul className="space-y-2">
            {data.accountTypes.map((type) => (
              <li key={type} className="flex items-start gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{type}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Pension implications */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-navy-900 mb-4">
            {data.name} Pension & Retirement Account FBAR Rules
          </h2>
          <p className="text-gray-700 leading-relaxed">{data.pensionImplications}</p>
        </section>

        {/* Key considerations */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-navy-900 mb-4">
            Key FBAR Considerations for {data.name}
          </h2>
          <ul className="space-y-3">
            {data.keyConsiderations.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="text-amber-500 font-bold text-lg leading-none">!</span>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Currency note */}
        <section className="mb-10 bg-gray-50 rounded-lg p-6">
          <h3 className="font-semibold text-navy-900 mb-2">
            {data.currencyCode}/USD Currency Conversion
          </h3>
          <p className="text-sm text-gray-600">
            FBAR requires reporting account values in US dollars. FBAR Direct automatically converts {data.currency} ({data.currencyCode}) balances to USD using the Treasury Department&apos;s end-of-year exchange rate, so you can enter your account values in {data.currencyCode}.
          </p>
        </section>

        {/* CTA */}
        <div className="text-center mt-12 p-8 bg-navy-50 rounded-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-2">
            File Your FBAR for {data.name} Accounts
          </h2>
          <p className="text-gray-600 mb-6">
            Most people finish in under 10 minutes. Automatic {data.currencyCode}/USD conversion included.
          </p>
          <Link
            href="/threshold"
            className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
          >
            Start Filing — From $59
          </Link>
        </div>
      </div>
    </div>
  );
}
