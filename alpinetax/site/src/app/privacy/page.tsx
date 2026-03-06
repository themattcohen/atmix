import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy policy for ${siteConfig.name}. Learn how we collect, use, and protect your personal and financial information.`,
};

export default function PrivacyPage() {
  return (
    <div className="section-padding">
      <div className="container-content">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Privacy Policy' },
          ]}
        />

        <div className="max-w-3xl mt-6">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mb-4">
            Privacy Policy
          </h1>
          <p className="text-text-secondary mb-10">
            Last updated: March 2026
          </p>

          <div className="prose prose-lg max-w-none text-text-secondary [&_h2]:text-alpine-blue [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-text-primary [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-alpine-teal [&_a]:hover:underline [&_ul]:space-y-1 [&_li]:leading-relaxed">
            <p>
              {siteConfig.legalName} (&ldquo;Alpine Tax,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
              or &ldquo;our&rdquo;) is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our
              tax preparation and consulting services or visit our website at{' '}
              <a href={siteConfig.url}>{siteConfig.url}</a>.
            </p>

            <h2>Information We Collect</h2>
            <p>We collect information necessary to provide tax preparation and consulting services, including:</p>
            <ul>
              <li><strong>Personal identifiers:</strong> Name, address, date of birth, Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN)</li>
              <li><strong>Contact information:</strong> Email address, phone number, mailing address</li>
              <li><strong>Financial information:</strong> Income statements (W-2, 1099), bank account details, investment records, business financial records, and prior tax returns</li>
              <li><strong>Tax documents:</strong> All documents you provide for the purpose of tax preparation, including forms, receipts, and supporting records</li>
              <li><strong>Website usage data:</strong> IP address, browser type, pages visited, and other standard analytics data collected through cookies and similar technologies</li>
            </ul>

            <h2>How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul>
              <li><strong>Tax preparation and filing:</strong> To prepare, review, and file your federal and state tax returns with the Internal Revenue Service (IRS) and applicable state tax agencies</li>
              <li><strong>Tax planning and consulting:</strong> To provide strategic tax advice and planning recommendations</li>
              <li><strong>Communication:</strong> To contact you about your return status, request additional information, and respond to your inquiries</li>
              <li><strong>Legal compliance:</strong> To comply with applicable tax laws, regulations, and professional standards, including IRS requirements for tax return preparers</li>
              <li><strong>Service improvement:</strong> To improve our services, website, and client experience</li>
            </ul>

            <h2>Information Security</h2>
            <p>
              We take the security of your personal and financial information seriously. We implement
              appropriate technical and organizational measures to protect your data, including:
            </p>
            <ul>
              <li>Encrypted client portal through TaxDome for secure document exchange and electronic signatures</li>
              <li>Encrypted data transmission (TLS/SSL) for all website and portal communications</li>
              <li>Restricted access to client data on a need-to-know basis</li>
              <li>Secure storage of physical and electronic records</li>
            </ul>
            <p>
              <strong>Important:</strong> We do not request sensitive documents (such as tax returns,
              SSNs, or bank statements) via unencrypted email. All sensitive documents should be
              uploaded through our secure client portal.
            </p>

            <h2>Third-Party Services</h2>
            <p>
              We use trusted third-party services to operate our business. These services may process
              your data on our behalf in accordance with their own privacy policies:
            </p>
            <ul>
              <li><strong>TaxDome:</strong> Secure client portal for document exchange, electronic signatures, and client communication</li>
              <li><strong>IRS and state tax agencies:</strong> Electronic filing of tax returns as authorized by you</li>
              <li><strong>Payment processing:</strong> Secure processing of service fees</li>
              <li><strong>Google Analytics:</strong> Website analytics to understand how visitors use our site (see &ldquo;Cookies and Analytics&rdquo; below)</li>
            </ul>

            <h2>Cookies and Analytics</h2>
            <p>
              Our website uses cookies and similar tracking technologies to improve your experience
              and understand how our site is used. Specifically:
            </p>
            <ul>
              <li><strong>Google Analytics 4 (GA4):</strong> We use GA4 to collect anonymized data about website traffic, page views, and user behavior. This helps us improve our website and services.</li>
              <li><strong>Advertising cookies:</strong> We may use cookies from advertising platforms (such as Meta/Facebook Pixel) for retargeting and measuring the effectiveness of our advertising.</li>
              <li><strong>Essential cookies:</strong> Required for basic website functionality.</li>
            </ul>
            <p>
              You can manage your cookie preferences through the cookie consent banner displayed on
              our website, or by adjusting your browser settings. Declining non-essential cookies will
              not affect your ability to use our services.
            </p>

            <h2>Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request that we correct any inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request that we delete your personal information, subject to our legal retention obligations</li>
              <li><strong>Opt-out:</strong> Opt out of non-essential cookies and marketing communications at any time</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us using the information provided below.
              We will respond to your request within a reasonable timeframe.
            </p>

            <h2>Data Retention</h2>
            <p>
              We retain client tax records and related documents for a minimum of seven (7) years from
              the date of filing, in accordance with IRS record-keeping requirements and professional
              standards. After this period, records are securely destroyed.
            </p>
            <p>
              Website analytics data is retained according to the default retention periods of the
              respective analytics platforms.
            </p>

            <h2>Children&rsquo;s Privacy</h2>
            <p>
              Our services are not directed to individuals under the age of 13. We do not knowingly
              collect personal information from children under 13. If we learn that we have collected
              personal information from a child under 13, we will take steps to delete that information
              as soon as possible.
            </p>

            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices
              or applicable law. When we make changes, we will update the &ldquo;Last updated&rdquo; date
              at the top of this page. We encourage you to review this page periodically for the latest
              information on our privacy practices.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how we handle your information,
              please contact us:
            </p>
            <ul>
              <li><strong>Email:</strong> <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></li>
              <li><strong>Phone:</strong> <a href={`tel:${siteConfig.phoneTel}`}>{siteConfig.phone}</a></li>
              <li><strong>Business:</strong> {siteConfig.legalName}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
