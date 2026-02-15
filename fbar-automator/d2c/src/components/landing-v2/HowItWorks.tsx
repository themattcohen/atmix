export function HowItWorks() {
  const steps = [
    { num: "1.", title: "Enter your information", desc: "Provide your personal details and foreign account information. The guided form takes approximately 5\u201310 minutes." },
    { num: "2.", title: "Review and sign", desc: "Review your filing for accuracy and digitally sign FinCEN Form 114a (Record of Authorization to Electronically File FBARs)." },
    { num: "3.", title: "We submit to FinCEN", desc: "Your FBAR is transmitted to FinCEN through the BSA E-Filing System. You receive a BSA tracking ID as confirmation of submission." },
  ];

  return (
    <section id="how-to-file" className="bg-white py-16 px-4">
      <div className="max-w-[960px] mx-auto">
        <h2 className="font-serif text-[26px] font-bold text-[#0b2d5b]">How to file with FBAR Direct</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-10">
          {steps.map((step) => (
            <div key={step.num}>
              <p className="text-2xl font-bold text-[#1a4480]">{step.num}</p>
              <p className="text-lg font-semibold text-[#0b2d5b] mt-2">{step.title}</p>
              <p className="text-sm text-[#5c5c5c] mt-2 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
