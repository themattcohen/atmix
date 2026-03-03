import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Centennial Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Centennial, CO residents. Virtual appointments available. Starting at $600.',
};

export default function CentennialPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/centennial',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Centennial',
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
              { label: 'Centennial' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Centennial Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Centennial, one of Colorado&apos;s newest cities, is home to some of
            the state&apos;s highest-earning households. With above-average
            incomes come above-average tax complexity — and that&apos;s where
            Alpine Tax comes in.
          </p>
        </div>
      </section>

      {/* Why Centennial */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Centennial Residents Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Incorporated in 2001, Centennial quickly became one of the most
              desirable addresses in the south metro area. Situated along the
              I-25 tech corridor and adjacent to the Denver Tech Center, many
              Centennial residents work in software, engineering, financial
              services, and healthcare management. That professional profile
              means returns with RSU vesting schedules, incentive stock options,
              deferred compensation plans, and employer equity grants.
            </p>
            <p className="text-text-secondary mb-4">
              We frequently work with dual-income Centennial families who have
              complicated withholding situations. When both spouses earn well
              into six figures, standard W-4 withholding often falls short.
              We help these families plan proactively throughout the year so
              there are no unpleasant surprises in April. That includes
              quarterly estimated payment calculations and mid-year withholding
              adjustments.
            </p>
            <p className="text-text-secondary">
              Investment income is another hallmark of our Centennial clients.
              Brokerage accounts, rental properties in the metro area, 529 plan
              contributions for multiple children, and backdoor Roth conversions
              all require careful handling. We stay current on the thresholds,
              phase-outs, and planning strategies that make a real difference at
              these income levels.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Centennial
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

      {/* Getting Started */}
      <section className="section-padding bg-white">
        <div className="container-content max-w-3xl">
          <h2 className="font-heading text-3xl text-alpine-blue mb-4">
            How to Get Started
          </h2>
          <p className="text-text-secondary mb-4">
            Most of our Centennial clients prefer virtual appointments — upload
            documents through TaxDome, hop on a quick video call to review, and
            e-sign from anywhere. It&apos;s a streamlined process designed to
            fit around your busy schedule.
          </p>
          <p className="text-text-secondary">
            Whether you need proactive tax planning to optimize your stock
            compensation or a thorough review of your family&apos;s multi-source
            income, schedule a free consultation to get started.
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
