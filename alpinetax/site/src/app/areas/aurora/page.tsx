import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Aurora Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Aurora, CO residents. Virtual appointments available. Starting at $600.',
};

export default function AuroraPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/aurora',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Aurora',
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
              { label: 'Aurora' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Aurora Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Aurora is the third-largest city in Colorado and one of the most
            diverse communities in the state. From the medical professionals at
            the Anschutz campus to the small business owners along Havana Street,
            Aurora residents face tax situations that demand experienced, detail-
            oriented preparation.
          </p>
        </div>
      </section>

      {/* Why Aurora */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Aurora Residents Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Aurora&apos;s economy stretches from the world-class Fitzsimons
              Innovation Campus and UCHealth University of Colorado Hospital to
              the retail corridors of Southlands and the revitalizing Original
              Aurora district along Colfax. That economic range means our Aurora
              clients bring us everything from straightforward W-2 returns to
              intricate small business filings.
            </p>
            <p className="text-text-secondary mb-4">
              Military families stationed at Buckley Space Force Base are a
              significant part of our Aurora practice. We understand the
              particular challenges of military tax situations: combat zone
              exclusions, PCS move deductions, multi-state filing requirements
              when a spouse earns income in a different state, and the often-
              overlooked education credits available to active duty members.
            </p>
            <p className="text-text-secondary">
              Many Aurora residents commute into Denver, the DTC, or even
              Colorado Springs. That cross-jurisdictional commuting can create
              multi-municipality tax obligations that are easy to overlook —
              but not if your tax preparer knows to look for them. We make sure
              nothing falls through the cracks.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Aurora
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
            We offer fully virtual appointments for Aurora residents. Upload
            your documents through our secure client portal, schedule a call or
            video meeting at a time that fits your schedule, and we&apos;ll
            handle the rest.
          </p>
          <p className="text-text-secondary">
            Whether you&apos;re a healthcare worker at Anschutz juggling student
            loan interest deductions, a Buckley family navigating a PCS move, or
            a restaurant owner on Havana Street tracking tips and inventory, we
            have the experience to get your return right.
          </p>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
