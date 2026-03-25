import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Parker Tax Preparation & Consulting',
  description:
    'Tax preparation for families and small businesses in Parker, CO. Serving the I-25 corridor community. Starting at $600.',
};

export default function ParkerPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/parker',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Parker',
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
              { label: 'Parker' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Parker Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting serves families and small business owners
            throughout Parker and the surrounding I-25 corridor — from the
            Mainstreet district to the E-470 communities, from established
            neighborhoods near Cherry Creek State Park to newer developments
            along Parker Road. Parker is a community that takes its finances
            seriously, and we bring that same seriousness to your tax return.
          </p>
        </div>
      </section>

      {/* Why Parker Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Parker Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Parker is one of the fastest-growing family communities in
              Colorado, and the tax situations that come with family life are
              more complex than they used to be. Child tax credits, dependent
              care expenses, education savings plans, and the Lifetime Learning
              Credit all require careful coordination to maximize. Growing
              families making their first major home purchase in Douglas County
              also encounter questions about property tax deductions, mortgage
              interest, and what to do when their filing situation changes
              substantially from one year to the next. We guide Parker families
              through these transitions clearly and without jargon.
            </p>
            <p className="text-text-secondary mb-4">
              Parker has developed a substantial small business community along
              the Parker Road corridor and in the commercial areas near the PACE
              Center. Home-based businesses — consultants, freelancers, coaches,
              and service providers who work out of Parker but serve clients
              across the metro — make up a significant portion of the
              community&apos;s self-employed population. We know the home office
              deduction rules, vehicle mileage calculations, and self-employment
              tax structure that apply to this kind of work, and we help clients
              set up quarterly estimated payments so there are no surprises in
              April.
            </p>
            <p className="text-text-secondary">
              Parker residents who commute to the Denver Tech Center or downtown
              Denver face an interesting tax consideration: their income is
              earned in one jurisdiction while their life — and in some cases
              their home office — is rooted in Douglas County. We make sure
              commuters understand how Colorado handles income sourcing and what
              records to maintain throughout the year to support any deductions
              they&apos;re entitled to claim.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Parker
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
              For Parker commuters who already spend significant time on
              I-25 or E-470, our virtual service eliminates one more drive.
              Upload your documents through our secure TaxDome portal, meet
              with us via video call on your schedule, and sign electronically
              — no trip into the city required. We offer scheduling flexibility
              that works around busy family and work calendars.
            </p>
            <p className="text-text-secondary">
              Whether you&apos;re a busy Parker family squeezing in a tax
              appointment between kids&apos; activities or a home-based business
              owner who prefers to work remotely with your whole financial team,
              we&apos;ll meet you where you are.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 30-minute consultation to discuss your tax
              situation. Whether your family&apos;s finances got more
              complicated this year, you&apos;re starting a business out of
              your Parker home, or you just want a preparer who gives you more
              than a form and a handshake, we&apos;ll find the right approach
              for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
