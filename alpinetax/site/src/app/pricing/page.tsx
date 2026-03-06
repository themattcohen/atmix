import type { Metadata } from 'next';
import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Transparent tax preparation pricing from Alpine Tax & Consulting. Individual returns from $600, small business from $850, S-Corp & partnership from $2,000.',
};

const pricingTiers = [
  {
    name: 'Individual Tax Returns',
    price: 600,
    popular: false,
    includes: [
      'Federal and Colorado state return',
      'W-2, 1099, and investment income',
      'Itemized or standard deduction analysis',
      'Multi-state filing support',
      'Prior year return review for new clients',
      'Electronic filing and direct deposit setup',
    ],
  },
  {
    name: 'Small Business Tax Returns',
    price: 850,
    popular: false,
    includes: [
      'Schedule C / single-member LLC',
      'Income and expense categorization review',
      'Home office deduction calculation',
      'Quarterly estimated tax guidance',
      'Depreciation and asset tracking',
      'Includes owner\'s personal return',
    ],
  },
  {
    name: 'S-Corp & Partnership Returns',
    price: 2000,
    popular: true,
    includes: [
      'Form 1120-S or Form 1065 preparation',
      'K-1 generation for all partners/shareholders',
      'Reasonable compensation analysis',
      'QBI deduction optimization',
      'Payroll and officer compensation review',
      'Includes owner\'s personal return',
    ],
  },
];

const pricingFaqs = [
  {
    question: 'What determines the final price?',
    answer:
      'Final pricing is based on the complexity of your return: number of income sources, states filed, business activities, rental properties, and other factors. We provide a quote after reviewing your situation so there are no surprises.',
  },
  {
    question: 'Are there any additional fees?',
    answer:
      'No hidden fees. The price we quote is the price you pay. If your situation turns out to be more complex than expected, we discuss it with you before proceeding.',
  },
  {
    question: 'Do you offer a free consultation?',
    answer:
      'Yes. We offer a free 15-minute consultation to understand your tax situation, answer initial questions, and provide a cost estimate before you commit.',
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Tax Preparation Services',
          provider: {
            '@type': 'ProfessionalService',
            name: 'Alpine Tax & Consulting',
          },
          offers: [
            {
              '@type': 'Offer',
              name: 'Individual Tax Return',
              price: '600',
              priceCurrency: 'USD',
              priceSpecification: {
                '@type': 'UnitPriceSpecification',
                price: '600',
                priceCurrency: 'USD',
                unitText: 'starting',
              },
            },
            {
              '@type': 'Offer',
              name: 'Small Business Tax Return',
              price: '850',
              priceCurrency: 'USD',
            },
            {
              '@type': 'Offer',
              name: 'S-Corp & Partnership Return',
              price: '2000',
              priceCurrency: 'USD',
            },
          ],
        }}
      />

      <section className="section-padding bg-white">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Pricing' },
            ]}
          />

          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl text-alpine-blue mb-4">
              Transparent Pricing for Quality Tax Services
            </h1>
            <p className="text-lg text-text-secondary max-w-3xl mx-auto">
              No surprise fees, no bait-and-switch. You&apos;ll know your cost
              upfront based on the complexity of your return &mdash; and the
              price we quote is the price you pay.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`relative bg-white rounded-lg p-8 ${
                  tier.popular
                    ? 'border-2 border-alpine-teal shadow-lg'
                    : 'border border-gray-200'
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-alpine-teal text-white text-sm font-heading font-bold px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h2 className="text-xl font-heading font-bold text-alpine-blue mb-2">
                  {tier.name}
                </h2>
                <p className="text-3xl font-heading font-bold text-alpine-blue mb-1">
                  ${tier.price.toLocaleString()}
                </p>
                <p className="text-sm text-text-secondary mb-6">
                  starting price
                </p>
                <ul className="space-y-3 mb-8">
                  {tier.includes.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-text-secondary"
                    >
                      <svg
                        className="w-5 h-5 text-alpine-teal flex-shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/schedule"
                  className={
                    tier.popular ? 'btn-primary w-full text-center' : 'btn-secondary w-full text-center'
                  }
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>

          {/* Custom Quotes */}
          <div className="bg-alpine-cream rounded-lg p-8 md:p-12 text-center mb-16">
            <h2 className="text-2xl md:text-3xl text-alpine-blue mb-4">
              Need a Custom Quote?
            </h2>
            <p className="text-text-secondary max-w-2xl mx-auto mb-6 leading-relaxed">
              Have rental properties, multiple businesses, or an unusual tax
              situation? We provide custom quotes based on the actual complexity
              of your return. Schedule a free consultation to get a specific
              price for your situation.
            </p>
            <Link href="/schedule" className="btn-primary">
              Schedule a Free Consultation
            </Link>
          </div>

          {/* Pricing FAQs */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl text-alpine-blue text-center mb-8">
              Common Questions About Pricing
            </h2>
            <div className="space-y-8">
              {pricingFaqs.map((faq) => (
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
        </div>
      </section>

      <CallToAction
        heading="Ready to Get a Quote?"
        description="Schedule a free 15-minute consultation. We'll review your situation and give you a clear, honest price."
      />
    </>
  );
}
