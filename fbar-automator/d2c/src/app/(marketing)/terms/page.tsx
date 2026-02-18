import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'FBAR Direct terms of service. Agreement for using our FBAR filing platform.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-navy-900 mb-4">Terms of Service</h1>
        <p className="text-sm text-gray-600 mb-8">Last updated: February 15, 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-8">
            <p className="text-lg font-semibold text-amber-900 mb-2">
              Not affiliated with IRS or FinCEN
            </p>
            <p className="text-sm text-amber-800">
              FBAR Direct is an independent FinCEN-registered BSA E-Filing institution. We are
              not affiliated with, endorsed by, or connected to the IRS, FinCEN, or any U.S.
              government agency. We provide third-party FBAR filing services.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using FBAR Direct (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the
              Service. These Terms constitute a legally binding agreement between you and FBAR Direct.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Service Description</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              FBAR Direct provides the following services:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Guided FBAR filing workflow to collect required information</li>
              <li>Electronic submission of FinCEN Form 114 to FinCEN&apos;s BSA E-Filing System via SFTP</li>
              <li>Email notifications regarding filing status, confirmations, and receipts</li>
              <li>Secure storage of your filing information (encrypted with AES-256-GCM)</li>
              <li>Customer support for filing-related questions</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              <strong>Important:</strong> FBAR Direct does not provide tax advice, legal advice,
              or accounting services. We are a filing service only. Consult a qualified tax
              professional or attorney if you need advice about your FBAR filing obligations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">User Responsibilities</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By using the Service, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>You are at least 18 years old and legally capable of entering into binding contracts</li>
              <li>All information you provide is accurate, complete, and truthful</li>
              <li>You have the legal authority to file an FBAR on behalf of any entities or individuals you represent</li>
              <li>You understand that filing false or fraudulent information with FinCEN is a federal crime</li>
              <li>You will review your completed FBAR before submission and verify its accuracy</li>
              <li>You are responsible for determining whether you are required to file an FBAR</li>
            </ul>
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">
                <strong>Warning:</strong> Willfully failing to file an FBAR or filing a fraudulent
                FBAR may result in civil penalties up to $100,000 or 50% of account balances, and
                criminal penalties including fines up to $250,000 and imprisonment up to 5 years.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>FBAR Direct is not responsible for errors or omissions in information you provide</li>
              <li>FBAR Direct is not liable for FinCEN rejections due to incomplete or inaccurate data</li>
              <li>FBAR Direct is not liable for penalties, fines, or legal consequences resulting from your FBAR filing or failure to file</li>
              <li>Our total liability to you for any claims arising from the Service is limited to the amount you paid for the filing ($59–$79 depending on service tier)</li>
              <li>We are not liable for indirect, incidental, consequential, or punitive damages</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              <strong>Errors and Omissions Insurance:</strong> FBAR Direct maintains Errors and
              Omissions (E&O) insurance coverage for professional liability claims related to
              our filing services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Fee Structure</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              FBAR Direct charges a fee of <strong>$59–$79 per FBAR filing</strong>, depending on the service tier selected. This fee includes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>Guided filing workflow</li>
              <li>Electronic submission to FinCEN</li>
              <li>BSA tracking ID and confirmation receipt</li>
              <li>Secure encrypted storage of your filing data</li>
              <li>Email notifications</li>
              <li>Customer support</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Payment is processed securely through Stripe. We do not store your credit card information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Refund Policy</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Pre-Submission:</strong> If you have not yet submitted your FBAR to FinCEN,
              you may request a full refund within 30 days of payment.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Post-Submission:</strong> Once your FBAR has been submitted to FinCEN and you
              have received a BSA tracking ID, the filing is complete and refunds are not available.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Rejection and Resubmission:</strong> If FinCEN rejects your filing due to a
              technical error on our part, we will resubmit your corrected FBAR at no additional
              charge. If the rejection is due to inaccurate or incomplete information you provided,
              we will assist you in correcting the filing, and you may resubmit at no additional charge.
            </p>
            <p className="text-gray-700 leading-relaxed">
              To request a refund, email support@fbardirect.com with your order number and reason
              for the request.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Data Privacy and Security</h2>
            <p className="text-gray-700 leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy, which describes how
              we collect, use, and protect your personal and financial information. By using the
              Service, you consent to our collection and use of your data as described in the
              Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Intellectual Property</h2>
            <p className="text-gray-700 leading-relaxed">
              All content, features, and functionality of the Service, including but not limited
              to text, graphics, logos, and software, are the exclusive property of FBAR Direct
              and are protected by U.S. and international copyright, trademark, and other
              intellectual property laws. You may not copy, modify, distribute, or reverse
              engineer any part of the Service without our express written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Account Termination</h2>
            <p className="text-gray-700 leading-relaxed">
              We reserve the right to suspend or terminate your account at any time if we believe
              you have violated these Terms, provided false information, or engaged in fraudulent
              activity. You may close your account at any time by contacting us. Account closure
              does not affect our obligation to retain your filing records as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Governing Law</h2>
            <p className="text-gray-700 leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of the United
              States and the State of Delaware, without regard to conflict of law principles. You
              agree to submit to the exclusive jurisdiction of the federal and state courts located
              in New Castle County, Delaware for any disputes arising from these Terms or your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Dispute Resolution</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Informal Resolution:</strong> Before filing any legal claim, you agree to
              attempt to resolve the dispute informally by contacting us at support@fbardirect.com.
              We will attempt to resolve the dispute within 30 days.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Arbitration:</strong> If informal resolution is unsuccessful, any dispute
              arising from these Terms or the Service shall be resolved through binding arbitration
              in accordance with the rules of the American Arbitration Association (AAA). The
              arbitration will be conducted in Wilmington, Delaware, and the arbitrator&apos;s decision will
              be final and binding.
            </p>
            <p className="text-gray-700 leading-relaxed">
              <strong>Class Action Waiver:</strong> You agree to resolve disputes with FBAR Direct
              on an individual basis only, and you waive any right to participate in class action
              lawsuits or class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Changes to These Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these Terms from time to time. We will notify you of material changes
              by email or by posting a notice on our website. Your continued use of the Service
              after such changes constitutes your acceptance of the updated Terms. If you do not
              agree to the updated Terms, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Severability</h2>
            <p className="text-gray-700 leading-relaxed">
              If any provision of these Terms is found to be invalid or unenforceable, the remaining
              provisions will continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-navy-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-700">
                <strong>Email:</strong> support@fbardirect.com<br />
                <strong>Mail:</strong> FBAR Direct Legal Department<br />
                1201 N. Market Street, Suite 111, Wilmington, DE 19801
              </p>
            </div>
          </section>

          <div className="mt-8 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>Entire Agreement:</strong> These Terms of Service, together with our Privacy
              Policy, constitute the entire agreement between you and FBAR Direct regarding the
              use of the Service and supersede all prior agreements and understandings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
