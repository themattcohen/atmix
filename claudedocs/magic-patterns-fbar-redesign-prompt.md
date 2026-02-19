# Magic Patterns Prompt: FBAR Automator B2B — Complete Redesign

## What This App Is

FBAR Automator is a B2B SaaS platform for tax and accounting practices that automates FBAR (Foreign Bank Account Report / FinCEN Form 114) filing preparation. It uses AI to extract data from foreign bank statements in any language and converts them into structured, filing-ready data with automatic USD currency conversion using Treasury exchange rates.

**Target users:** Tax preparers, practice owners, and reviewers at international tax firms who manage dozens to hundreds of FBAR clients per year.

**Core value prop:** Eliminates the manual, error-prone process of reading foreign bank statements, identifying maximum balances, looking up exchange rates, and converting to USD. What takes a preparer 45–90 minutes per client now takes under 5 minutes.

---

## Design a complete, modern B2B SaaS interface for this application with the following pages and components:

---

### Page 1: Login / Authentication

Simple, centered login card on a clean background. Fields: email, password, "Forgot password?" link, and a "Sign In" button. Subtle branding — app name "FBAR Automator" with a small document/file icon. No excessive marketing copy. Professional and trustworthy. Include a link to register for new practices.

---

### Page 2: Dashboard (Home)

The main landing page after login. Should feel like a command center for a busy tax practice during filing season.

**Key stats cards (top row, 4 across):**
- Total Clients (with icon)
- Foreign Accounts tracked (with icon)
- Active Filings in progress (with icon)
- Exported / Filed this season (with icon)

**Filing Status Breakdown:** A horizontal stacked bar chart or segmented progress bar showing the distribution of all filings by status: Not Started, In Progress, Reviewed, Exported, Filed. Use color-coded segments (gray, blue, amber, green-light, green-dark).

**Recent Activity Feed:** A compact timeline or list showing the last 5–8 actions across the practice — "Statement uploaded for John Doe", "Filing exported for Jane Smith", "Account reviewed for Acme Corp", etc. Each item has a timestamp and a link to the relevant client/filing.

**Quick Actions:** Prominent buttons or cards: "Add New Client", "Upload Statements", "View Clients Needing Review".

---

### Page 3: Clients List

A data table of all clients in the practice with search and filtering.

**Columns:**
- Client Name (link to detail)
- Type (Individual / Entity) — shown as a subtle badge
- TIN (masked: ***-**-1234)
- Number of Foreign Accounts
- Latest Filing Year + Status Badge (color-coded: gray/blue/amber/green)
- Actions (view, edit)

**Above the table:** Search bar on the left, "Add Client" button on the right. Optional filter chips for filing status.

**Empty state:** Friendly message with a CTA to add the first client.

**Design notes:** Clean, airy table with good whitespace. Rows should be easy to scan. Status badges are the primary visual differentiator per row.

---

### Page 4: Client Detail

Accessed by clicking a client name. Shows everything about one client.

**Header area:**
- Client name (large), client type badge, masked TIN
- Edit and Delete buttons (delete only for admins)
- Breadcrumb: Clients > [Client Name]

**Section 1 — Client Information Card:**
- Full legal name, TIN type (SSN/EIN/ITIN), date of birth (if individual), address
- Filing type (Individual or Joint), spouse info if joint

**Section 2 — Foreign Accounts:**
- Card or mini-table for each foreign account: Institution name, account number (masked), account type (Bank/Securities/Other), country, currency
- "Add Account" button
- Expandable/collapsible if many accounts

**Section 3 — Filing Years:**
- Table showing each filing year (2024, 2023, etc.) with: Status badge, number of statements uploaded, number of accounts reviewed, "Open" link
- "Start New Filing Year" button

**Workflow Progress Indicator:**
- A horizontal stepper or progress bar showing the filing workflow stages for the most recent year: Upload Statements → Review Accounts → Export → File
- Highlighted step = current stage

---

### Page 5: Filing Year — Tabbed Interface

When a user opens a specific filing year for a client, show a tabbed interface with 4 tabs:

#### Tab 1: Overview
- Filing year, client name, status badge
- 4 metric cards: Statements Uploaded (count), Accounts Reviewed (X of Y), Aggregate Max Value (USD total), Filing Status
- Progress banner: "3 of 5 accounts reviewed — 2 remaining" with a colored progress bar
- Next Steps cards that guide the user: "Upload remaining statements", "Review extracted data", "Export for filing" — highlight the current actionable step, gray out completed/future steps

#### Tab 2: Upload
- Large drag-and-drop zone with dashed border. Accepts PDF, JPEG, PNG, TIFF. Icon and helper text: "Drop bank statements here or click to browse"
- Below the drop zone: list of already-uploaded files with columns: File name, upload date, processing status (Pending / Processing / Completed / Error), actions (view, reprocess, delete)
- Processing status uses animated indicators for in-progress items

#### Tab 3: Review
- This is the most complex and important page. It's where preparers verify AI-extracted data against source documents.
- For each foreign account that has extracted data, show a **review card**:
  - Header: Institution name, account number (masked), account type, country flag or code
  - Extracted fields in a clean form layout: Bank Name, Account Number, Account Type, Currency, Maximum Value (foreign currency), Maximum Value (USD), Exchange Rate Used (with source: "Treasury 2024 Year-End Rate")
  - Each field shows a **confidence indicator** (green dot = high, yellow = medium, red = low) based on AI extraction confidence
  - Editable fields — the preparer can correct any value
  - "Approve Account" button to lock in the reviewed data
  - Collapse/expand to manage screen real estate with many accounts
- For accounts without statements (manual entry), show a simpler form card for manual data input
- At the top: progress summary "3 of 5 accounts approved" with a progress bar

#### Tab 4: Export
- Filing summary card: Client name, filing year, total accounts, aggregate max value (USD), filing status
- Alert banner if not all accounts are reviewed yet ("2 accounts still need review before export")
- Three export format cards side by side:
  - **FinCEN XML** — "BSA E-Filing batch format. Upload directly to FinCEN." Download button.
  - **CSV Workpaper** — "Spreadsheet format for your records. TINs are masked." Download button.
  - **PDF Report** — "Professional workpaper with extracted values, exchange rates, and corrections." Download button.
- Each card has an icon, brief description, and a download button. Buttons disabled if filing isn't ready.

---

### Page 6: Settings

Clean settings page with sections:

**Practice Information:** Firm name, EIN, address, phone, Transmitter Control Code (TCC). Editable form with Save button.

**Team Members:** Table showing users: Name, email, role (Admin / Preparer / Reviewer), status (Active/Invited). Actions: Edit role, Remove. "Invite Team Member" button.

**Exchange Rates:** Link to exchange rate management — shows Treasury rates by year, option to add manual rates for unlisted currencies.

**Data Retention:** Policy settings for how long to retain uploaded documents after filing.

---

### Global Components

**Sidebar Navigation (persistent, left side):**
- App logo/name at the top
- Nav items with icons: Dashboard, Clients, Settings
- User avatar + name at the bottom with a dropdown for profile/logout
- Collapsible on mobile

**Header Bar (top of main content area):**
- Page title on the left
- Breadcrumb navigation where applicable
- User avatar/menu on the right (if not in sidebar)

**Status Badges:** Consistent, pill-shaped badges used everywhere:
- Not Started: gray background
- In Progress: blue background
- Reviewed: amber/yellow background
- Exported: light green background
- Filed: dark green background

---

## Design Direction & Visual Style

**Overall aesthetic:** Modern, clean, professional B2B SaaS. Think Linear, Vercel Dashboard, or Mercury (banking). Not playful, not overly corporate. Confident and precise — matching the trust requirements of tax professionals handling sensitive financial data.

**Color palette:**
- Primary: Deep indigo or navy (#1e1b4b or similar) — used for primary buttons, active nav, key headings
- Accent: A modern blue or teal for interactive elements and links
- Status colors: Gray (not started), Blue (in progress), Amber (reviewed/pending), Green (exported/filed), Red (errors/destructive)
- Backgrounds: Very light gray (#f8fafc or #fafafa) for page backgrounds, white for cards and content panels
- Text: Near-black (#0f172a) for primary text, medium gray (#64748b) for secondary

**Typography:** Inter or similar clean sans-serif. Use font weight to create hierarchy (semibold for headings, regular for body, medium for labels).

**Spacing & Layout:** Generous whitespace. Cards with subtle shadows and rounded corners (8px radius). 16-24px padding inside cards. Clean grid-based layouts.

**Icons:** Lucide icon set or similar line-icon library. Consistent stroke weight.

**Key design principles:**
1. **Data clarity first** — Tax preparers need to scan and verify data quickly. Prioritize readability, alignment, and clear visual hierarchy.
2. **Trust through transparency** — Show confidence scores, source attribution ("Treasury 2024 rate"), and audit trails. Never hide how data was derived.
3. **Workflow guidance** — The interface should always make it obvious what to do next. Progress indicators, step highlights, and contextual CTAs guide users through the filing process.
4. **Professional restraint** — No gradients, no animations for the sake of animation, no emoji. Clean, flat, information-dense but not cramped.
5. **Responsive** — Must work on desktop (primary) and tablet. Sidebar collapses on smaller screens.

---

## What to Generate

Please generate high-fidelity, production-ready React components (using Tailwind CSS) for all pages listed above. Include:
- A complete sidebar navigation component
- Dashboard with real-looking sample data
- Clients list with sample rows
- Client detail page with sample account and filing data
- Filing year tabbed interface with all 4 tabs (Overview, Upload, Review, Export)
- Settings page
- Login page
- All shared components: status badges, stat cards, progress bars, buttons, form inputs, tables

Use realistic sample data throughout — real-sounding client names, bank names (Deutsche Bank, HSBC Hong Kong, UBS Zurich, Mizuho Bank), currencies (EUR, HKD, CHF, JPY), and plausible balance amounts.
