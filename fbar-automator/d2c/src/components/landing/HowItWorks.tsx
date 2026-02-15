export function HowItWorks() {
  const steps = [
    { num: "1", title: "Enter Your Info", desc: "Personal details and foreign account information — takes about 5 minutes." },
    { num: "2", title: "Review & Sign", desc: "Verify everything is correct and digitally sign Form 114a." },
    { num: "3", title: "We File to FinCEN", desc: "We submit your FBAR directly through the BSA E-Filing System. You get your BSA tracking ID." },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-navy-900 text-center mb-12">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.num} className="text-center">
              <div className="w-12 h-12 bg-gold-500 text-navy-900 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                {step.num}
              </div>
              <h3 className="text-lg font-semibold text-navy-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
