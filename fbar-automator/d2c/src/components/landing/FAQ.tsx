"use client";

import { useState, useCallback } from "react";

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "What is an FBAR?",
      a: "FBAR stands for Report of Foreign Bank and Financial Accounts (FinCEN Form 114). If you're a U.S. person with foreign financial accounts whose aggregate value exceeded $10,000 at any time during the calendar year, you must file an FBAR with FinCEN.",
    },
    {
      q: "When is the FBAR deadline?",
      a: "The FBAR is due April 15, with an automatic extension to October 15. No extension request is needed — the extension is automatic.",
    },
    {
      q: "Is FBAR Direct affiliated with the government?",
      a: "No. FBAR Direct is a private, FinCEN-registered BSA E-Filing institution. We are not affiliated with the IRS, FinCEN, or any U.S. government agency. We submit your FBAR electronically through FinCEN's official BSA E-Filing System.",
    },
    {
      q: "How do I know my data is secure?",
      a: "We use AES-256-GCM encryption for all sensitive data (SSN, account numbers), SSL/TLS for data in transit, and submit directly through FinCEN's secure SDTM channel. We never store unencrypted PII.",
    },
    {
      q: "What if my filing is rejected?",
      a: "If FinCEN rejects your filing, we'll notify you immediately, help resolve the issue, and resubmit at no additional charge.",
    },
    {
      q: "Can I file for previous years?",
      a: "Yes. You can file FBARs for previous calendar years. If you haven't filed for past years, filing now may help reduce potential penalties.",
    },
  ];

  const toggleFAQ = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleFAQ(index);
    }
  }, [toggleFAQ]);

  return (
    <section className="bg-gray-50 py-20 px-4" aria-labelledby="faq-heading">
      <div className="max-w-3xl mx-auto">
        <h2 id="faq-heading" className="text-3xl font-bold text-navy-900 text-center mb-12">Frequently Asked Questions</h2>
        <div className="space-y-4" role="list">
          {faqs.map((faq, index) => (
            <div key={faq.q} className="bg-white rounded-lg shadow-sm overflow-hidden" role="listitem">
              <button
                id={`faq-question-${index}`}
                aria-expanded={openIndex === index}
                aria-controls={`faq-answer-${index}`}
                onClick={() => toggleFAQ(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-900 focus:ring-inset"
              >
                <h3 className="text-lg font-semibold text-navy-900">{faq.q}</h3>
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className={`w-5 h-5 text-gray-600 transition-transform ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                id={`faq-answer-${index}`}
                role="region"
                aria-labelledby={`faq-question-${index}`}
                hidden={openIndex !== index}
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <p className="px-6 pb-4 text-gray-600">{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
