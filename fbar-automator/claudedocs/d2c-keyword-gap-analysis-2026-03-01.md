# FBAR Keyword Gap Analysis — 2026-03-01

## Current Coverage Summary

**FAQ items**: 33 questions in `d2c/src/lib/faq-data.ts`
**Country pages**: 10 (Canada, UK, Germany, Mexico, Australia, Japan, France, Switzerland, Israel, India)
**Comparison pages**: 3 (vs BSA E-Filing, vs CPA, Best Filing Services 2026)
**Blog posts**: 0 (blog engine exists but no .mdx content files)
**Other marketing pages**: Home, About, How It Works, Pricing, Contact, Privacy, Terms

## Methodology

Researched across Google PAA (People Also Ask), autocomplete suggestions, Reddit (r/tax, r/expats, r/IRS), Quora, Bogleheads, ExpatForum, tax attorney blogs (Golding Lawyers, Sherayzen Law, Gordon Law, Brager Tax, Bright!Tax, Greenback), IRS.gov, FinCEN.gov, and competitor content (TaxesForExpats, MyExpatTaxes, TurboTax, H&R Block expat). Demand signals based on PAA frequency, forum upvotes/views, and competitor content density.

---

## GAP LIST BY ACTION TYPE

### A. New FAQ Items (add to faq-data.ts)

| # | Gap Query | Demand Signal | Priority |
|---|-----------|---------------|----------|
| A1 | "FBAR for Wise/Revolut/PayPal/Payoneer — are digital wallets reportable?" | Very High — top PAA, multiple Reddit threads, Bogleheads, ExpatForum, multiple competitor articles | **P0** |
| A2 | "How do I calculate maximum account value for FBAR?" | High — top PAA, FinCEN.gov dedicated page, every competitor covers it | **P0** |
| A3 | "What exchange rate do I use for FBAR?" | High — PAA, dedicated competitor pages (SDO CPA, Universal Tax), Treasury rate confusion | **P0** |
| A4 | "Do I need to file both FBAR and Form 8938?" | High — top PAA on every FBAR search, IRS comparison page exists | **P1** |
| A5 | "Is foreign real estate reportable on FBAR?" | High — PAA, common confusion point, multiple attorney articles | **P1** |
| A6 | "Do I need to file FBAR for a foreign life insurance policy?" | Medium — PAA, Sherayzen Law dedicated article, Golding Lawyers | **P1** |
| A7 | "FBAR for foreign mutual funds / investment accounts" | Medium — PAA, ties to PFIC/Form 8621 complexity | **P1** |
| A8 | "Can my spouse file jointly on my FBAR?" / "FBAR spousal filing exception" | High — FinCEN dedicated page, top PAA, common for expat couples | **P0** |
| A9 | "What is Form 114a?" | Medium — required for spousal joint filing, FinCEN FAQ | **P2** |
| A10 | "Do I need to report accounts I have signature authority over at work?" | Medium — covered lightly but could expand with corporate officer examples | **P2** |
| A11 | "FBAR for accounts with zero balance" | Medium — PAA, common confusion — must report if open during year and aggregate > $10K | **P2** |
| A12 | "Can I file FBAR on paper / by mail?" | Medium — PAA, answer is NO (electronic only since 2013) | **P2** |
| A13 | "Do I report the account balance on December 31 or the maximum value?" | Very High — #1 mistake cited by every competitor and attorney blog | **P0** |
| A14 | "What is the Bittner Supreme Court ruling and how does it affect FBAR penalties?" | Medium — landmark 2023 case, per-form vs per-account penalties | **P2** |

### B. New Dedicated Pages

| # | Gap Query / Topic | Page Type | Demand Signal | Priority |
|---|-------------------|-----------|---------------|----------|
| B1 | "FBAR for digital nomads" | Landing page | Very High — multiple dedicated guides from all major competitors, growing demographic | **P0** |
| B2 | "FBAR for dual citizens" | Landing page | High — Brager Tax, Golding Lawyers, FBAR Lawyers dedicated articles, large confused audience | **P1** |
| B3 | "FBAR for new immigrants / green card holders" | Landing page | High — IRS.gov dedicated page, CPA Journal, Cook CPA, common first-time filer confusion | **P1** |
| B4 | "FBAR for cryptocurrency / crypto FBAR" | Landing page | Very High — TokenTax, CoinLedger, Koinly all have dedicated pages, FinCEN proposed rules | **P0** |
| B5 | "Streamlined filing compliance procedures" | Landing page | Very High — every tax attorney site has this, huge late-filer audience | **P1** |
| B6 | "Delinquent FBAR submission procedures — step by step" | Landing page | Very High — IRS.gov page, Greenback, Bright!Tax, 1040Abroad all have dedicated guides | **P1** |
| B7 | "FBAR exchange rate calculator / Treasury rates" | Tool page | High — SDO CPA, Universal Tax, IRS Streamlined all have dedicated rate pages with tables | **P1** |
| B8 | "FBAR for military service members overseas" | Landing page | Medium — Military.com article, niche but underserved, patriotic angle | **P2** |
| B9 | "FBAR for businesses / LLC / corporations" | Landing page | Medium — CPA Journal, Golding Lawyers, Cygnetise dedicated articles | **P2** |
| B10 | "FBAR vs FATCA: Complete comparison" | Comparison page | Very High — IRS.gov has comparison table, every competitor has dedicated page | **P0** |

### C. New Country Pages

| # | Country | Demand Signal | Priority |
|---|---------|---------------|----------|
| C1 | South Korea | High — large US-Korean diaspora, mandatory pension system (NPS), unique banking | **P1** |
| C2 | China / Hong Kong | Very High — complex capital controls, MPF pensions, huge expat population | **P0** |
| C3 | Brazil | Medium — poupanca accounts, growing expat community | **P2** |
| C4 | Singapore | High — CPF (Central Provident Fund), major expat hub, financial center | **P1** |
| C5 | Taiwan | Medium — growing tech expat community | **P2** |
| C6 | Netherlands | Medium — large US corporate presence, Dutch pension system | **P2** |
| C7 | UAE / Dubai | High — no-tax jurisdiction, huge American expat population, unique banking | **P1** |
| C8 | Ireland | Medium — US tech company HQs, Irish pension system | **P2** |
| C9 | Philippines | Medium — large Filipino-American diaspora with accounts back home | **P2** |
| C10 | New Zealand | Low-Medium — KiwiSaver pension confusion | **P3** |

### D. Blog Articles (500+ words)

| # | Topic | Demand Signal | Priority |
|---|-------|---------------|----------|
| D1 | "FBAR Mistakes: The 12 Most Common Errors and How to Avoid Them" | Very High — "top 12 mistakes" articles rank well (LateFBAR.com, Sabalier Law), multiple PAA | **P0** |
| D2 | "FBAR Penalties Explained: What Really Happens If You Don't File" | Very High — every competitor has this, top PAA, high fear-driven search intent | **P0** |
| D3 | "Streamlined Filing vs Voluntary Disclosure vs Delinquent FBAR Procedures: Which Program Is Right?" | High — complex topic, attorney blogs dominate but no simple comparison exists | **P1** |
| D4 | "FBAR for Crypto: Do You Need to Report Bitcoin, DeFi, and NFTs?" | Very High — TokenTax, CoinLedger, Koinly, Block3 Finance all compete here | **P0** |
| D5 | "FBAR for Expat Couples: Joint Filing, Non-US Spouse, and Form 114a" | High — FinCEN dedicated page, Greenback, NSKT Global, TaxesForExpats articles | **P1** |
| D6 | "What Happens During an FBAR Audit? IRS Examination Process Explained" | Medium — attorney blogs cover this, fear-driven search, good conversion topic | **P1** |
| D7 | "FBAR and Foreign Pensions: UK SIPP, Australian Super, Canadian RRSP, and More" | High — Sherayzen Law, Golding Lawyers, CPA Journal, Greenback all have articles | **P1** |
| D8 | "The Bittner Decision: How the Supreme Court Changed FBAR Penalties" | Medium — landmark case, educational, establishes authority | **P2** |
| D9 | "FBAR Record Keeping: What Documents to Save and For How Long" | Medium — PAA, practical utility content | **P2** |
| D10 | "First-Time FBAR Filing Checklist for US Expats" | High — targets first-time filer anxiety, every competitor has some variant | **P1** |
| D11 | "FBAR and Foreign Real Estate: What You Do (and Don't) Need to Report" | Medium — common confusion, ties into FATCA differences | **P2** |
| D12 | "IRS Voluntary Disclosure Program 2026: Proposed Changes and What They Mean" | Medium-High — IRS proposed VDP changes Dec 2025, timely topic | **P1** |
| D13 | "FBAR for Digital Wallets: Wise, Revolut, PayPal, Payoneer, and N26" | Very High — top search confusion point, multiple forum threads | **P0** |
| D14 | "How to Calculate Your FBAR Maximum Account Value (Step-by-Step)" | High — #1 filing mistake, practical utility, good for featured snippet | **P0** |

### E. Existing Page Enhancements

| # | Page | Enhancement | Priority |
|---|------|-------------|----------|
| E1 | FAQ section on homepage | Add structured FAQ schema for all FAQ items (if not already present) | **P0** |
| E2 | Pricing page | Add "FBAR Direct vs TurboTax" and "FBAR Direct vs MyExpatTaxes" comparisons | **P1** |
| E3 | Country pages — all 10 | Add country-specific pension/retirement account names and reporting rules | **P1** |
| E4 | Country pages — all 10 | Add "Common questions for [country]" subsection with country-specific FAQs | **P2** |
| E5 | How It Works page | Add "What you'll need" checklist (passport, bank statements, max values, exchange rates) | **P1** |
| E6 | Compare: Best Filing Services | Add TurboTax Expat, Expatfile, 1040Abroad to comparison | **P1** |
| E7 | FAQ — penalties question | Update penalty amounts to 2026 inflation-adjusted figures ($16,536 non-willful, $165,353 willful) | **P0** |

---

## TOP 10 GAPS — Detailed Content Suggestions

### 1. FBAR for Digital Wallets (Wise, Revolut, PayPal, Payoneer)
**Type**: FAQ item (A1) + Blog article (D13)
**Why**: This is the single most confused topic on Reddit, ExpatForum, Bogleheads, and Quora. Wise (UK-based) and Revolut (UK/Lithuania) are foreign accounts. PayPal depends on whether balance is held. N26 (Germany) is foreign. This confusion drives enormous search volume.
**FAQ answer** (2-3 sentences): "Accounts with fintech companies like Wise, Revolut, N26, and Payoneer are generally reportable on the FBAR because these companies are headquartered outside the United States. Whether an account is 'foreign' depends on where the financial institution is based, not which currency you hold. PayPal is typically a US-based account and not reportable unless you hold balances in a foreign PayPal entity."
**Blog article**: Deeper dive with per-platform breakdown, multi-currency account handling, and examples.

### 2. How to Calculate Maximum Account Value
**Type**: FAQ item (A2 + A13) + Blog article (D14)
**Why**: The #1 most common FBAR mistake according to every attorney blog and competitor. People report Dec 31 balance instead of maximum value. People don't know how to handle multiple currencies in one account.
**FAQ answer**: "Report the highest balance your account reached at any point during the calendar year — not the balance on December 31. Check all your periodic statements (monthly or quarterly) and use the highest balance shown. Convert to US dollars using the Treasury Department's December 31 exchange rate for that year, regardless of when the maximum balance occurred."
**Blog article**: Step-by-step with examples for single-currency, multi-currency, and multi-account scenarios.

### 3. FBAR for Cryptocurrency
**Type**: Landing page (B4) + Blog article (D4)
**Why**: TokenTax, CoinLedger, and Koinly all have dedicated FBAR-for-crypto pages. FinCEN proposed new rules in 2025 to explicitly include crypto. DeFi wallets (no custodian, no country) are a gray area. Staking, NFTs, and DEX usage create additional confusion.
**Landing page content**: What's reportable now, what FinCEN proposed, foreign vs domestic exchanges, DeFi/DEX exclusions, how to determine max value for volatile crypto, FATCA implications.
**Blog article**: Practical examples — Binance (foreign), Coinbase (domestic), Kraken, DeFi protocols.

### 4. FBAR vs FATCA Complete Comparison
**Type**: Comparison page (B10)
**Why**: IRS has its own comparison table page. Every single competitor has a dedicated FBAR vs FATCA page. Top PAA on nearly every FBAR-related search. Current FAQ covers it briefly (items ~52-53) but a full comparison page with side-by-side table would capture significant search traffic.
**Page content**: Side-by-side comparison table (filing agency, thresholds, account types, asset types, penalties, deadlines), "Do I need to file both?" decision tree, FBAR Direct's role (FBAR only, not 8938).

### 5. FBAR for Digital Nomads
**Type**: Landing page (B1)
**Why**: Every major competitor (Greenback, Bright!Tax, TaxesForExpats, MyExpatTaxes, H&R Block Expat) has a dedicated digital nomad page. This is a fast-growing demographic that opens accounts in multiple countries while traveling. High conversion potential — these are tech-savvy users who prefer self-service.
**Page content**: What triggers FBAR for nomads, common platforms (Wise, Revolut, local bank accounts), multiple-country reporting, FEIE interaction, streamlined procedures for first-time awareness.

### 6. Streamlined Filing / Delinquent FBAR Procedures
**Type**: Landing pages (B5, B6) + Blog article (D3)
**Why**: Massive search volume from late filers. Every tax attorney site ranks for these terms. IRS has dedicated pages. The fear of penalties drives high-intent searches. Current FAQ mentions delinquent procedures briefly but doesn't explain the three IRS programs.
**Landing page content**: Step-by-step guide for each program, eligibility criteria, penalty exposure, when to hire an attorney vs self-file.

### 7. FBAR Spousal Filing / Joint Accounts
**Type**: FAQ items (A8, A9) + Blog article (D5)
**Why**: FinCEN has a dedicated "Filing for Spouse" page. Extremely common for expat couples — one US citizen, one non-US spouse. Form 114a requirement is poorly understood. Current FAQ covers joint accounts but not the spousal exception in detail.
**FAQ answer for A8**: "Yes, spouses can file a single FBAR together if all the non-filing spouse's reportable accounts are jointly owned with the filing spouse. Both spouses must complete and sign FinCEN Form 114a (Record of Authorization to Electronically File FBARs), which you keep for your records — it is not submitted with the FBAR."

### 8. FBAR Penalties Deep Dive
**Type**: Blog article (D2)
**Why**: Top search query. Every competitor has a penalties page. Current FAQ covers penalties but a long-form article can rank for many long-tail queries: "FBAR penalty for one year", "FBAR penalty reasonable cause", "FBAR willful vs non-willful", "Bittner ruling impact", "can IRS waive FBAR penalty".
**Blog content**: Penalty tiers (non-willful, willful, criminal), inflation-adjusted 2026 amounts, Bittner Supreme Court ruling, reasonable cause defense, mitigation guidelines, real examples.

### 9. FBAR Exchange Rate / Treasury Rate
**Type**: FAQ item (A3) + Tool page (B7)
**Why**: SDO CPA, Universal Tax Professionals, and IRS Streamlined Procedures all have dedicated exchange rate pages that rank well. A simple tool page with a table of common Treasury rates for each year would be a high-utility, high-traffic page.
**FAQ answer**: "Always use the U.S. Treasury Department's end-of-year exchange rate for December 31 of the reporting year. This rate applies regardless of when your account reached its maximum balance. Treasury rates are published at fiscaldata.treasury.gov. FBAR Direct automatically applies the correct Treasury rate for the calendar year you are filing."
**Tool page**: Searchable table of Treasury rates by year and currency, with link to official Treasury source.

### 10. FBAR Common Mistakes / Filing Checklist
**Type**: Blog articles (D1, D10)
**Why**: "FBAR mistakes" and "FBAR checklist" are high-volume informational queries. LateFBAR.com's "Top 12 Mistakes" article ranks well. First-time filer anxiety drives searches for checklists and guides.
**D1 content**: Top 10-12 mistakes with explanations — using Dec 31 balance, omitting closed accounts, missing signature authority accounts, wrong exchange rate, confusing FBAR with 8938, not reporting zero-balance accounts, etc.
**D10 content**: Pre-filing checklist — documents needed, how to find max values, where to get exchange rates, what info to have ready.

---

## COUNTRY PAGE GAPS — Additional Detail

Countries with high US diaspora / expat populations not yet covered:

| Country | Key FBAR Nuance | US Population Estimate |
|---------|-----------------|----------------------|
| **China/HK** | Capital controls, MPF pensions, WeChat Pay/Alipay reporting | ~2.5M Chinese-Americans |
| **South Korea** | National Pension Service (NPS), strict banking requirements | ~1.8M Korean-Americans |
| **Singapore** | CPF, major finance hub, high-income expats | ~30K US expats |
| **UAE/Dubai** | No income tax, large US corporate presence, DIFC accounts | ~50K US expats |
| **Philippines** | SSS/GSIS pensions, remittance accounts, large diaspora | ~4M Filipino-Americans |
| **Brazil** | Poupanca savings, complex banking system | ~130K US citizens |
| **Netherlands** | ABP/PFZW pensions, large US corporate presence | ~40K US expats |
| **Ireland** | PRSA pensions, US tech hub | ~30K US expats |
| **Taiwan** | Labor pension, growing tech expat base | ~30K US citizens |

---

## COMPETITOR CONTENT DENSITY

Top competitor content areas that fbardirect.com lacks entirely:

| Topic | Competitors With Dedicated Pages |
|-------|--------------------------------|
| FBAR for crypto | TokenTax, CoinLedger, Koinly, Block3, Golding, CoinTracking |
| FBAR for digital nomads | Greenback, Bright!Tax, TaxesForExpats, MyExpatTaxes, H&R Block |
| FBAR vs FATCA comparison | IRS.gov, SDO CPA, Greenback, Bright!Tax, 1040Abroad, Gordon Law, Golding |
| Streamlined procedures | IRS.gov, Greenback, Bright!Tax, 1040Abroad, H&R Block, Golding, Gordon Law |
| Delinquent FBAR guide | IRS.gov, Greenback, TaxesForExpats, Bright!Tax, 1040Abroad, Golding |
| Exchange rate tables | SDO CPA, Universal Tax, IRS Streamlined |
| FBAR penalty guide | 1040Abroad, TaxesForExpats, Greenback, Golding, IRS Streamlined |
| FBAR common mistakes | LateFBAR, Sabalier Law, ExpatriationAttorneys, TaxSamaritan |
| FBAR for military | Military.com, Cook CPA |
| FBAR for businesses | Golding, CPA Journal, Cygnetise |
| FBAR for deceased/estate | Golding, IRS Streamlined, Freeman Law |

---

## IMPLEMENTATION PRIORITY MATRIX

### Immediate (This Sprint)
- **A1, A2, A3, A8, A13**: 5 new FAQ items — digital wallets, max value, exchange rates, spousal filing, Dec 31 vs max value
- **E7**: Update penalty amounts to 2026 figures
- **B10**: FBAR vs FATCA comparison page

### Next Sprint
- **B1**: Digital nomads landing page
- **B4**: Crypto FBAR landing page
- **B5, B6**: Streamlined / Delinquent procedures pages
- **D1, D2**: First two blog articles (mistakes + penalties)
- **D13, D14**: Blog articles on digital wallets + max value calculation
- **A4-A7**: Additional FAQ items

### Following Sprint
- **C1, C2, C4, C7**: Country pages (South Korea, China/HK, Singapore, UAE)
- **B7**: Exchange rate tool/table page
- **D3-D7**: Additional blog articles
- **E2-E6**: Existing page enhancements

### Backlog
- **B2, B3, B8, B9**: Niche landing pages (dual citizens, immigrants, military, businesses)
- **C3, C5, C6, C8, C9, C10**: Remaining country pages
- **D8-D12**: Remaining blog articles
- **A9-A14**: Lower-priority FAQ items
