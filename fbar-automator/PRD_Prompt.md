# PRD Generation Prompt: FBAR Bank Statement Automator

## Instructions for the AI

You are acting as a senior product manager with deep expertise in tax technology, document automation, and B2B SaaS for professional services firms. You are building a comprehensive Product Requirements Document (PRD) for a new product called **FBAR Automator** (working title).

Read this entire prompt before beginning. The PRD should be thorough enough that a technical founder could hand it to a development team (or use Claude Code) and begin building an MVP. Do not gloss over details. Where you lack specific information, flag it as a research item with a clear description of what needs to be answered and why it matters.

---

## Business Context

### The Problem

U.S. persons (citizens, residents, entities) with foreign financial accounts exceeding $10,000 in aggregate at any point during the calendar year must file FinCEN Form 114 (FBAR) annually. The filing requires, for each foreign account:

- Bank name and address (including country)
- Account number
- Type of account (bank, securities, other)
- Maximum value of the account during the calendar year, converted to USD

The pain point is **not** the filing itself (that's handled by existing tax software). The pain point is the **data extraction from foreign bank statements**. A preparer at an international tax practice must:

1. Receive bank statements from clients in dozens of countries, languages, and formats
2. Manually read each statement to identify the maximum account balance
3. Identify the correct currency
4. Look up the Treasury Department's year-end exchange rate for that currency
5. Convert the maximum value to USD
6. Manually key all of this into their tax/FBAR preparation software

For a practice with 200-500 FBAR clients, many holding multiple foreign accounts, this is hundreds of hours of tedious manual work concentrated into a few-month window. Errors carry penalties of $10,000+ per violation (non-willful), and willful violations can reach $100,000 or 50% of account balance.

### The Opportunity

No one is automating the specific bridge between "foreign bank statement document" and "structured FBAR-ready data." There are FBAR filing tools (Drake, Lacerte, GoSystem, MyExpatTaxes) and there are bank statement OCR tools (Ocrolus, Veryfi, Parseur, Affinda). But nothing connects the two for this specific use case.

Modern vision-capable LLMs (Claude, GPT-4o) can reliably read, understand, and extract structured data from foreign bank statements regardless of language, format, or layout. This was not feasible with traditional OCR + template matching, but is now viable.

### Distribution Channel

The product will be distributed through international tax practices. One firm relationship can yield 100-500+ filings per year. FBAR filing is annual and recurring, making this a sticky revenue stream. The founding team has an existing relationship with international tax practices as a distribution channel.

### Target User

Primary: Tax preparers and staff at small-to-mid international tax practices (5-50 person firms) that handle significant FBAR volume but are not large enough to have built custom internal tooling.

Secondary: Solo practitioners and enrolled agents specializing in expat tax.

Tertiary (future): Direct-to-consumer for self-filing expats (lower priority, different product).

---

## What the PRD Must Cover

### 1. Product Vision and Positioning

- One-paragraph product vision
- How this fits into the broader tax preparation workflow
- What this product is NOT (it is not a filing tool, not a tax preparation suite, not a general document OCR platform)
- Competitive positioning vs. existing FBAR filing software and generic OCR tools

### 2. User Personas and Jobs to Be Done

Define at least 3 personas:
- The tax preparer doing the actual data entry
- The practice owner/partner concerned with efficiency and liability
- The end client (taxpayer) who provides the bank statements

For each persona, define:
- Their current workflow (step by step)
- Where the pain is worst
- What "done" looks like for them
- What would make them trust/distrust this tool

### 3. Core Feature Set (MVP)

The MVP must include:

**Document Upload and Processing**
- Accept PDF, image (JPEG, PNG, HEIC), and scanned document uploads
- Support batch upload (multiple statements per client, multiple clients)
- Handle statements in any language, any country, any bank format
- Use vision-capable LLM (Claude API / GPT-4o) for extraction, not traditional OCR
- Extract: bank name, bank address, country, account number, account type, currency, all balance figures, and identify the maximum balance

**Currency Conversion**
- Maintain a database of Treasury Department year-end exchange rates (published annually by IRS)
- Research: Where exactly are these rates published? What format? How frequently updated? Is there an API or is it a static PDF/page? Document the exact URL and data format.
- Auto-convert maximum balance from local currency to USD using the correct year-end rate
- Support the full list of currencies that Treasury publishes rates for
- Research: What happens when a statement is in a currency Treasury doesn't publish a rate for? How do preparers handle this today?

**Human-in-the-Loop Review**
- Present extracted data to the preparer for review and approval before export
- Highlight confidence levels on each extracted field (or flag fields for manual review)
- Allow the preparer to correct any field
- Show the original document alongside the extracted data for easy comparison
- This is a FEATURE, not a limitation. It covers liability, builds trust, and generates training data.

**Export / Integration**
- Research this thoroughly. How do preparers actually get data into their filing software? Options may include:
  - CSV/Excel export formatted to match common import templates
  - Direct API integration with Drake, Lacerte, ProSeries, GoSystem, UltraTax
  - XML export matching FinCEN BSA E-Filing format
  - Copy-paste-friendly formatted output
- Research: Does the BSA E-Filing system accept batch uploads? What format? Can third-party software submit directly via API?
- Research: Do any of the major tax software platforms (Drake, Thomson Reuters, Wolters Kluwer, Intuit ProConnect) have import APIs or file-based import for FBAR data specifically?
- Research: What is the FinCEN Form 114 XML schema? Is it publicly documented?

**Client/Account Management**
- Organize by client (taxpayer)
- Track multiple accounts per client
- Track filing year
- Store historical data year-over-year for returning clients
- Support for joint filers (spouse accounts)

### 4. Data Model

Define the core data entities and their relationships:
- Client (taxpayer)
- Filing Year
- Foreign Account
- Bank Statement (document)
- Extracted Data (per statement)
- Reviewed/Approved Data (per account per year)
- Exchange Rate (currency/year)

Include field-level detail for the Foreign Account entity, mapped directly to FinCEN Form 114 fields. Research the exact field names and requirements from the form.

### 5. Technical Architecture

**This section should be opinionated and specific, not hand-wavy.**

Recommend a stack appropriate for:
- Fast MVP development, potentially using AI coding tools
- Fast iteration and deployment
- Secure handling of sensitive financial documents (PII, account numbers)
- LLM API integration for document processing

Consider and make recommendations on:
- Framework: Evaluate and recommend based on speed to MVP, ecosystem maturity, and fit for document-processing workflows. Consider Django, Next.js, Rails, FastAPI, or others. Justify the recommendation.
- Database: PostgreSQL likely, but specify schema considerations
- File storage: S3 or equivalent, with encryption at rest
- LLM integration: Claude API vs. OpenAI API vs. both, with fallback
- Hosting: AWS, GCP, Vercel, Railway, etc.
- Authentication: How do tax practices manage user access?

**Security is critical.** These documents contain:
- Foreign bank account numbers
- Account holder names and addresses
- Financial balances
- SSNs/TINs (may appear on some documents)

The PRD must address:
- Data encryption (at rest and in transit)
- Document retention and deletion policies
- SOC 2 considerations (even if not pursuing immediately, design for it)
- Where LLM API calls send document data and what the provider's data policies are
- Whether to use Claude/OpenAI's zero-data-retention options

### 6. LLM Prompt Engineering

This is a core technical component. The PRD should include:
- A detailed specification for the extraction prompt
- What the prompt should ask the LLM to extract from each document
- Expected output format (JSON schema)
- How to handle multi-page statements
- How to handle statements with multiple accounts on one document
- How to handle statements where balance isn't explicitly labeled (transaction-only statements)
- Error handling: what should the LLM return when it can't confidently extract a field?
- Validation rules the system should apply to LLM output (e.g., account number format checks, balance reasonableness checks)

### 7. Treasury Exchange Rate Integration

Detail the exact implementation:
- Source URL for Treasury year-end exchange rates
- Data format and how to parse it
- How often the rate table is updated (annually, but when exactly?)
- Handling of currencies not on the Treasury list
- Historical rate storage for prior-year filings and amendments

### 8. Workflow and UX

Map the end-to-end workflow:
1. Preparer logs in
2. Selects or creates a client
3. Uploads bank statement(s) for a filing year
4. System processes documents (show progress, estimated time)
5. System presents extracted data for review
6. Preparer reviews, corrects if needed, approves
7. Preparer exports approved data to their filing software
8. System marks account as "ready" or "filed"

Include wireframe descriptions (not actual wireframes, but detailed enough that a designer or developer could build them):
- Dashboard view (clients, status, filing year)
- Upload interface
- Review/approval screen (side-by-side: document viewer + extracted fields)
- Export screen
- Settings (exchange rates, practice info, user management)

### 9. Pricing Model

Research and recommend pricing. Consider:
- Per-filing pricing (e.g., $X per FBAR account processed)
- Per-practice subscription (monthly/annual)
- Tiered pricing based on volume
- What international tax practices currently pay for FBAR preparation (labor cost per filing)
- What would make this a no-brainer ROI for a 20-person practice handling 300 FBARs?

### 10. Go-to-Market

- How to validate with the first 1-3 practices
- What a manual/concierge version looks like before full automation
- Timeline: what needs to be ready for the April 15, 2026 FBAR deadline (or October 15 extension)?
- What does the sales motion look like? Who is the buyer vs. the user?
- Partnership opportunities with existing tax software vendors

### 11. Regulatory and Compliance Considerations

Research and document:
- Is there any regulatory requirement or restriction on using AI/automation for FBAR data extraction?
- What are the preparer's responsibilities regarding accuracy of filed FBARs?
- Does FinCEN or IRS have any guidance on automated preparation tools?
- What disclaimers or terms of service are needed?
- Professional liability considerations: who is responsible if the tool produces an error that leads to a penalty?
- Data privacy: GLBA (Gramm-Leach-Bliley Act) applicability for financial data
- State-level data privacy regulations that may apply

### 12. Risks and Open Questions

Compile a prioritized list of:
- Technical risks (what could go wrong with extraction accuracy?)
- Business risks (what if a major tax software vendor builds this feature?)
- Regulatory risks
- Market risks (is the market actually big enough?)
- Open questions that require founder research or customer interviews to answer

### 13. Success Metrics

Define measurable KPIs for:
- MVP launch (what does "working" look like?)
- First 90 days
- First filing season
- Year one

Include both product metrics (accuracy rate, processing time, user adoption) and business metrics (revenue, customer count, retention).

### 14. Roadmap

Phase 1 (MVP): What ships first
Phase 2 (Post-first-season): What you learn and build next
Phase 3 (Scale): Direct integrations, expanded use cases (FATCA Form 8938, other international reporting)

---

## Research Tasks

The following items require web research during PRD generation. Do not skip these or provide vague answers. Search for and cite specific sources.

1. **FinCEN Form 114 field specifications**: What exact data fields does the form require? Get the actual field list from FinCEN documentation.

2. **Treasury year-end exchange rates**: Find the exact URL where these are published. What format are they in? Is there a machine-readable version (CSV, JSON, API) or only PDF/HTML?

3. **BSA E-Filing system technical specifications**: Does it support batch submission? API access? What file formats does it accept? Is there a developer/technical guide?

4. **Tax software import capabilities**: For each major platform (Drake, Lacerte/ProSeries, GoSystem, UltraTax, ProConnect), research whether they support FBAR data import and in what format.

5. **Market sizing**: How many FBARs are filed annually? How many international tax practices exist in the US? What is the average number of FBAR filings per practice?

6. **Existing competitors**: Beyond what we've already discussed, search for any startups or tools specifically targeting FBAR preparation automation.

7. **GLBA and data privacy**: What are the specific requirements for handling foreign financial account data in a SaaS product?

8. **Pricing benchmarks**: What do tax practices charge clients for FBAR preparation? What do they pay for tax software licenses?

---

## Format Requirements

- Write the PRD in clear, direct language. No filler, no buzzwords.
- Use tables where they improve clarity (feature prioritization, data models, competitive analysis).
- Flag every assumption explicitly.
- Mark every open question or research gap with a [RESEARCH NEEDED] tag.
- Include a table of contents.
- Target length: 8,000-12,000 words. Comprehensive but not padded.
- Do not use em-dashes anywhere in the document.

---

## Context About the Builder

Assume the reader is a technical founder with experience in financial systems, document AI, and SaaS. Skip 101-level explanations. Focus on decisions, tradeoffs, and specifics. The builder has a distribution partner with access to international tax practices as a channel.
