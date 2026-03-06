import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Small Business Tax Preparation in Denver, CO',
  description:
    'Tax preparation for sole proprietors, LLCs, and small businesses in Denver.',
};

export default function SmallBusinessTaxPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Small Business Tax Preparation',
          name: 'Small Business Tax Preparation',
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
              { label: 'Small Business Tax' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            Small Business Tax Preparation
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              Small business owners wear enough hats. Tax preparation shouldn&rsquo;t be one of
              them.
            </p>
            <p>
              Alpine Tax &amp; Consulting works with sole proprietors, single-member LLCs, and
              multi-member business entities to handle their annual filings accurately and
              efficiently — and to make sure they&rsquo;re not paying more than they owe.
            </p>
            <p>
              Vinnie Boettcher brings hands-on experience with the tax issues that small business
              owners actually face: tracking deductible expenses, reconciling books before filing,
              planning for quarterly payments, and making smart decisions about business structure.
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
            This service is built for:
          </p>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li>
              <strong>Sole proprietors</strong> with business income reported on Schedule C
            </li>
            <li>
              <strong>Single-member LLCs</strong> taxed as disregarded entities
            </li>
            <li>
              <strong>Multi-member LLCs</strong> filing as partnerships or electing S-Corp status
            </li>
            <li>
              <strong>Side business owners</strong> who also have W-2 income and need both handled
              together
            </li>
            <li>
              <strong>New business owners</strong> who want guidance on how their entity choice
              affects their taxes
            </li>
          </ul>
          <p className="text-text-secondary text-lg mt-4 max-w-3xl">
            If your business is still small and growing, this is a good time to establish clean
            habits — and to make sure your structure is working for you, not against you.
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
                Schedule C Preparation
              </h3>
              <p className="text-text-secondary leading-relaxed">
                For sole proprietors and single-member LLCs, Alpine Tax prepares Schedule C with a
                full review of your income and deductible expenses — home office, vehicle use,
                equipment, professional services, and more.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Bookkeeping Review
              </h3>
              <p className="text-text-secondary leading-relaxed">
                If your records aren&rsquo;t perfectly organized going into tax season, that&rsquo;s
                not unusual. Alpine Tax will review what you have, identify gaps, and make sure the
                numbers feeding into your return are accurate.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Quarterly Estimated Tax Planning
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Self-employment income doesn&rsquo;t have withholding. Alpine Tax helps you
                calculate appropriate quarterly estimated tax payments so you avoid underpayment
                penalties and unpleasant surprises in April.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Entity Selection Guidance
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Choosing the right structure — sole proprietorship, LLC, S-Corp — has real tax
                consequences. Alpine Tax walks you through the trade-offs and helps you understand
                when a structure change makes financial sense.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Colorado and Multi-State Filings
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Colorado has its own business tax requirements, and if you operate across state
                lines, those obligations get more complex. Alpine Tax handles the full filing
                picture.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Proactive, Not Just Reactive
          </h2>
          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              A lot of tax preparers show up once a year, file what they&rsquo;re handed, and
              disappear. Alpine Tax takes a different approach: looking ahead to flag opportunities
              and risks before they show up on your return.
            </p>
            <p>
              That means conversations about retirement contribution strategies that reduce
              self-employment income, timing of equipment purchases, and year-end planning moves
              that only work if you act before December 31.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Serving Denver&rsquo;s Small Business Community
          </h2>
          <p className="text-text-secondary text-lg max-w-3xl leading-relaxed">
            Alpine Tax works with small business owners throughout the Denver metro area — including
            Aurora, Lakewood, Centennial, Littleton, Englewood, Greenwood Village, and Highlands
            Ranch — as well as clients nationwide through virtual appointments.
          </p>
        </div>
      </section>

      <CallToAction
        heading="Ready to Simplify Your Business Taxes?"
        description="Schedule a consultation and let Alpine Tax handle the tax side of your business."
      />
    </>
  );
}
