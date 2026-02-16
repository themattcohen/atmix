"use client";

import { useState, useCallback } from "react";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    { q: "What is an FBAR?", a: "FBAR stands for Report of Foreign Bank and Financial Accounts (FinCEN Form 114). If you're a U.S. person with foreign financial accounts whose aggregate value exceeded $10,000 at any time during the calendar year, you must file an FBAR with FinCEN." },
    { q: "When is the FBAR deadline?", a: "The FBAR is due April 15, with an automatic extension to October 15. No extension request is needed \u2014 the extension is automatic." },
    { q: "Is FBAR Direct affiliated with the U.S. government?", a: "No. FBAR Direct is a private electronic filing service. We are a FinCEN-registered BSA E-Filing institution authorized to transmit filings to FinCEN. We are not affiliated with the IRS, FinCEN, or any United States government agency." },
    { q: "How is my data protected?", a: "We use AES-256-GCM encryption for all sensitive data (SSN, account numbers), SSL/TLS for data in transit, and submit directly through FinCEN's secure SDTM channel. We never store unencrypted PII." },
    { q: "Can I file for previous years?", a: "Yes. You can file FBARs for previous calendar years. If you haven't filed for past years, filing now may help reduce potential penalties." },
    { q: "What happens if my filing is rejected?", a: "If FinCEN rejects your filing, we'll notify you immediately, help resolve the issue, and resubmit at no additional charge." },
  ];

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <section id="faq" className="bg-white" aria-labelledby="faq-v2-heading">
      <div className="max-w-[960px] mx-auto py-16 px-4">
        <h2 id="faq-v2-heading" className="font-serif text-[26px] font-bold text-[#0b2d5b] text-center">Frequently asked questions</h2>
        <div className="mt-8 divide-y divide-[#d9d9d9] border-t border-b border-[#d9d9d9]">
          {faqs.map((faq, index) => (
            <div key={faq.q}>
              <button
                id={`faq-v2-question-${index}`}
                onClick={() => toggle(index)}
                aria-expanded={openIndex === index}
                aria-controls={`faq-v2-answer-${index}`}
                className="w-full px-0 py-4 flex justify-between items-center text-left focus:outline-none focus:ring-2 focus:ring-[#1a4480] focus:ring-inset"
              >
                <span className="text-base font-semibold text-[#0b2d5b]">{faq.q}</span>
                <span className="text-lg text-[#1a4480] font-light" aria-hidden="true">{openIndex === index ? "\u2212" : "+"}</span>
              </button>
              <div
                id={`faq-v2-answer-${index}`}
                role="region"
                aria-labelledby={`faq-v2-question-${index}`}
                hidden={openIndex !== index}
                className={`overflow-hidden transition-all duration-300 ${openIndex === index ? "max-h-96" : "max-h-0"}`}
              >
                <p className="pb-4 text-sm text-[#5c5c5c] leading-relaxed">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
