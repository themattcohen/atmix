import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Lakewood Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Lakewood, CO residents. Virtual appointments available. Starting at $600.',
};

export default function LakewoodPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/lakewood',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Lakewood',
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
              { label: 'Lakewood' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Lakewood Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Lakewood sits at the gateway to the mountains, blending established
            neighborhoods with new development and a growing independent
            business community. We help Lakewood residents and business owners
            keep more of what they earn.
          </p>
        </div>
      </section>

      {/* Why Lakewood */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Lakewood Residents Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Lakewood is a city of contrasts. The Denver Federal Center
              employs thousands of government workers with TSP accounts, pension
              contributions, and locality pay calculations. A few miles west,
              the trails around Green Mountain are filled with outdoor guides,
              personal trainers, and freelance photographers who file Schedule C
              returns. The Belmar district hums with independent retailers and
              restaurant owners managing payroll, sales tax, and quarterly
              estimated payments.
            </p>
            <p className="text-text-secondary mb-4">
              We see a high number of self-employed and home-based businesses
              among our Lakewood clients. If you run a business from your home
              near Bear Creek, or you&apos;re a contractor working up and down
              the I-70 corridor, we know how to maximize your legitimate
              deductions — home office, vehicle mileage, equipment
              depreciation — while keeping you solidly within IRS guidelines.
            </p>
            <p className="text-text-secondary">
              Lakewood&apos;s outdoor recreation economy also brings unique tax
              considerations. Seasonal income patterns, equipment purchases that
              qualify for Section 179 expensing, and the business-versus-hobby
              distinction that the IRS scrutinizes closely — these are everyday
              questions for us, not edge cases.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Lakewood
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
            Our secure TaxDome portal makes it easy for Lakewood clients to
            handle everything online — upload documents, message us with
            questions, schedule a video call, and sign your return
            electronically.
          </p>
          <p className="text-text-secondary">
            Schedule a free consultation and tell us about your situation.
            We&apos;ll recommend the right service and walk you through exactly
            what to expect — no surprises.
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
