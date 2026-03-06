import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { faqData, faqCategories } from '@/lib/faq-data';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Common questions about Alpine Tax & Consulting services, pricing, process, and security. Get answers about tax preparation in Denver.',
};

export default function FaqPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqData.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }}
      />

      <section className="section-padding bg-white">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'FAQ' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl text-alpine-blue mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-text-secondary max-w-3xl mb-8">
            Answers to common questions about working with Alpine Tax &amp;
            Consulting. If you don&apos;t see what you&apos;re looking for,{' '}
            <a href="/contact" className="text-alpine-teal hover:underline">
              contact us
            </a>{' '}
            and we&apos;ll be happy to help.
          </p>

          <nav className="flex flex-wrap gap-2 mb-12" aria-label="FAQ categories">
            {faqCategories.map((category) => (
              <a
                key={category}
                href={`#${category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}`}
                className="px-4 py-2 bg-alpine-cream border border-gray-200 rounded-full text-sm font-semibold text-text-secondary hover:border-alpine-teal hover:text-alpine-teal transition-colors"
              >
                {category}
              </a>
            ))}
          </nav>

          {faqCategories.map((category) => {
            const items = faqData.filter((faq) => faq.category === category);
            return (
              <div key={category} className="mb-12 last:mb-0">
                <h2
                  id={category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-')}
                  className="text-2xl md:text-3xl text-alpine-blue mb-6 pb-2 border-b border-gray-200 scroll-mt-24"
                >
                  {category}
                </h2>
                <div className="space-y-8">
                  {items.map((faq) => (
                    <div key={faq.question}>
                      <h3 className="text-lg font-heading font-bold text-alpine-blue mb-2">
                        {faq.question}
                      </h3>
                      <p className="text-text-secondary leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <CallToAction />
    </>
  );
}
