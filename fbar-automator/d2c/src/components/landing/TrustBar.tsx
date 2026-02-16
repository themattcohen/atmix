export function TrustBar() {
  const items = [
    { label: "FinCEN-Registered BSA E-Filer" },
    { label: "256-bit Encryption" },
    { label: "Secure FinCEN Submission" },
  ];

  return (
    <section className="bg-gray-50 border-y border-gray-200 py-6" aria-label="Trust and security credentials">
      <div className="max-w-5xl mx-auto px-4">
        <ul className="flex flex-wrap justify-center gap-8 md:gap-16 list-none">
          {items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" aria-hidden="true" focusable="false" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
