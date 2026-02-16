export function TrustBar() {
  return (
    <section className="w-full bg-bg-gray border-b border-border-gray py-3 px-4">
      <div className="max-w-doc mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center text-sm text-gov-blue font-semibold space-y-2 md:space-y-0">
          <span>✓ FinCEN-Registered BSA E-Filer</span>
          <span className="hidden md:inline mx-3 text-gray-400">•</span>
          <span>✓ 256-bit SSL Encryption</span>
          <span className="hidden md:inline mx-3 text-gray-400">•</span>
          <span>✓ Direct FinCEN Submission</span>
        </div>
      </div>
    </section>
  );
}
