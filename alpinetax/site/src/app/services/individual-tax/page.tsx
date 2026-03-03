import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Individual Tax Preparation in Denver, CO',
  description:
    'Personal federal and state tax preparation in Denver for W-2 employees, freelancers, self-employed, and multi-state filers.',
};

export default function IndividualTaxPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Individual Tax Preparation',
          name: 'Individual Tax Preparation',
          provider: {
            '@type': 'AccountingService',
            name: siteConfig.name,
            url: siteConfig.url,
          },
          areaServed: {
            '@type': 'City',
            name: 'Denver, CO',
          },
          description: metadata.description,
        }}
      />

      <div className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Services', href: '/services' },
              { label: 'Individual Tax Preparation' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            Individual Tax Preparation
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>Your taxes are personal. Your tax preparer should treat them that way.</p>
            <p>
              At Alpine Tax &amp; Consulting, every individual return is prepared by Vinnie
              Boettcher — an experienced, IRS-registered tax professional who reviews your situation
              in full, asks the right questions, and makes sure your return is accurate and complete.
              You won&rsquo;t get handed off to a junior preparer or rushed through a checklist.
            </p>
          </div>
        </div>
      </div>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Who This Service Is For
          </h2>
          <p className="text-text-secondary text-lg mb-4 max-w-3xl">
            Individual tax preparation at Alpine Tax is a good fit if you are:
          </p>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li>
              A <strong>W-2 employee</strong> with straightforward income or itemized deductions
            </li>
            <li>
              A <strong>freelancer or independent contractor</strong> with 1099 income and business
              expenses
            </li>
            <li>
              <strong>Self-employed</strong> and navigating Schedule C, self-employment tax, and
              home office deductions
            </li>
            <li>
              A <strong>multi-state filer</strong> who lived or worked in more than one state during
              the year
            </li>
            <li>
              Someone with <strong>investment income</strong>, rental income, or other less-common
              tax situations
            </li>
            <li>
              Looking to <strong>amend a prior-year return</strong> that was filed incorrectly
              elsewhere
            </li>
          </ul>
          <p className="text-text-secondary text-lg mt-4 max-w-3xl">
            If your tax situation doesn&rsquo;t fit neatly into a box, that&rsquo;s exactly when
            personal attention matters most.
          </p>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-8">
            What&rsquo;s Included
          </h2>
          <div className="max-w-3xl space-y-8">
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Federal and State Returns
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Alpine Tax prepares your federal return and any required state returns together,
                reviewing each for consistency and accuracy.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Deduction Review
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Every return includes a review of available deductions and credits — including
                commonly missed items like student loan interest, educator expenses, energy credits,
                and medical expenses that meet the threshold.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Year-Over-Year Comparison
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Unusual changes in your refund or balance due don&rsquo;t go unexamined. If
                something looks different from last year, it gets explained.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Prior Year Amendments
              </h3>
              <p className="text-text-secondary leading-relaxed">
                If a previous return had errors or omissions, Alpine Tax can prepare an amended
                return (Form 1040-X) to correct the record and potentially recover what you
                overpaid.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Year-Round Availability
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Tax questions don&rsquo;t wait until April. Alpine Tax clients have access to
                support throughout the year — not just during filing season.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Why Choose Alpine Tax
          </h2>
          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              Denver has no shortage of tax prep options, from national chains to pop-up seasonal
              offices. What those services typically can&rsquo;t offer is continuity, context, and
              genuine attention to your file.
            </p>
            <p>
              At Alpine Tax, you&rsquo;re not a ticket number. Vinnie takes the time to understand
              your financial picture, explain what he&rsquo;s doing and why, and flag opportunities
              or risks that affect you specifically. Many clients find that a single conversation
              surfaces deductions or planning moves they hadn&rsquo;t considered.
            </p>
            <p>
              Whether you&rsquo;re filing virtually through our secure portal or connecting by video
              call from anywhere in the country, the experience is the same: direct, thorough, and personal.
            </p>
          </div>
        </div>
      </section>

      <CallToAction
        heading="Ready to Book?"
        description="Filing season fills up quickly. Schedule your appointment early to ensure availability."
        buttonText="Book Your Tax Appointment"
      />
    </>
  );
}
