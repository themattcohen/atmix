import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Tax Planning & Consultation in Denver, CO',
  description:
    'Proactive tax planning for individuals and small businesses in Denver.',
};

export default function TaxPlanningPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Tax Planning & Consultation',
          name: 'Tax Planning & Consultation',
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
              { label: 'Tax Planning' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            Tax Planning &amp; Consultation
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              Filing your taxes accurately is the floor. Planning ahead is how you actually reduce
              what you owe.
            </p>
            <p>
              Most people only think about taxes in March and April, when it&rsquo;s too late to do
              anything other than report what already happened. Tax planning reverses that —
              it&rsquo;s a forward-looking process that identifies opportunities and potential
              problems while there&rsquo;s still time to act on them.
            </p>
            <p>
              Alpine Tax &amp; Consulting offers tax planning and consultation for individuals and
              small business owners who want to be strategic about their tax position, not just
              compliant with it.
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
            Tax planning is worth the conversation if you are:
          </p>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li>
              A <strong>business owner</strong> whose income fluctuates year to year and who wants
              to avoid underpayment penalties or large April surprises
            </li>
            <li>
              An <strong>S-Corp owner or partnership member</strong> with decisions to make about
              compensation, distributions, and retirement contributions before year-end
            </li>
            <li>
              An <strong>individual</strong> who had a significant income change — new job, business
              launch, home purchase, investment gains, or an inheritance
            </li>
            <li>
              Someone who <strong>recently formed a business</strong> and wants to understand how
              their entity choice affects their long-term tax liability
            </li>
            <li>
              Anyone who feels like they&rsquo;re always paying more than they should and wants a
              second opinion on why
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
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-alpine-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Mid-Year Tax Projection
              </h3>
              <p className="text-text-secondary leading-relaxed">
                A mid-year check-in estimates your current-year tax liability based on income to
                date and expected income through December. This gives you a clear picture of where
                you stand and time to take action before the year closes.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-alpine-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                Entity Structure Evaluation
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Sole proprietorship, LLC, S-Corp, partnership — each structure has different tax
                treatment. Alpine Tax analyzes whether your current structure is optimal for your
                income level and business activity, and models the projected tax impact of
                alternatives.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-alpine-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Retirement Contribution Optimization
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Retirement accounts are one of the most powerful tools available for reducing
                taxable income. Alpine Tax helps you determine how much to contribute to a SEP-IRA,
                Solo 401(k), SIMPLE IRA, or traditional IRA based on your income, self-employment
                status, and tax goals.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-alpine-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Estimated Tax Planning
              </h3>
              <p className="text-text-secondary leading-relaxed">
                If you have self-employment income, business income, or investment income without
                withholding, you&rsquo;re responsible for making quarterly estimated payments.
                Alpine Tax calculates what those payments should be and when they&rsquo;re due — in
                Colorado and federally — so you&rsquo;re not guessing.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-heading font-bold text-alpine-blue mb-2 flex items-center gap-2">
                <svg className="w-6 h-6 text-alpine-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                Year-End Planning Conversations
              </h3>
              <p className="text-text-secondary leading-relaxed">
                Some tax moves only work before December 31: accelerating deductible expenses,
                timing income recognition, making charitable contributions, and harvesting
                investment losses. A year-end planning session with Alpine Tax identifies which
                moves make sense for your situation.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Proactive vs. Reactive
          </h2>
          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              There&rsquo;s a real difference between a tax preparer and a tax planner. A preparer
              reports the past. A planner influences the future.
            </p>
            <p>
              Alpine Tax approaches every client relationship with a planning mindset — not just
              during formal planning sessions, but throughout the year. If something changes in your
              life or business that has tax implications, you should be able to call and talk it
              through before you make the decision, not after.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Planning Is Not Just for High Earners
          </h2>
          <p className="text-text-secondary text-lg max-w-3xl leading-relaxed">
            The idea that tax planning is only valuable once you&rsquo;re wealthy is a myth.
            Business owners at any income level, and individuals with moderately complex situations,
            regularly benefit from a single planning conversation that surfaces a deduction they
            didn&rsquo;t know to claim or a structural change that saves real money going forward.
          </p>
        </div>
      </section>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Virtual Consultations Available
          </h2>
          <p className="text-text-secondary text-lg max-w-3xl leading-relaxed">
            Tax planning sessions are available via video call for
            clients throughout Colorado and nationwide.
          </p>
        </div>
      </section>

      <CallToAction
        heading="Let's Look at Your Tax Picture"
        description="Schedule a tax planning consultation and start making proactive decisions about your tax future."
        buttonText="Schedule a Tax Planning Consultation"
      />
    </>
  );
}
