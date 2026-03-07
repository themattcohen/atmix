import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Alpine Tax & Consulting. Call, email, or send us a message to discuss your tax preparation and consulting needs.',
};

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact Alpine Tax & Consulting',
          url: `${siteConfig.url}/contact`,
          mainEntity: {
            '@type': 'AccountingService',
            name: siteConfig.name,
            telephone: siteConfig.phoneTel,
            email: siteConfig.email,
          },
        }}
      />

      <div className="section-padding">
        <div className="container-content">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Contact' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-4">
            Get in Touch
          </h1>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl">
            Have a question about your taxes or want to learn how Alpine Tax &amp; Consulting
            can help? Send us a message or reach out directly.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 mb-12 p-6 bg-alpine-blue rounded-xl">
            <div className="text-center sm:text-left">
              <p className="text-white font-heading font-bold text-lg mb-1">Prefer to reach us directly?</p>
              <p className="text-white/80 text-sm">We typically respond within a few hours.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
              <a
                href={`tel:${siteConfig.phoneTel}`}
                className="inline-flex items-center justify-center gap-2 bg-white text-alpine-blue font-semibold rounded-lg px-6 py-3 hover:bg-white/90 transition-colors"
              >
                {siteConfig.phone}
              </a>
              <a
                href={`mailto:${siteConfig.email}`}
                className="inline-flex items-center justify-center gap-2 border-2 border-white text-white font-semibold rounded-lg px-6 py-3 hover:bg-white/10 transition-colors"
              >
                {siteConfig.email}
              </a>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-12">
            {/* Contact Form */}
            <div className="lg:col-span-3">
              <form
                action={`mailto:${siteConfig.email}`}
                method="POST"
                encType="text/plain"
                className="bg-alpine-cream rounded-xl p-8 space-y-6"
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-text-primary mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full border border-gray-300 rounded-lg py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-alpine-teal focus:border-transparent"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-text-primary mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full border border-gray-300 rounded-lg py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-alpine-teal focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-text-primary mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="w-full border border-gray-300 rounded-lg py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-alpine-teal focus:border-transparent"
                    placeholder="(555) 123-4567"
                  />
                </div>

                <div>
                  <label htmlFor="service" className="block text-sm font-semibold text-text-primary mb-2">
                    Service Interest
                  </label>
                  <select
                    id="service"
                    name="service"
                    className="w-full border border-gray-300 rounded-lg py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-alpine-teal focus:border-transparent bg-white"
                  >
                    <option value="">Select a service...</option>
                    <option value="Individual Tax Return">Individual Tax Return</option>
                    <option value="Small Business Tax Return">Small Business Tax Return</option>
                    <option value="S-Corp or Partnership Return">S-Corp or Partnership Return</option>
                    <option value="Tax Planning Consultation">Tax Planning Consultation</option>
                    <option value="IRS Notice Help">IRS Notice Help</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-text-primary mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={5}
                    required
                    className="w-full border border-gray-300 rounded-lg py-3 px-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-alpine-teal focus:border-transparent resize-vertical"
                    placeholder="Tell us about your situation..."
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Send Message
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-6">
                <h2 className="text-xl font-heading font-bold text-alpine-blue">
                  Contact Information
                </h2>

                <div>
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    Phone
                  </h3>
                  <a
                    href={`tel:${siteConfig.phoneTel}`}
                    className="text-alpine-teal font-semibold hover:underline text-lg"
                  >
                    {siteConfig.phone}
                  </a>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    Email
                  </h3>
                  <a
                    href={`mailto:${siteConfig.email}`}
                    className="text-alpine-teal hover:underline"
                  >
                    {siteConfig.email}
                  </a>
                </div>

                <hr className="border-gray-200" />

                <div className="space-y-3">
                  <a
                    href="/schedule"
                    className="block text-center bg-alpine-blue text-white font-semibold py-3 px-6 rounded-lg hover:bg-alpine-blue/90 transition-colors"
                  >
                    Schedule Online
                  </a>
                  <a
                    href={siteConfig.taxdomeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center border-2 border-alpine-blue text-alpine-blue font-semibold py-3 px-6 rounded-lg hover:bg-alpine-blue/5 transition-colors"
                  >
                    Client Portal
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
