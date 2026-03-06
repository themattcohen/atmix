import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Client Portal',
  description:
    'Access your secure Alpine Tax & Consulting client portal to upload documents, sign forms, and track your return status.',
};

export default function ClientPortalPage() {
  return (
    <div className="section-padding">
      <div className="container-content">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Client Portal' },
          ]}
        />

        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mt-6 mb-4">
            Client Portal
          </h1>
          <p className="text-lg text-text-secondary mb-8">
            Access your secure Alpine Tax &amp; Consulting client portal powered by TaxDome.
            Upload documents, sign forms, and communicate with our office — all in one place.
          </p>

          <div className="mb-12">
            <a
              href={siteConfig.taxdomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center gap-2 text-lg"
            >
              Go to Client Portal &rarr;
            </a>
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-heading font-bold text-alpine-blue mb-6">
              What You Can Do in the Portal
            </h2>
            <ul className="space-y-3 text-text-secondary text-lg">
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
                Upload tax documents securely
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
                Sign forms electronically
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
                Message our office
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
                Access copies of your filed returns
              </li>
              <li className="flex items-start gap-3">
                <span className="text-alpine-teal mt-1" aria-hidden="true">&#10003;</span>
                Track the status of your return
              </li>
            </ul>
          </section>

          <section className="bg-alpine-cream rounded-xl p-8 mb-12">
            <h2 className="text-xl font-heading font-bold text-alpine-blue mb-3">
              First Time?
            </h2>
            <p className="text-text-secondary">
              You&rsquo;ll receive a portal invitation when you become a client. If you
              haven&rsquo;t received yours, please{' '}
              <Link href="/contact" className="text-alpine-teal hover:underline font-semibold">
                contact us
              </Link>{' '}
              and we&rsquo;ll get you set up.
            </p>
          </section>

          <section className="border border-gray-200 rounded-xl p-8">
            <h2 className="text-xl font-heading font-bold text-alpine-blue mb-3">
              Need Help?
            </h2>
            <p className="text-text-secondary mb-4">
              If you&rsquo;re having trouble accessing the portal, reach out and we&rsquo;ll
              help you get connected.
            </p>
            <div className="space-y-2 text-text-primary">
              <p>
                <strong>Phone:</strong>{' '}
                <a
                  href={`tel:${siteConfig.phoneTel}`}
                  className="text-alpine-teal hover:underline"
                >
                  {siteConfig.phone}
                </a>
              </p>
              <p>
                <strong>Email:</strong>{' '}
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-alpine-teal hover:underline"
                >
                  {siteConfig.email}
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
