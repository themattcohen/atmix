import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { siteConfig } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `Terms of service for ${siteConfig.name}. Review the terms and conditions governing our tax preparation and consulting services.`,
};

export default function TermsPage() {
  return (
    <div className="section-padding">
      <div className="container-content">
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Terms of Service' },
          ]}
        />

        <div className="max-w-3xl mt-6">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-alpine-blue mb-4">
            Terms of Service
          </h1>
          <p className="text-text-secondary mb-10">
            Last updated: March 2026
          </p>

          <div className="prose prose-lg max-w-none text-text-secondary [&_h2]:text-alpine-blue [&_h2]:font-heading [&_h2]:font-bold [&_h2]:text-2xl [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-text-primary [&_h3]:font-semibold [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-2 [&_a]:text-alpine-teal [&_a]:hover:underline [&_ul]:space-y-1 [&_li]:leading-relaxed">
            <p>
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the tax preparation,
              consulting, and related services provided by {siteConfig.legalName} (&ldquo;Alpine Tax,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By engaging our services, you
              agree to these Terms.
            </p>

            <h2>Services</h2>
            <p>
              Alpine Tax provides professional tax preparation, tax planning, consulting, and IRS
              representation services for individuals and small businesses. The specific scope of
              services for each engagement will be outlined in a separate engagement letter provided
              to you before work begins.
            </p>
            <p>
              Our services include, but are not limited to:
            </p>
            <ul>
              <li>Individual and joint federal and state income tax return preparation</li>
              <li>Small business, S-Corporation, and partnership tax return preparation</li>
              <li>Tax planning consultations and strategic advice</li>
              <li>IRS notice response and representation</li>
            </ul>

            <h2>Client Responsibilities</h2>
            <p>
              As a client of Alpine Tax, you agree to:
            </p>
            <ul>
              <li><strong>Provide accurate information:</strong> You are responsible for providing complete, accurate, and truthful information necessary for the preparation of your tax returns. The accuracy of your return depends on the accuracy of the information you provide.</li>
              <li><strong>Timely document submission:</strong> You agree to provide all required tax documents in a timely manner to allow adequate preparation time before applicable filing deadlines.</li>
              <li><strong>Review and approval:</strong> You are responsible for reviewing your completed tax return before filing and approving it for submission. Your signature (electronic or physical) constitutes approval.</li>
              <li><strong>Payment:</strong> You agree to pay all fees for services rendered in accordance with the terms outlined in your engagement letter.</li>
            </ul>

            <h2>Fees and Payment</h2>
            <p>
              Service fees are determined based on the complexity of your tax situation and will be
              communicated to you in your engagement letter before work begins. Key payment terms:
            </p>
            <ul>
              <li>Fees are based on the scope of work outlined in your engagement letter</li>
              <li>Payment is due before your tax return is filed with the IRS or applicable state agency</li>
              <li>We accept payment through our secure client portal</li>
              <li>If the scope of your engagement changes materially, we will discuss updated pricing with you before proceeding</li>
            </ul>

            <h2>Limitation of Liability</h2>
            <p>
              Alpine Tax will exercise reasonable professional care in performing our services. However:
            </p>
            <ul>
              <li>Our services are based on the information you provide. We are not responsible for errors or omissions resulting from incomplete, inaccurate, or misleading information furnished by you.</li>
              <li>Tax laws and regulations are subject to change. We are not responsible for changes in tax law enacted after your return is filed.</li>
              <li>We do not guarantee specific tax outcomes, refund amounts, or IRS acceptance of any position taken on your return.</li>
              <li>Our liability for any claim arising from our services shall not exceed the fees paid for the specific service giving rise to the claim.</li>
            </ul>

            <h2>Confidentiality</h2>
            <p>
              We are committed to maintaining the confidentiality of your personal and financial
              information. We will not disclose your information to third parties except as required to:
            </p>
            <ul>
              <li>Perform the services you have engaged us to provide (e.g., filing returns with the IRS and state agencies)</li>
              <li>Comply with applicable law, regulation, or legal process</li>
              <li>Respond to your written authorization for disclosure</li>
            </ul>
            <p>
              For full details on how we handle your information, please review our{' '}
              <a href="/privacy">Privacy Policy</a>.
            </p>

            <h2>Electronic Signatures</h2>
            <p>
              We use TaxDome, a secure client portal, for electronic document signing. By using our
              portal to sign documents, you agree that your electronic signature is valid and legally
              binding, carrying the same force and effect as a handwritten signature, in accordance with
              the federal Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and
              applicable Colorado law.
            </p>

            <h2>Termination</h2>
            <p>
              Either party may terminate the client relationship at any time by providing written notice
              to the other party. Upon termination:
            </p>
            <ul>
              <li>You are responsible for payment of fees for all services rendered through the date of termination</li>
              <li>We will return or make available any original documents you provided to us</li>
              <li>We will retain copies of your tax records in accordance with our data retention policy and professional obligations</li>
            </ul>

            <h2>Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of
              Colorado, without regard to its conflict of law provisions. Any disputes arising from these
              Terms or our services shall be resolved in the courts located in the State of Colorado.
            </p>

            <h2>Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. When we make changes, we will update the
              &ldquo;Last updated&rdquo; date at the top of this page. Your continued use of our services
              after any changes constitutes your acceptance of the updated Terms.
            </p>

            <h2>Contact Us</h2>
            <p>
              If you have questions about these Terms of Service, please contact us:
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
