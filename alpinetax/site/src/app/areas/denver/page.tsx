import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Denver Tax Preparation & Consulting',
  description:
    'Personal and small business tax preparation for Denver, CO residents. Virtual appointments available. Starting at $600.',
};

export default function DenverPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/denver',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Denver',
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
              { label: 'Denver' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Denver Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting serves clients throughout the Denver metro
            area — from Capitol Hill to Cherry Creek, from RiNo to Wash Park.
            Whether you live in a Baker bungalow or a Stapleton townhome, we
            bring the same careful, personal approach to every return.
          </p>
        </div>
      </section>

      {/* Why Denver Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Denver Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Denver&apos;s economy is as diverse as its neighborhoods. Tech
              startups along the Platte River corridor, restaurants and
              breweries clustered in the Highlands, real estate investors
              renovating Victorian homes in Curtis Park, creative professionals
              freelancing from coffee shops in Tennyson Street — each has a
              different tax story to tell.
            </p>
            <p className="text-text-secondary mb-4">
              Our proximity to the state capitol means we stay current with
              Colorado-specific tax changes the moment they&apos;re signed into
              law. From the TABOR refund calculations that trip up newcomers to
              the state enterprise zone credits that many Denver businesses miss
              entirely, we know the Colorado tax landscape inside and out.
            </p>
            <p className="text-text-secondary">
              Denver residents also face unique situations: short-term rental
              income from ADUs in West Highland, stock options from the booming
              DTC tech scene, cannabis industry accounting complexities, and the
              ever-changing Denver Occupational Privilege Tax. We handle all of
              it without blinking.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Denver
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
              Handle everything from your couch in Congress Park or your
              home office in Wash Park. Upload your documents through our
              secure TaxDome portal, schedule a video call, and sign
              electronically — no driving required.
            </p>
            <p className="text-text-secondary">
              Our virtual workflow is designed for busy Denver professionals.
              Secure document upload, video consultations, and e-signatures
              mean you get the same careful, personal service without
              rearranging your schedule.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 15-minute consultation to discuss your tax
              situation. Whether you&apos;re a first-time filer fresh off a move
              to Denver or a longtime Coloradan with a complex portfolio,
              we&apos;ll find the right approach for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
