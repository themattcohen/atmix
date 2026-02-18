import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { COMPARISONS } from '@/lib/comparisons-seo';

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = COMPARISONS.find((c) => c.slug === slug);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/compare/${page.slug}` },
    openGraph: { title: page.metaTitle, description: page.metaDescription, url: `/compare/${page.slug}` },
  };
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = COMPARISONS.find((c) => c.slug === slug);
  if (!page) notFound();

  return (
    <div className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <nav className="mb-8">
          <Link href="/about" className="text-sm text-blue-700 hover:underline">
            &larr; Back to About
          </Link>
        </nav>

        <h1 className="text-4xl font-bold text-navy-900 mb-4">{page.title}</h1>
        <p className="text-xl text-gray-600 mb-8">{page.intro}</p>

        {slug === 'fbar-direct-vs-bsa-efiling' && <BsaComparison />}
        {slug === 'fbar-direct-vs-cpa' && <CpaComparison />}
        {slug === 'best-fbar-filing-services-2026' && <ServicesListicle />}

        {/* CTA */}
        <div className="text-center mt-12 p-8 bg-navy-50 rounded-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Ready to File Your FBAR?</h2>
          <p className="text-gray-600 mb-6">Most people finish in under 10 minutes.</p>
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

function BsaComparison() {
  const rows = [
    { feature: 'Price', col1: 'Free', col2: '$59-79' },
    { feature: 'Save progress & resume', col1: 'No — must complete in one session', col2: 'Yes — save and return anytime' },
    { feature: 'Auto currency conversion', col1: 'No — manual USD conversion required', col2: 'Yes — enter in local currency' },
    { feature: 'AI bank statement extraction', col1: 'No', col2: 'Yes (Premium tier)' },
    { feature: 'Error checking', col1: 'Basic field validation', col2: 'Real-time validation with specific guidance' },
    { feature: 'Filing confirmation', col1: 'Email confirmation from FinCEN', col2: 'BSA tracking ID + email confirmation' },
    { feature: 'Resubmission if rejected', col1: 'Must re-enter everything', col2: 'One-click resubmission, no extra charge' },
    { feature: 'Interface', col1: 'Government portal (Java-based)', col2: 'Modern web app, mobile-friendly' },
    { feature: 'Support', col1: 'FinCEN helpline', col2: 'Email support' },
  ];

  return (
    <>
      <h2 className="text-2xl font-semibold text-navy-900 mb-4">Feature Comparison</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">Feature</th>
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">BSA E-Filing Portal</th>
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">FBAR Direct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <td className="p-3 border border-gray-200 text-sm text-gray-700 font-medium">{row.feature}</td>
                <td className="p-3 border border-gray-200 text-sm text-gray-700">{row.col1}</td>
                <td className="p-3 border border-gray-200 text-sm text-gray-700">{row.col2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-navy-900 mb-4">When to Use the Free BSA E-Filing Portal</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>You have a single foreign account and know all the details</li>
          <li>You are comfortable converting currencies to USD manually using Treasury rates</li>
          <li>You can complete the filing in one session</li>
          <li>You prefer not to pay for a filing service</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-navy-900 mb-4">When to Use FBAR Direct</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>You have multiple foreign accounts across different countries/currencies</li>
          <li>You want to save progress and return later</li>
          <li>You want automatic currency conversion using official Treasury rates</li>
          <li>You want AI-assisted bank statement extraction (Premium)</li>
          <li>You want a modern, guided filing experience</li>
        </ul>
      </section>
    </>
  );
}

function CpaComparison() {
  const rows = [
    { feature: 'Price', col1: '$200-500+ per FBAR', col2: '$59-79' },
    { feature: 'Filing method', col1: 'CPA files via BSA E-Filing or third-party software', col2: 'Direct FinCEN submission via BSA E-Filing' },
    { feature: 'Tax advice', col1: 'Yes — integrated with tax return', col2: 'No — FBAR filing only' },
    { feature: 'Audit support', col1: 'Yes — representation available', col2: 'No' },
    { feature: 'Complex situations', col1: 'Can handle trusts, entities, signature authority', col2: 'Individual filings' },
    { feature: 'Turnaround', col1: 'Days to weeks (depends on CPA availability)', col2: 'Under 10 minutes' },
    { feature: 'Currency conversion', col1: 'CPA handles manually', col2: 'Automatic with Treasury rates' },
  ];

  return (
    <>
      <h2 className="text-2xl font-semibold text-navy-900 mb-4">Feature Comparison</h2>
      <div className="overflow-x-auto mb-10">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">Feature</th>
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">Hiring a CPA</th>
              <th className="text-left p-3 border border-gray-200 font-semibold text-navy-900">FBAR Direct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <td className="p-3 border border-gray-200 text-sm text-gray-700 font-medium">{row.feature}</td>
                <td className="p-3 border border-gray-200 text-sm text-gray-700">{row.col1}</td>
                <td className="p-3 border border-gray-200 text-sm text-gray-700">{row.col2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-navy-900 mb-4">When to Hire a CPA</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>You have complex FBAR situations (trusts, entities, signature authority over business accounts)</li>
          <li>You need integrated tax planning with your FBAR filing</li>
          <li>You are filing delinquent FBARs and need professional guidance on the Streamlined Filing Compliance Procedures</li>
          <li>You are under IRS examination or audit</li>
          <li>You have FBAR filing obligations for a business entity</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-navy-900 mb-4">When to Use FBAR Direct</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>You have a straightforward individual FBAR filing</li>
          <li>You know your foreign account details (institution, account number, max value)</li>
          <li>You want to save $150-400+ compared to CPA fees</li>
          <li>You want to file immediately without scheduling an appointment</li>
        </ul>
      </section>
    </>
  );
}

function ServicesListicle() {
  const services = [
    {
      name: 'BSA E-Filing Portal (FinCEN)',
      price: 'Free',
      pros: ['Free', 'Direct government system', 'Official FinCEN confirmation'],
      cons: ['No save/resume', 'Manual currency conversion', 'Dated interface', 'Must complete in one session'],
      bestFor: 'Simple single-account filings by tech-savvy users',
    },
    {
      name: 'FBAR Direct',
      price: '$59 Basic / $79 Premium',
      pros: ['Save and resume', 'Auto currency conversion', 'AI bank statement extraction (Premium)', 'Modern interface', 'Direct FinCEN submission'],
      cons: ['Not free', 'Individual filings only', 'No tax advice'],
      bestFor: 'Multi-account filers who want a guided, modern experience',
    },
    {
      name: 'H&R Block',
      price: '$49 (add-on to tax return)',
      pros: ['Established brand', 'Integrated with tax filing', 'In-person support available'],
      cons: ['Requires H&R Block tax return', 'Add-on cost on top of tax prep fees', 'Not standalone FBAR filing'],
      bestFor: 'Existing H&R Block tax clients',
    },
    {
      name: 'MyExpatTaxes',
      price: '$59 (standalone FBAR)',
      pros: ['Expat-focused', 'Standalone FBAR option', 'Good Trustpilot reviews (4.8/5)'],
      cons: ['Primarily a tax prep service', 'FBAR is secondary to their tax product'],
      bestFor: 'US expats who also need expat tax filing',
    },
    {
      name: 'Expatfile',
      price: '$59 (FBAR) / $119+ (full tax)',
      pros: ['Full expat tax platform', 'Standalone FBAR option', 'Expat-focused'],
      cons: ['Smaller company', 'Less established than competitors'],
      bestFor: 'Expats wanting a combined tax + FBAR solution',
    },
    {
      name: 'CPA / Tax Professional',
      price: '$200-500+',
      pros: ['Professional advice', 'Handles complex situations', 'Audit support', 'Tax planning integration'],
      cons: ['Most expensive option', 'Requires scheduling', 'Slower turnaround'],
      bestFor: 'Complex situations, delinquent filings, entity filings, audit defense',
    },
  ];

  return (
    <>
      <div className="space-y-10">
        {services.map((service, i) => (
          <section key={service.name} className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-navy-900">
                  {i + 1}. {service.name}
                </h2>
                <p className="text-lg font-bold text-gold-600">{service.price}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-medium text-green-700 text-sm mb-2">Pros</h3>
                <ul className="space-y-1">
                  {service.pros.map((pro) => (
                    <li key={pro} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-green-600">+</span> {pro}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-red-700 text-sm mb-2">Cons</h3>
                <ul className="space-y-1">
                  {service.cons.map((con) => (
                    <li key={con} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-red-600">-</span> {con}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="text-sm text-gray-500">
              <strong>Best for:</strong> {service.bestFor}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
