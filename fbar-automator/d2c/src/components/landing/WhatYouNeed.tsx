export function WhatYouNeed() {
  return (
    <section className="w-full bg-bg-gray py-10 px-4 border-b border-border-gray">
      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-6">
          What you will need to file
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div>
            <h3 className="text-lg font-bold text-gov-blue mb-3">
              Personal Information
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-text-primary text-sm md:text-base">
              <li>Full legal name</li>
              <li>SSN or ITIN</li>
              <li>Date of birth</li>
              <li>Current mailing address</li>
              <li>Email and phone number</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gov-blue mb-3">
              Foreign Account Details
            </h3>
            <p className="text-sm text-text-secondary mb-2">
              For each account you are reporting:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-text-primary text-sm md:text-base">
              <li>Financial institution name</li>
              <li>Account number</li>
              <li>Maximum value during the calendar year</li>
              <li>Type of account (Bank, Securities, Other)</li>
              <li>Address of the financial institution</li>
            </ul>
          </div>
        </div>

        <p className="text-sm text-text-secondary italic">
          Note: You do not need to upload bank statements. You will enter
          account information manually.
        </p>
      </div>
    </section>
  );
}
