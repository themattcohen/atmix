export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export const faqData: FaqItem[] = [
  // Getting Started
  {
    question: 'What do I need to bring to my first appointment?',
    answer:
      'Bring any tax documents you\'ve received: W-2s, 1099s, K-1s, mortgage interest statements, property tax records, and any other income or deduction-related paperwork. If you\'re a business owner, bring a summary of your income and expenses or export from your bookkeeping software. Prior year returns are helpful but not required.',
    category: 'Getting Started',
  },
  {
    question: 'How do I schedule an appointment?',
    answer:
      'You can schedule a consultation directly through our website. Virtual appointments are available for clients anywhere in the country.',
    category: 'Getting Started',
  },
  {
    question: 'Do you offer virtual tax preparation?',
    answer:
      'Yes. Alpine Tax & Consulting serves clients nationwide through secure virtual appointments and document uploads via TaxDome, our client portal. You upload documents, we prepare your return and walk you through it, and you sign electronically.',
    category: 'Getting Started',
  },
  {
    question: 'What areas do you serve?',
    answer:
      'We serve clients throughout the Denver metro area \u2014 including Aurora, Lakewood, Centennial, Littleton, Englewood, Greenwood Village, and Highlands Ranch \u2014 as well as clients nationwide through virtual tax preparation.',
    category: 'Getting Started',
  },
  {
    question: 'Are you accepting new clients?',
    answer:
      'Yes, Alpine Tax & Consulting is accepting new clients for individual and small business tax preparation. We keep our client list intentional so every client gets direct, personal attention.',
    category: 'Getting Started',
  },

  // Services & Expertise
  {
    question: 'What types of tax returns do you prepare?',
    answer:
      'We prepare federal and state individual returns (Form 1040), small business returns for sole proprietors and single-member LLCs (Schedule C), S-Corp returns (Form 1120-S), and partnership returns (Form 1065). We do not prepare C-Corp returns.',
    category: 'Services & Expertise',
  },
  {
    question: 'Do you help with S-Corp and partnership returns?',
    answer:
      'Yes. S-Corp and partnership filings are a core part of what we do. Beyond preparing the return, we help S-Corp owners understand reasonable compensation requirements, maximize the QBI deduction, and avoid common mistakes.',
    category: 'Services & Expertise',
  },
  {
    question: 'Can you help me decide between an LLC and an S-Corp?',
    answer:
      'Yes. Entity structure decisions have meaningful tax implications. We offer tax planning consultations specifically for these questions \u2014 including mid-year projections that show the actual dollar difference between structures.',
    category: 'Services & Expertise',
  },
  {
    question: 'What if I received an IRS notice?',
    answer:
      'Don\'t ignore it and don\'t panic. Most IRS notices are informational or relate to a specific discrepancy. Alpine Tax can help you understand what it means, gather documentation, and respond accurately and on time.',
    category: 'Services & Expertise',
  },

  // Pricing & Payment
  {
    question: 'How much does tax preparation cost?',
    answer:
      'Individual returns start at $600, small business returns start at $850, and S-Corp or partnership returns start at $2,000. Final pricing is based on your specific situation.',
    category: 'Pricing & Payment',
  },
  {
    question: 'When do I pay?',
    answer:
      'Payment is due prior to filing. Once your return is prepared and reviewed, we collect payment before submitting. We accept major credit cards and other common payment methods through our client portal.',
    category: 'Pricing & Payment',
  },
  {
    question: 'Do you offer payment plans?',
    answer:
      'In some cases, yes. If you have concerns about timing, let us know during your initial consultation and we can discuss options.',
    category: 'Pricing & Payment',
  },
  {
    question: 'Why should I choose a personal tax preparer over a big chain?',
    answer:
      'At Alpine Tax, you work directly with Vinnie Boettcher \u2014 the same person who knows your situation, prepares your return, and answers your questions. For anything beyond a straightforward return, having an experienced tax professional who actually reviews your situation pays for itself.',
    category: 'Pricing & Payment',
  },

  // Process & Timeline
  {
    question: 'How long does it take to prepare my return?',
    answer:
      'Most returns are completed within 7 to 10 business days of receiving your complete documents. During peak tax season, turnaround may run slightly longer.',
    category: 'Process & Timeline',
  },
  {
    question: 'Can you file an extension for me?',
    answer:
      'Yes. If you need more time, we can file a federal extension by the original deadline. An extension gives you more time to file \u2014 it does not extend the time to pay any taxes owed.',
    category: 'Process & Timeline',
  },
  {
    question: 'Do you review prior year returns for missed deductions?',
    answer:
      'Yes, and we recommend it for new clients. If we identify an error or missed opportunity, we can prepare an amended return for open tax years, which is generally the prior three years.',
    category: 'Process & Timeline',
  },
  {
    question: 'What is the TaxDome client portal?',
    answer:
      'TaxDome is our secure client portal where you upload tax documents, sign forms electronically, communicate with our office, and access copies of your filed returns. It uses bank-level encryption for data storage and transmission.',
    category: 'Process & Timeline',
  },

  // Security & Privacy
  {
    question: 'How do you protect my personal information?',
    answer:
      'All client documents and communications are handled through TaxDome, which uses bank-level encryption. We do not use email to send or receive sensitive tax documents. Your information is never shared with third parties outside of what is required to file your return.',
    category: 'Security & Privacy',
  },
  {
    question: 'Is it safe to upload my documents online?',
    answer:
      'Yes. TaxDome is a professional-grade client portal built specifically for handling sensitive financial information. Documents are encrypted in transit and at rest. It is significantly more secure than emailing PDFs.',
    category: 'Security & Privacy',
  },
];

export const faqCategories = [
  'Getting Started',
  'Services & Expertise',
  'Pricing & Payment',
  'Process & Timeline',
  'Security & Privacy',
] as const;
