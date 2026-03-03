import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'About Vinnie Boettcher — Alpine Tax & Consulting',
  description:
    'Meet Vinnie Boettcher, founder of Alpine Tax & Consulting. Nearly a decade of tax preparation experience serving individuals and small businesses.',
};

export default function AboutPage() {
  return (
    <>
      <div className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'About' },
            ]}
          />

          <div className="max-w-3xl mt-6">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mb-6">
              About Vinnie Boettcher
            </h1>

            <div className="flex flex-col md:flex-row gap-8 mb-8">
              <div className="flex-shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-alpine-blue flex items-center justify-center">
                  <span className="text-4xl md:text-5xl font-heading font-bold text-white">VB</span>
                </div>
              </div>
              <div className="space-y-4 text-text-secondary text-lg leading-relaxed">
                <p>
                  Vinnie Boettcher is the founder of Alpine Tax &amp; Consulting, a tax
                  preparation and consulting practice built on a simple idea: your tax preparer should
                  actually know you.
                </p>
                <p>
                  With nearly a decade of experience preparing individual and small business tax returns,
                  Vinnie has built his practice around personal attention, transparent pricing, and
                  proactive advice — the opposite of the high-volume, impersonal approach you get from
                  big-box tax chains.
                </p>
              </div>
            </div>

            <div className="space-y-4 text-text-secondary text-lg leading-relaxed mb-12">
              <p>
                Vinnie is an IRS-registered tax preparer and PTIN holder. He specializes in individual
                returns, small business filings (Schedule C, LLCs, S-Corps, and partnerships), tax
                planning, and IRS correspondence.
              </p>
              <p>
                Vinnie serves clients throughout Colorado — including the Denver metro area, Aurora,
                Lakewood, Centennial, Littleton, Englewood, Greenwood Village, Highlands Ranch, Parker,
                Castle Rock, and Thornton — and nationwide through secure virtual appointments via the
                TaxDome client portal.
              </p>
              <p>
                Every client works directly with Vinnie from start to finish, ensuring consistency
                and personalized attention throughout the entire process. When you call, Vinnie answers.
                When you have a question in July, Vinnie is available. That continuity is what makes the
                difference between a tax preparer who files your return and one who actually understands
                your financial picture.
              </p>
            </div>
          </div>
        </div>
      </div>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-heading font-bold text-alpine-blue">Nearly 10 Years</p>
              <p className="text-text-secondary mt-1">Tax Preparation Experience</p>
            </div>
            <div>
              <p className="text-3xl font-heading font-bold text-alpine-blue">IRS-Registered</p>
              <p className="text-text-secondary mt-1">PTIN Holder</p>
            </div>
            <div>
              <p className="text-3xl font-heading font-bold text-alpine-blue">Monday–Friday</p>
              <p className="text-text-secondary mt-1">9 AM – 5 PM Availability</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-content max-w-3xl">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Services Offered
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
                <span className="text-text-secondary"> — {service.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CallToAction
        heading="Ready to Work Together?"
        description="Schedule a free 15-minute consultation and see how Alpine Tax can help with your tax situation."
      />
    </>
  );
}
