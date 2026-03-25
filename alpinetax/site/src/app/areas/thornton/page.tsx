import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Thornton Tax Preparation & Consulting',
  description:
    'Tax preparation for Thornton, CO residents and small businesses in north metro Denver. Starting at $600.',
};

export default function ThorntonPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/thornton',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'City',
            name: 'Thornton',
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
              { label: 'Thornton' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Thornton Tax Preparation & Consulting
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            Alpine Tax & Consulting works with residents and business owners
            throughout Thornton and the north metro Denver corridor — from
            Original Thornton and Eastlake to Todd Creek, from the I-25 and
            E-470 interchange communities to the growing neighborhoods near
            the North Metro area. Thornton&apos;s economic diversity is one
            of its strengths, and we&apos;re equipped to serve the full range
            of tax situations that diversity creates.
          </p>
        </div>
      </section>

      {/* Why Thornton Clients Choose Us */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Why Thornton Clients Choose Alpine Tax
            </h2>
            <p className="text-text-secondary mb-4">
              Thornton has one of the most economically diverse workforces in
              the north metro region. Manufacturing employees, healthcare
              workers, retail business owners, service industry professionals,
              and a growing population of remote workers and freelancers all
              call Thornton home — and each group carries a different set of
              tax considerations. We work across all of these situations,
              from W-2 employees looking to maximize deductions to self-employed
              Thornton residents building a client base and navigating
              quarterly estimated payments for the first time.
            </p>
            <p className="text-text-secondary mb-4">
              Thornton&apos;s location in Adams County creates specific tax
              considerations that residents and business owners near the
              Westminster and Broomfield borders encounter more than most.
              Multi-jurisdictional business operations — a business that
              physically operates in Thornton but serves customers across
              Adams, Broomfield, and Jefferson counties — face sales tax
              collection obligations and business licensing requirements that
              vary by jurisdiction. We help Thornton businesses understand
              exactly where their obligations lie and set up compliant
              practices from the start.
            </p>
            <p className="text-text-secondary">
              Some areas of Thornton and Adams County also see oil and gas
              royalty income from mineral rights — income that appears on a
              1099 and can catch recipients off guard at tax time. Royalty
              income carries its own depletion deduction rules, severance tax
              considerations, and self-employment tax treatment that differs
              from ordinary income. We handle mineral rights and royalty income
              correctly, making sure Thornton clients with this income type
              are neither over-reporting nor missing deductions they&apos;re
              entitled to take.
            </p>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Services Available in Thornton
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
              Thornton clients no longer need to fight I-25 traffic to reach
              a qualified tax preparer. Our virtual process is designed for
              north metro residents who want professional-grade service without
              the commute south: upload your documents through our secure
              TaxDome portal, meet via video call on a schedule that works for
              your household, and sign electronically from home. We offer
              scheduling flexibility that accommodates shift workers and busy
              family schedules.
            </p>
            <p className="text-text-secondary">
              North metro clients often tell us they stayed with less capable
              preparers for years simply because they couldn&apos;t find a
              good option nearby. Our virtual model removes that barrier
              entirely — you get the same quality of service as any client,
              regardless of where you live in the metro area.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Schedule a free 30-minute consultation to discuss your tax
              situation. Whether you&apos;re a Thornton small business owner
              navigating multi-jurisdictional obligations, a north metro
              resident with royalty income to sort out, or a W-2 employee
              who wants to make sure they&apos;re not leaving money on the
              table, we&apos;ll find the right approach for you.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
