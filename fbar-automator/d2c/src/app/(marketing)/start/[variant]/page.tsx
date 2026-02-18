import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LANDING_VARIANTS } from '@/lib/landing-pages';

export function generateStaticParams() {
  return LANDING_VARIANTS.map((v) => ({ variant: v.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const { variant } = await params;
  const page = LANDING_VARIANTS.find((v) => v.slug === variant);
  if (!page) return {};
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/start/${page.slug}` },
    robots: { index: false, follow: false },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  const page = LANDING_VARIANTS.find((v) => v.slug === variant);
  if (!page) notFound();

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      <h1 className="text-4xl font-bold text-navy-900 mb-4">{page.headline}</h1>
      <p className="text-xl text-gray-600 mb-2">{page.subheadline}</p>
      <p className="text-3xl font-bold text-gold-600 mb-8">{page.priceHighlight}</p>

      <Link
        href={page.ctaUrl}
        className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
      >
        {page.ctaText}
      </Link>

      <div className="mt-12 text-left max-w-md mx-auto">
        <ul className="space-y-3">
          {page.features.map((f) => (
            <li key={f} className="flex items-center gap-3">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-gray-700">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 3-step process */}
      <div className="mt-16 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="w-10 h-10 bg-navy-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-2">1</div>
          <p className="text-sm text-gray-700 font-medium">Enter your info</p>
        </div>
        <div>
          <div className="w-10 h-10 bg-navy-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-2">2</div>
          <p className="text-sm text-gray-700 font-medium">Review & sign</p>
        </div>
        <div>
          <div className="w-10 h-10 bg-navy-900 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-2">3</div>
          <p className="text-sm text-gray-700 font-medium">We submit to FinCEN</p>
        </div>
      </div>

      {/* Repeat CTA */}
      <div className="mt-12">
        <Link
          href={page.ctaUrl}
          className="inline-block px-8 py-4 bg-gold-500 text-navy-900 rounded-md text-lg font-bold hover:bg-gold-600 transition-colors"
        >
          {page.ctaText}
        </Link>
        <p className="text-sm text-gray-500 mt-2">100% money-back guarantee</p>
      </div>
    </div>
  );
}
