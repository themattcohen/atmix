export function PricingComparison() {
  const options = [
    { name: "FBAR Direct", price: "$59", highlight: true, features: ["10-minute process", "FinCEN-registered e-filer", "Direct SDTM submission", "BSA ID confirmation", "Encrypted data handling"] },
    { name: "fbar.us", price: "$315+", highlight: false, features: ["Documented consumer complaints", "No verifiable FinCEN registration", "Unclear submission process", "No transparent pricing", "Questionable legitimacy"] },
    { name: "CPA / Accountant", price: "$200–$500", highlight: false, features: ["Professional guidance", "Usually not e-filed directly", "Multi-week turnaround", "Scheduling required", "Quality varies"] },
    { name: "FinCEN Direct (BSA E-Filing)", price: "Free", highlight: false, features: ["Government-run system", "Complex interface", "No guided process", "No support available", "Technical knowledge needed"] },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-navy-900 text-center mb-4">Compare Your Options</h2>
        <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
          Filing an FBAR shouldn&apos;t be expensive or complicated.
        </p>
        <div className="grid md:grid-cols-4 gap-6">
          {options.map((opt) => (
            <div
              key={opt.name}
              className={`rounded-lg p-6 ${
                opt.highlight
                  ? "bg-navy-900 text-white ring-2 ring-gold-500 shadow-xl"
                  : "bg-white border border-gray-200 shadow-md"
              }`}
            >
              <h3 className={`text-lg font-bold mb-1 ${opt.highlight ? "text-gold-500" : "text-navy-900"}`}>
                {opt.name}
              </h3>
              <p className={`text-2xl font-bold mb-4 ${opt.highlight ? "text-white" : "text-gray-900"}`}>
                {opt.price}
              </p>
              <ul className="space-y-2">
                {opt.features.map((f) => (
                  <li key={f} className={`text-sm flex items-start gap-2 ${opt.highlight ? "text-gray-300" : "text-gray-600"}`}>
                    <span className={opt.highlight ? "text-gold-500" : "text-gray-400"}>
                      {opt.highlight ? "+" : "-"}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
