import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Client Reviews',
  description:
    'See what clients say about working with Alpine Tax & Consulting. Read reviews and testimonials from individuals and small business owners in Denver.',
};

export default function ReviewsPage() {
  return (
    <>
      <div className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Reviews' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-4">
            What Our Clients Say
          </h1>
          <p className="text-lg text-text-secondary mb-12 max-w-2xl">
            We take pride in delivering personal, transparent tax services. Here&rsquo;s what
            our clients have to say.
          </p>

          <div className="max-w-3xl mx-auto">
            <div className="bg-alpine-cream rounded-xl p-8 md:p-12 text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-alpine-teal/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-alpine-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h2 className="text-2xl font-heading font-bold text-alpine-blue mb-3">
                Nearly a Decade Serving Denver
              </h2>
              <p className="text-text-secondary text-lg mb-2">
                Alpine Tax &amp; Consulting has been providing personal, transparent tax
                preparation to individuals and small businesses throughout the Denver metro
                area for nearly 10 years.
              </p>
              <p className="text-text-secondary mb-8">
                We&rsquo;re building our online review presence — your feedback helps future
                clients find the right tax professional.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href={siteConfig.social.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Leave a Google Review
                </a>
                <a
                  href={siteConfig.social.google}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-alpine-teal font-semibold hover:underline"
                >
                  View on Google &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CallToAction
        heading="Ready to Experience the Difference?"
        description="See why clients choose Alpine Tax for personal, transparent tax preparation."
      />
    </>
  );
}
