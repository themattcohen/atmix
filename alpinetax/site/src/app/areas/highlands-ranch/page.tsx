import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Highlands Ranch Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Highlands Ranch, CO residents. Virtual appointments available. Starting at $600.',
};

export default function HighlandsRanchPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/highlands-ranch',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Highlands Ranch',
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
              { label: 'Highlands Ranch' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Highlands Ranch Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Highlands Ranch is one of the largest master-planned communities in
            the country, home to over 100,000 residents. With its concentration
            of professional families and proximity to the Denver Tech Center, it
            is also one of the most tax-complex communities we serve.
          </p>
        </div>
      </section>

      {/* Why Highlands Ranch */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Highlands Ranch Residents Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Highlands Ranch families tend to have returns that are anything but
              simple. Many households have two high-earning professionals — one
              commuting up C-470 to the DTC, the other working from a home
              office. That combination creates layered tax situations involving
              dual W-2 withholding optimization, home office deductions, child
              and dependent care credits, and education savings strategies for
              multiple children.
            </p>
            <p className="text-text-secondary mb-4">
              The community&apos;s proximity to the tech and financial services
              firms clustered along the I-25 corridor means we frequently see
              equity compensation packages. RSUs, ISOs, ESPP shares, and
              deferred compensation plans each have their own vesting schedules,
              holding period rules, and AMT implications. We track all of it
              and coordinate with our clients&apos; financial advisors to time
              sales and exercises strategically.
            </p>
            <p className="text-text-secondary">
              The remote work shift has also been significant in Highlands Ranch.
              We now serve a growing number of residents who run consulting
              firms, e-commerce businesses, or freelance practices from home.
              For these clients, we handle the full spectrum of self-employment
              tax — from quarterly estimated payments and SE tax calculations to
              retirement plan contributions that reduce their taxable income
              while building long-term wealth.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Highlands Ranch
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
            Most Highlands Ranch clients prefer the efficiency of virtual
            appointments — upload documents to our TaxDome portal, schedule a
            video review, and e-sign your return without leaving home. Our
            secure portal and video calls make the entire process convenient
            and personal.
          </p>
          <p className="text-text-secondary">
            Schedule a free 30-minute consultation to discuss your family&apos;s
            tax situation. We&apos;ll outline the right service, give you a
            clear price, and get started whenever you&apos;re ready.
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
