export function HowItWorks() {
  return (
    <section
      id="how-to-file"
      className="w-full bg-white py-10 px-4 border-b border-border-gray"
    >
      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-6">
          How to file with FBAR Direct
        </h2>

        <div className="space-y-8 max-w-[700px]">
          <div>
            <h3 className="text-lg font-bold text-gov-blue mb-2">
              1. Enter your information
            </h3>
            <p className="text-text-primary leading-relaxed">
              Provide your personal details and foreign account information.
              Most filers complete this in 5–10 minutes. Our secure wizard
              guides you through each required field.
            </p>
          </div>

          <hr className="border-t border-gray-200" />

          <div>
            <h3 className="text-lg font-bold text-gov-blue mb-2">
              2. Review and sign
            </h3>
            <p className="text-text-primary leading-relaxed">
              Review your filing for accuracy and electronically sign FinCEN
              Form 114a, Record of Authorization to Electronically File FBARs.
              This authorizes us to transmit your data.
            </p>
          </div>

          <hr className="border-t border-gray-200" />

          <div>
            <h3 className="text-lg font-bold text-gov-blue mb-2">
              3. We submit to FinCEN
            </h3>
            <p className="text-text-primary leading-relaxed">
              Your filing is transmitted directly to FinCEN through the BSA
              E-Filing system. You will receive a BSA tracking ID as
              confirmation of your submission.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
