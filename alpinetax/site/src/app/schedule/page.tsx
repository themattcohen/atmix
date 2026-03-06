import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { siteConfig } from '@/lib/site-config';
import { CalEmbed } from './CalEmbed';

export const metadata: Metadata = {
  title: 'Schedule a Consultation',
  description:
    'Book a free 30-minute tax consultation with Alpine Tax & Consulting. No obligation — just a straightforward conversation about your tax needs.',
};

export default function SchedulePage() {
  return (
    <div className="section-padding">
      <div className="container-content">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Schedule' },
          ]}
        />

        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-4">
            Schedule a Free Consultation
          </h1>
          <p className="text-lg text-text-secondary mb-10">
            Book a free 30-minute call to discuss your tax situation. No obligation, no
            pressure — just a straightforward conversation about how Alpine Tax can help.
          </p>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8" style={{ minHeight: 500 }}>
            <CalEmbed calLink={siteConfig.calcomUsername} />
          </div>

          <div className="bg-alpine-cream rounded-lg p-8 mb-12">
            <h2 className="text-xl font-heading font-bold text-alpine-blue mb-2 text-center">
              Prefer to reach out directly?
            </h2>
            <p className="text-text-secondary text-center mb-6">
              We typically respond within a few hours.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={`tel:${siteConfig.phoneTel}`}
                className="inline-flex items-center justify-center gap-3 bg-alpine-blue text-white font-heading font-bold rounded-lg px-8 py-4 text-lg hover:bg-alpine-blue/90 transition-colors w-full sm:w-auto"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                {siteConfig.phone}
              </a>
              <a
                href={`mailto:${siteConfig.email}`}
                className="inline-flex items-center justify-center gap-3 border-2 border-alpine-blue text-alpine-blue font-heading font-bold rounded-lg px-8 py-4 text-lg hover:bg-alpine-blue/5 transition-colors w-full sm:w-auto"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
                </svg>
                {siteConfig.email}
              </a>
            </div>
          </div>

          <section>
            <h2 className="text-2xl font-heading font-bold text-alpine-blue mb-6">
              What to Expect
            </h2>
            <ul className="space-y-4 text-text-secondary text-lg">
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1 font-bold" aria-hidden="true">1.</span>
                <span>
                  <strong className="text-text-primary">30-minute call, no cost.</strong>{' '}
                  We&rsquo;ll get to know your situation without any time pressure.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1 font-bold" aria-hidden="true">2.</span>
                <span>
                  <strong className="text-text-primary">We&rsquo;ll discuss your needs.</strong>{' '}
                  Whether it&rsquo;s a personal return, business filing, or tax planning — we&rsquo;ll
                  figure out the best path forward.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1 font-bold" aria-hidden="true">3.</span>
                <span>
                  <strong className="text-text-primary">You&rsquo;ll get a clear price quote.</strong>{' '}
                  No surprises, no hidden fees. You&rsquo;ll know exactly what to expect before
                  you commit.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1 font-bold" aria-hidden="true">4.</span>
                <span>
                  <strong className="text-text-primary">No obligation to proceed.</strong>{' '}
                  If we&rsquo;re not the right fit, no hard feelings. We&rsquo;re happy to
                  point you in the right direction.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
