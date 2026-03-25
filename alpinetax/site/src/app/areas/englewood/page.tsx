import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Englewood Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Englewood, CO residents. Near South Broadway and Swedish Medical Center. Starting at $600.',
};

export default function EnglewoodPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/englewood',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Englewood',
            containedInPlace: { '@type': 'State', name: 'Colorado' },
          },
          serviceType: [
            'Tax Preparation',
            'Tax Planning',
            'Small Business Tax',
          ],
          priceRange: '$$',
        }}
      />

      {/* Hero */}
      <section className="section-padding bg-white">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Service Areas', href: '/areas' },
              { label: 'Englewood' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Englewood Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting works with Englewood residents and business
            owners throughout the city — from the South Broadway corridor to the
            CityCenter district, from the Swedish Medical Center neighborhood to
            the Englewood Light Rail station area. Whatever your tax situation,
            we bring a careful, personal approach to every return.
          </p>
        </div>
      </section>

      {/* Why Englewood Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Englewood Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Englewood&apos;s identity is shaped by its proximity to some of
              the region&apos;s most important healthcare infrastructure. Swedish
              Medical Center and Craig Hospital draw nurses, physicians,
              therapists, and administrative staff who often carry complex
              benefit packages — employer-sponsored retirement contributions,
              health savings accounts, and education assistance programs that
              require careful handling at tax time. We understand the specific
              W-2 boxes and supplemental schedules that healthcare employers
              generate and make sure nothing gets missed.
            </p>
            <p className="text-text-secondary mb-4">
              South Broadway is one of the metro area&apos;s most distinctive
              small business corridors. Antique dealers, restaurants, boutiques,
              tattoo studios, and service businesses line the street, many of
              them owner-operated sole proprietors or single-member LLCs. We
              work with Englewood&apos;s small business community to navigate
              Schedule C deductions, quarterly estimated payments, and the
              Arapahoe County business licensing considerations that come with
              operating just outside Denver city limits.
            </p>
            <p className="text-text-secondary">
              Englewood&apos;s older residential neighborhoods also generate a
              specific set of tax situations: landlords renting bungalows and
              duplexes, homeowners selling properties that have appreciated
              significantly, and residents who split time between Englewood and
              rental properties elsewhere. We handle depreciation schedules,
              capital gains planning, and the Arapahoe County property tax
              landscape so you can make informed decisions year-round, not just
              at filing time.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Englewood
            </h2>
            <ul className="space-y-3">
              {siteConfig.services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="text-alpine-teal hover:underline font-semibold"
                  >
                    {service.title}
                  </Link>
                  <span className="text-text-secondary">
                    {' '}
                    — {service.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Virtual Service */}
      <section className="section-padding bg-white">
        <div className="container-content max-w-3xl space-y-12">
          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Flexible Virtual Service
            </h2>
            <p className="text-text-secondary mb-4">
              Healthcare professionals with unpredictable schedules find our
              virtual workflow especially practical: upload your documents
              through our secure TaxDome portal, schedule a video call that
              fits your shift schedule, and sign electronically from wherever
              you are.
            </p>
            <p className="text-text-secondary">
              Secure document upload, video consultations, and e-signatures
              mean you get the same careful, accurate outcome without
              rearranging your day. It&apos;s a streamlined process designed
              for busy Englewood professionals and business owners.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 30-minute consultation to discuss your tax
              situation. Whether you&apos;re a healthcare professional sorting
              out your benefits package, a South Broadway business owner, or an
              Englewood homeowner with rental income, we&apos;ll find the right
              approach for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
