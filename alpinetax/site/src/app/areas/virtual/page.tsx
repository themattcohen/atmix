import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Virtual Tax Preparation — Serving Clients Nationwide',
  description:
    'File your taxes from anywhere. Secure document upload, video consultations, and electronic signatures through our TaxDome portal.',
};

export default function VirtualPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          name: siteConfig.name,
          url: siteConfig.url + '/areas/virtual',
          telephone: siteConfig.phoneTel,
          areaServed: {
            '@type': 'Country',
            name: 'United States',
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
              { label: 'Virtual' },
            ]}
          />
          <h1 className="font-heading text-4xl md:text-5xl text-alpine-blue mt-4 mb-6">
            Virtual Tax Preparation — Serving Clients Nationwide
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl">
            You do not need to live in Colorado to work with Alpine Tax. We
            serve clients in all 50 states through our fully virtual tax
            preparation process — same quality, same personal attention, no
            geography required.
          </p>
        </div>
      </section>

      {/* How Virtual Works */}
      <section className="section-padding bg-alpine-cream">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              How Virtual Tax Preparation Works
            </h2>
            <p className="text-text-secondary mb-6">
              Our virtual process is built on TaxDome, a secure client portal
              designed specifically for tax and accounting firms. Everything
              happens in one place — document uploads, messaging, video calls,
              and electronic signatures.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="font-heading text-xl text-alpine-blue mb-2">
                  Step 1: Upload Your Documents
                </h3>
                <p className="text-text-secondary">
                  After your initial consultation, we send you a personalized
                  document request through TaxDome. You upload your W-2s,
                  1099s, receipts, and any other documents directly into the
                  portal. Everything is encrypted end-to-end — far more secure
                  than email attachments or physical mail.
                </p>
              </div>

              <div>
                <h3 className="font-heading text-xl text-alpine-blue mb-2">
                  Step 2: Review Call
                </h3>
                <p className="text-text-secondary">
                  Once we&apos;ve prepared your draft return, we schedule a
                  video or phone call to walk through it together. We explain
                  every line item, answer your questions, and make sure nothing
                  was missed. This is the same thorough review every
                  client receives.
                </p>
              </div>

              <div>
                <h3 className="font-heading text-xl text-alpine-blue mb-2">
                  Step 3: Sign & File
                </h3>
                <p className="text-text-secondary">
                  After you approve the return, you sign electronically through
                  TaxDome and we e-file on your behalf. You get a confirmation
                  and a copy of your complete return stored securely in your
                  portal — accessible anytime you need it.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Who Our Virtual Service Is For
            </h2>
            <ul className="space-y-3 text-text-secondary">
              <li>
                <strong className="text-text-primary">Expats and frequent movers</strong>{' '}
                — If you relocate often for work, having a tax preparer who
                follows you regardless of address saves time and eliminates the
                yearly search for someone new.
              </li>
              <li>
                <strong className="text-text-primary">Remote workers outside Colorado</strong>{' '}
                — Maybe you found us through a referral or your company is based
                in Denver but you work from another state. We handle multi-state
                filing seamlessly.
              </li>
              <li>
                <strong className="text-text-primary">People who value convenience</strong>{' '}
                — Whether it&apos;s a scheduling constraint, a disability, or
                simply personal preference, you get top-caliber service
                without leaving home.
              </li>
              <li>
                <strong className="text-text-primary">Busy professionals</strong>{' '}
                — Upload documents at midnight, review your return over lunch.
                Virtual works around your schedule, not ours.
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section-padding bg-white">
        <div className="container-content space-y-12">
          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              All Services Available Virtually
            </h2>
            <p className="text-text-secondary mb-4">
              Every service we offer is available through our virtual process.
              There is no reduced scope or simplified version — you get the
              full service.
            </p>
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

          <div className="max-w-3xl">
            <h2 className="font-heading text-3xl text-alpine-blue mb-4">
              Get Started
            </h2>
            <p className="text-text-secondary">
              Book a free 15-minute consultation. We&apos;ll discuss your tax
              situation, recommend the right service, and set up your TaxDome
              portal so you can get started right away. No commitment, no
              pressure — just a straightforward conversation about how we can
              help.
            </p>
          </div>
        </div>
      </section>

      <CallToAction />
    </>
  );
}
