import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'S-Corp & Partnership Tax Returns in Denver, CO',
  description:
    'Expert S-Corp and partnership tax preparation in Denver. Form 1120-S, Form 1065, K-1s, reasonable compensation analysis.',
};

export default function SCorpPartnershipPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'S-Corp & Partnership Tax Preparation',
          name: 'S-Corp & Partnership Returns',
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
              { label: 'S-Corp & Partnership Returns' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            S-Corp &amp; Partnership Returns
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              S-Corps and partnerships are not just more complicated tax forms — they&rsquo;re a
              fundamentally different way of running a business with distinct rules, opportunities,
              and traps. Getting them right matters, and getting them wrong is expensive.
            </p>
            <p>
              Alpine Tax &amp; Consulting specializes in pass-through entity returns for S-Corps,
              partnerships, and multi-member LLCs. This is the service where the difference between
              an experienced, attentive tax professional and a generic filing service is most
              apparent.
            </p>
          </div>
        </div>
      </div>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Who This Service Is For
          </h2>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li>
              <strong>S-Corp shareholders</strong> who are also active in the business and need both
              the 1120-S and their personal return handled in coordination
            </li>
            <li>
              <strong>Partnership members</strong> and <strong>multi-member LLC owners</strong>{' '}
              filing under partnership rules
            </li>
            <li>
              <strong>Business owners considering an S-Corp election</strong> who want to understand
              the tax implications before committing
            </li>
            <li>
              <strong>Existing S-Corp owners</strong> who suspect their reasonable compensation
              isn&rsquo;t set correctly — or who&rsquo;ve never had it reviewed at all
            </li>
          </ul>
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
                Form 1120-S — S-Corporation Return
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Alpine Tax prepares the full S-Corp return including income, deductions, credits,
                and the shareholder Schedule K-1s that flow through to each owner&rsquo;s personal
                return. The entity return and personal returns are prepared together to ensure
                accuracy and consistency.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Form 1065 — Partnership Return
              </h3>
              <p className="text-text-secondary leading-relaxed">
                For partnerships and multi-member LLCs taxed as partnerships, Alpine Tax prepares
                the Form 1065 and the corresponding K-1s for each partner or member.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Schedule K-1 Preparation
              </h3>
              <p className="text-text-secondary leading-relaxed">
                K-1s are only useful if they&rsquo;re accurate. Alpine Tax prepares K-1s that
                correctly reflect each owner&rsquo;s share of income, deductions, and credits — and
                explains what each line means for their personal return.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Reasonable Compensation Analysis
              </h3>
              <p className="text-text-secondary leading-relaxed">
                This is one of the most consequential — and most misunderstood — requirements for
                S-Corp owners. The IRS requires that S-Corp owners who perform services for the
                business pay themselves a reasonable salary before taking distributions. Set it too
                low, and you risk an audit and back payroll taxes. Set it too high, and you eliminate
                the self-employment tax savings that make the S-Corp election valuable in the first
                place.
              </p>
              <p className="text-text-secondary leading-relaxed mt-3">
                Alpine Tax reviews your business activity, industry benchmarks, and compensation
                structure to help you establish and document a defensible reasonable compensation
                position.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                QBI Deduction Optimization
              </h3>
              <p className="text-text-secondary leading-relaxed">
                The Section 199A qualified business income deduction can reduce your pass-through
                income by up to 20% — but it comes with limitations tied to income level, W-2 wages
                paid, and whether your business is a specified service trade or business. Alpine Tax
                analyzes your eligibility and structures the return to maximize the deduction where
                appropriate.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                Officer Payroll Coordination
              </h3>
              <p className="text-text-secondary leading-relaxed">
                S-Corp owners running payroll for themselves need their W-2 and the corporate return
                to align. Alpine Tax coordinates with your payroll records to make sure everything is
                consistent and properly documented.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Why This Service Is Different
          </h2>
          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              Pass-through entity returns done well require more than filling out forms. They
              require understanding how the entity, the owner&rsquo;s compensation, and the personal
              return interact — and making deliberate decisions about each.
            </p>
            <p>
              Alpine Tax brings that integrated perspective. Vinnie reviews the full picture: entity
              structure, compensation strategy, deduction positioning, and how all of it flows to
              your personal return. Many business owners who come to Alpine Tax after working with
              general-purpose tax preparers find that there were planning opportunities being left
              unused year after year.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            A Note on Timing
          </h2>
          <p className="text-text-secondary text-lg max-w-3xl leading-relaxed">
            S-Corp and partnership returns (Forms 1120-S and 1065) are due March 15 — a full month
            before the individual filing deadline. If your entity return is late, your K-1s are
            late, and your personal return can&rsquo;t be filed on time either. Planning ahead
            matters.
          </p>
        </div>
      </section>

      <CallToAction
        heading="Ready to Talk About Your Business?"
        description="Schedule a consultation to discuss your S-Corp or partnership tax needs."
      />
    </>
  );
}
