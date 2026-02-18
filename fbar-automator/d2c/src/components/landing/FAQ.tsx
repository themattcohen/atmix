"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { FAQ_ITEMS } from "@/lib/faq-data";

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
          {FAQ_ITEMS.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
