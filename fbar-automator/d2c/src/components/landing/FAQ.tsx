"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border-gray">
      <button
        className="w-full py-3 flex items-start justify-between text-left focus:outline-none group"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className="text-base font-bold text-gov-blue pr-4">
          {question}
        </span>
        {isOpen ? (
          <Minus className="h-4 w-4 text-gov-blue flex-shrink-0 mt-1" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4 text-gov-blue flex-shrink-0 mt-1" aria-hidden="true" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 text-text-primary text-sm leading-relaxed max-w-[700px]">
          {answer}
        </div>
      )}
    </div>
  );
}

export function FAQ() {
  return (
    <section
      id="faq"
      className="w-full bg-white py-10 px-4 border-b border-border-gray"
    >
      <div className="max-w-doc mx-auto text-left">
        <h2 className="text-2xl font-heading font-bold text-gov-blue mb-6">
          Frequently asked questions
        </h2>

        <div className="border-t border-border-gray">
          <FAQItem
            question="What is an FBAR?"
            answer="The Report of Foreign Bank and Financial Accounts (FBAR), or FinCEN Form 114, is a report required by the Bank Secrecy Act. It must be filed by United States persons who have a financial interest in or signature authority over foreign financial accounts if the aggregate value of the foreign financial accounts exceeds $10,000 at any time during the calendar year."
          />
          <FAQItem
            question="When is the FBAR deadline?"
            answer="The FBAR must be filed electronically with FinCEN by April 15 of each year. However, FinCEN grants an automatic extension to October 15 each year. You do not need to request this extension; it is automatic."
          />
          <FAQItem
            question="Is FBAR Direct a government agency?"
            answer="No. FBAR Direct is a private tax technology company and a FinCEN-registered BSA E-Filing institution. We are authorized to transmit FinCEN Form 114 on behalf of filers through the BSA E-Filing System. We are not the Department of the Treasury or FinCEN."
          />
          <FAQItem
            question="How is my data protected?"
            answer="We utilize bank-grade 256-bit SSL encryption for all data transmission. Your data is encrypted at rest and submitted directly to FinCEN's secure BSA E-Filing system. We do not share your personal or financial data with any third parties other than FinCEN."
          />
          <FAQItem
            question="Can I file for previous years?"
            answer="Yes. If you are filing late for previous years, you can select the specific calendar year you are filing for within our system. The system will prompt you to provide a reason for late filing, which is required by FinCEN."
          />
          <FAQItem
            question="What happens if my filing is rejected?"
            answer="In the rare event that FinCEN rejects a filing (usually due to formatting issues with specific foreign addresses), we will notify you immediately with the specific error code. You can correct the information and resubmit through our platform at no additional cost."
          />
        </div>
      </div>
    </section>
  );
}
