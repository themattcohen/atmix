import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ServiceCard } from '@/components/ServiceCard';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Tax Services for Individuals & Small Businesses',
  description:
    'Alpine Tax & Consulting offers personal tax preparation, small business returns, S-Corp filings, and proactive tax planning in Denver, CO.',
};

export default function ServicesPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Tax Preparation & Consulting Services',
          provider: {
            '@type': 'AccountingService',
            name: siteConfig.name,
            url: siteConfig.url,
          },
          areaServed: siteConfig.serviceAreas.map((area) => ({
            '@type': 'City',
            name: `${area}, CO`,
          })),
          description: metadata.description,
        }}
      />

      <div className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Services' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            Tax Services for Individuals & Small Businesses
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed mb-12">
            <p>
              Tax season doesn&rsquo;t have to be stressful. At Alpine Tax &amp; Consulting, you
              work directly with Vinnie Boettcher — an experienced tax professional who takes the
              time to understand your situation, not a rotating cast of strangers at a high-volume
              tax mill.
            </p>
            <p>
              Based in Denver and serving clients across the metro area and nationwide via virtual
              appointments, Alpine Tax delivers the kind of personal attention that larger firms
              can&rsquo;t afford to give you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
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
        </div>
      </div>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Who Alpine Tax Serves
          </h2>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li className="flex items-start gap-2">
              <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
              Individuals and families in Denver, Aurora, Lakewood, Centennial, Littleton,
              Englewood, Greenwood Village, and Highlands Ranch
            </li>
            <li className="flex items-start gap-2">
              <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
              Self-employed professionals and freelancers
            </li>
            <li className="flex items-start gap-2">
              <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
              Small business owners operating as sole proprietors, LLCs, S-Corps, or partnerships
            </li>
            <li className="flex items-start gap-2">
              <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
              Clients nationwide through secure virtual tax preparation
            </li>
          </ul>
        </div>
      </section>

      <CallToAction
        heading="Ready to Get Started?"
        description="Schedule a consultation and find out how Alpine Tax & Consulting can simplify your taxes — this year and every year after."
      />
    </>
  );
}
