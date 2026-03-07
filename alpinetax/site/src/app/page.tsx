import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { CallToAction } from '@/components/CallToAction';
import { ServiceCard } from '@/components/ServiceCard';
import { siteConfig } from '@/lib/site-config';

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url,
          telephone: siteConfig.phoneTel,
          email: siteConfig.email,
          address: {
            '@type': 'PostalAddress',
            streetAddress: siteConfig.address.street,
            addressLocality: siteConfig.address.city,
            addressRegion: siteConfig.address.state,
            postalCode: siteConfig.address.zip,
            addressCountry: siteConfig.address.country,
          },

          priceRange: '$$',
          areaServed: [
            { '@type': 'City', name: 'Denver' },
            { '@type': 'State', name: 'Colorado' },
            { '@type': 'Country', name: 'United States' },
          ],
          serviceType: [
            'Tax Preparation',
            'Tax Planning',
            'Small Business Tax',
            'S-Corp Tax Returns',
          ],
        }}
      />

      {/* Hero */}
      <section className="bg-alpine-blue px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="container-content text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl text-white mb-4">
            Tax Preparation — Personal Attention, Real Results
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-heading mb-4">
            Personal attention. Transparent pricing. Year-round support.
          </p>
          <p className="text-lg text-white/80 max-w-2xl mx-auto mb-4">
            Work directly with an experienced tax professional who takes the time to
            understand your situation &mdash; not a revolving door of seasonal staff.
          </p>
          <p className="text-base text-white/70 max-w-xl mx-auto mb-8">
            Nearly a decade of experience serving individuals and small businesses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link href="/schedule" className="btn-primary">
              Schedule a Consultation
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center justify-center px-6 py-3 border-2 border-white text-white font-heading font-bold rounded-lg hover:bg-white hover:text-alpine-blue transition-colors duration-200 text-base"
            >
              View Services
            </Link>
          </div>
          <p className="text-white/80 text-lg">
            Call us:{' '}
            <a
              href={`tel:${siteConfig.phoneTel}`}
              className="text-white font-semibold hover:underline"
            >
              {siteConfig.phone}
            </a>
          </p>
        </div>
      </section>

      {/* Credibility Stats */}
      <section className="bg-white border-b border-gray-100">
        <div className="container-content py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-heading font-bold text-alpine-blue">Nearly 10 Years</p>
              <p className="text-text-secondary text-sm mt-1">Tax Preparation Experience</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-alpine-blue">Nationwide Service</p>
              <p className="text-text-secondary text-sm mt-1">Virtual &amp; Secure</p>
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-alpine-blue">Year-Round</p>
              <p className="text-text-secondary text-sm mt-1">Availability</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="section-padding bg-white">
        <div className="container-content">
          <h2 className="text-3xl md:text-4xl text-alpine-blue text-center mb-12">
            Tax Preparation Made Simple
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: 'Schedule',
                description:
                  'Book a free 30-minute consultation to discuss your situation.',
              },
              {
                step: 2,
                title: 'Prepare',
                description:
                  'Upload your documents securely. We handle the rest.',
              },
              {
                step: 3,
                title: 'File',
                description:
                  'Review your return, sign electronically, and you\u2019re done.',
              },
            ].map(({ step, title, description }) => (
              <div key={step} className="text-center">
                <div className="w-14 h-14 rounded-full bg-alpine-teal text-white text-xl font-heading font-bold flex items-center justify-center mx-auto mb-4">
                  {step}
                </div>
                <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                  {title}
                </h3>
                <p className="text-text-secondary leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl md:text-4xl text-alpine-blue text-center mb-12">
            Tax Services for Every Situation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {siteConfig.services.map((service) => (
              <ServiceCard
                key={service.slug}
                title={service.title}
                description={service.description}
                href={`/services/${service.slug}`}
                startingPrice={service.startingPrice}
              />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/services"
              className="inline-flex items-center text-alpine-teal font-heading font-semibold text-lg hover:underline"
            >
              View All Services
              <span className="ml-1" aria-hidden="true">
                &rarr;
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Alpine Tax */}
      <section className="section-padding bg-white">
        <div className="container-content">
          <h2 className="text-3xl md:text-4xl text-alpine-blue text-center mb-12">
            Why Clients Choose Alpine Tax
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: 'Direct Access',
                description:
                  'Work with Vinnie directly, not a rotating cast of seasonal preparers.',
              },
              {
                title: 'Transparent Pricing',
                description:
                  'Know your cost upfront. No surprise fees, no hidden charges.',
              },
              {
                title: 'Year-Round Support',
                description:
                  'Questions don\u2019t wait until April. We\u2019re available when you need us.',
              },
              {
                title: 'Flexible Virtual Service',
                description:
                  'Meet securely from anywhere — same quality and personal attention, no commute required.',
              },
            ].map(({ title, description }) => (
              <div key={title} className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-alpine-teal/10 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-alpine-teal" />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-alpine-blue mb-1">
                    {title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl md:text-4xl text-alpine-blue text-center mb-8">
            Serving Clients Nationwide
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {siteConfig.serviceAreas.map((area) => (
              <Link
                key={area}
                href={`/areas/${area.toLowerCase().replace(/\s+/g, '-')}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-text-secondary hover:border-alpine-teal hover:text-alpine-teal transition-colors duration-200"
              >
                {area}, CO
              </Link>
            ))}
            <span className="px-4 py-2 bg-white border border-gray-200 rounded-full text-text-secondary">
              Virtual (Nationwide)
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <CallToAction />
    </>
  );
}
