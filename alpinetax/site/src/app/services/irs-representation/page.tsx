import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { CallToAction } from '@/components/CallToAction';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'IRS Correspondence & Representation',
  description:
    'Help responding to IRS notices and correspondence in Denver, CO.',
};

export default function IrsRepresentationPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'IRS Correspondence & Representation',
          name: 'IRS Representation',
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
              { label: 'IRS Representation' },
            ]}
          />

          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-6">
            IRS Representation
          </h1>

          <div className="max-w-3xl space-y-4 text-text-secondary text-lg leading-relaxed">
            <p>
              An IRS notice in your mailbox is unsettling. Most of the time, it&rsquo;s less serious
              than it looks — but that doesn&rsquo;t mean you should respond without understanding
              what you&rsquo;re dealing with.
            </p>
            <p>
              Alpine Tax &amp; Consulting can help you make sense of IRS correspondence, organize
              the documentation needed to respond, and draft a clear, accurate reply. If you&rsquo;re
              not sure what a notice means or what the IRS is asking for, that&rsquo;s a good place
              to start.
            </p>
          </div>
        </div>
      </div>

      <section className="section-padding bg-alpine-cream">
        <div className="container-content">
          <h2 className="text-3xl font-heading font-bold text-alpine-blue mb-6">
            Current Scope of Service
          </h2>
          <p className="text-text-secondary text-lg mb-4 max-w-3xl">
            At this time, Alpine Tax assists with:
          </p>
          <ul className="space-y-3 text-text-secondary text-lg max-w-3xl">
            <li>
              <strong>Understanding IRS notices</strong> — translating the official language into
              plain terms and explaining what action, if any, is required
            </li>
            <li>
              <strong>Responding to correspondence</strong> — drafting written responses to IRS
              letters and notices that explain your position clearly and include the supporting
              documentation they&rsquo;re asking for
            </li>
            <li>
              <strong>Organizing your records</strong> — identifying what documentation supports
              your return and helping you gather it before you respond
            </li>
            <li>
              <strong>CP2000 and underreporter notices</strong> — helping you review whether a
              proposed change is correct and how to respond if you disagree
            </li>
          </ul>
        </div>
      </section>

      <CallToAction
        heading="Have an IRS Notice?"
        description="Don't ignore it. Even notices that turn out to be minor require a response by a specific deadline."
        buttonText="Contact Alpine Tax About Your Notice"
      />
    </>
  );
}
