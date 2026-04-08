import type { Metadata } from "next";
import { ManageCookiePreferences } from "@/components/analytics/ManageCookiePreferences";

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'FBAR Direct privacy policy. AES-256 encryption protects your SSN and financial data. We never sell your information. Full GLBA-aligned data handling practices.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-navy-900 mb-4">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: February 15, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <p className="text-lg font-semibold text-blue-900 mb-2">
              We never sell your data.
            </p>
            <p className="text-sm text-blue-800">
              Your personal and financial information is used solely to file your FBAR with FinCEN.
              We do not sell, rent, or share your data with third parties except as required to
              complete your FBAR filing.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To file your FBAR, we collect the following information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Personal identification: Name, date of birth, Social Security Number (SSN) or Individual Taxpayer Identification Number (ITIN)</li>
              <li>Contact information: Address, email, phone number</li>
              <li>Foreign account information: Account numbers, financial institution names, maximum account values</li>
              <li>Signature authority and joint account holder details (if applicable)</li>
              <li>Payment information processed through Stripe (we do not store credit card details)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">How We Use Your Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your information is used exclusively for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Filing your FBAR electronically with FinCEN through the BSA E-Filing System</li>
              <li>Sending you email notifications about filing status, confirmations, and receipts</li>
              <li>Providing customer support for your filing</li>
              <li>Complying with legal and regulatory obligations</li>
              <li>Improving our service (anonymized data only)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Data Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement industry-standard security measures to protect your sensitive information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>AES-256-GCM Encryption:</strong> All sensitive data (SSN, ITIN, account numbers) is encrypted at rest using AES-256-GCM encryption</li>
              <li><strong>TLS/SSL Encryption:</strong> All data transmitted between your browser and our servers is encrypted using TLS 1.3</li>
              <li><strong>Secure SFTP:</strong> FBAR submissions to FinCEN are transmitted via encrypted SFTP channels</li>
              <li><strong>Access Controls:</strong> Strict access controls limit who can view your personal information</li>
              <li><strong>Regular Security Audits:</strong> We conduct regular security assessments and vulnerability scans</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Data Retention</h2>
            <p className="text-gray-700 leading-relaxed">
              We retain your FBAR filing data for 5 years as required by BSA recordkeeping regulations.
              After this period, your data is securely deleted unless you have an active account with
              ongoing filings. You may request early deletion of your data by contacting us, subject
              to legal retention requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We work with the following trusted third-party services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>FinCEN:</strong> We submit your FBAR directly to FinCEN&apos;s BSA E-Filing System via SFTP</li>
              <li><strong>Stripe:</strong> Payment processing (Stripe handles all credit card information; we never see or store your card details)</li>
              <li><strong>Resend:</strong> Email delivery for notifications, confirmations, and receipts</li>
              <li><strong>Google Analytics / Google Tag Manager:</strong> Website analytics to understand visitor behavior and measure advertising effectiveness (see Cookies and Tracking section)</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              These services are contractually bound to protect your data and use it only for the
              specific purposes outlined above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Your Rights</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete data</li>
              <li><strong>Deletion:</strong> Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong>Portability:</strong> Request a copy of your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data for specific purposes</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              To exercise any of these rights, please contact us using the information below.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Cookies and Tracking</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use essential cookies to maintain your session and provide basic functionality.
              You can disable cookies in your browser settings, but this may affect your ability to use our service.
            </p>
            <h3 className="text-lg font-semibold text-navy-900 mb-2">Analytics</h3>
            <p className="text-gray-700 leading-relaxed">
              We use Google Analytics and Google Tag Manager to understand how visitors use our site
              and to measure the effectiveness of our advertising. These services may set cookies on
              your device. You can opt out of Google Analytics by installing the{' '}
              <a
                href="https://tools.google.com/dlpage/gaoptout"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Opt-out Browser Add-on
              </a>.
            </p>
            <ManageCookiePreferences />
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any
              material changes by email or by posting a notice on our website. Your continued
              use of our service after such changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about this Privacy Policy or wish to exercise your privacy
              rights, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@fbardirect.com<br />
                <strong>Phone:</strong>{" "}
                <a href="tel:+18888635518" className="text-blue-600 underline">(888) 863-5518</a><br />
                <strong>Mail:</strong> FBAR Direct Privacy Team<br />
                6732 W Coal Mine Ave, Ste 451, Littleton, CO 80123
              </p>
            </div>
          </section>

          <div className="mt-8 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Disclaimer:</strong> FBAR Direct is not affiliated with the IRS, FinCEN,
              or any U.S. government agency. We are an independent FinCEN-registered BSA E-Filing
              institution providing FBAR filing services.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
