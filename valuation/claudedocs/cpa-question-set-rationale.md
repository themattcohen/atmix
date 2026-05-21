# CPA Question Set Rationale
Someday Consulting Valuation Webapp

---

## Why This Question Set

The original RightExit question set was designed for generic SMB sellers. Eight questions used language ("CRM vs. ERP", "lease remaining", "cash and carry") that either does not exist in CPA firm context or captures the wrong variable entirely. This rewrite preserves the J4 sellability formula exactly (all G weights, all max scores, the COMBINED_MAX=210 denominator) while replacing 8 of 22 scoring questions with CPA-specific equivalents. The net effect: higher signal per question, lower confusion per dropdown, and multiples that actually match what CPA acquirers underwrite against.

---

## Replacement Table

| Source question | Replacement | Why the CPA version captures more deal-relevant signal |
|---|---|---|
| Q13 (S1): "Energy/time available for sale prep" | "Capacity between busy seasons to prepare for a sale" | CPA firms have defined off-seasons. "A Large Amount" of energy is meaningless without acknowledging the Jan-Apr and Sep-Oct crunch. This surfaces whether the owner can actually prep without destroying client service. |
| Q15 (S1): "How long working on exit plan" | "Most recent partner exit — when and was transition clean?" | Years spent thinking about an exit is noise. A prior clean partner exit is direct evidence of client-transfer capability, which is what buyers are actually paying for. |
| Q8 (S2): "Project-based?" | "Advisory / CAS revenue as % of total" | "Project vs. recurring" conflates annual compliance with one-time projects. The advisory/CAS share is the variable that directly maps to the multiple premium: compliance-only firms get 0.8-1.2x gross; advisory-forward firms get 1.5x+. |
| Q9 (S2): "Largest single customer %" | "Top 3 clients combined %" with CPA-relevant bands | CPA buyers care about the top 3 combined (three concentrated tax clients who all retire is the same risk as one whale). The 15%/30%/50% bands match standard rep & warranty thresholds in CPA M&A term sheets. |
| Q10 (S2): "Owner hours/week IN the business" | "Partner billable time vs. management time split" | Raw hours is noisy. A partner billing 35 hrs/week with no BD is a risk; one billing 15 hrs/week but driving $800K in new business is an asset. The billable/management split is what acquirers actually diligence. |
| Q11 (S2): "Lease remaining" | "Realization rate" | Lease length is nearly irrelevant — CPA firms are in standard office and buyers either assume or go remote. Realization rate is a direct margin proxy. Moving from 80% to 90% on $1M of standard billings is $100K revenue with zero incremental cost. |
| Q12 (S2): "Company age" | "Partner age profile and succession alignment" | Firm age is a weak signal. A 40-year firm where all partners are 63 has worse succession risk than a 12-year firm with one 45-year-old managing partner. Partner-age dynamics drive exit urgency and negotiating leverage — exactly what buyers price into earnout structures. |
| Q13 (S2): "Business operating system (ERP/CRM)" | "Practice management platform (CCH/UltraTax/Drake/Lacerte)" | No CPA firm uses a "Cloud-based ERP." The relevant axis is modern integrated practice management vs. cobbled-together workflow. Platform choice directly affects integration cost, which buyers price into post-close risk. |
| Q14 (S2): "How customers pay" | "Recurring revenue mix (retainer/subscription vs. annual billing)" | "Cash and carry" and "30-90 day terms" do not exist in CPA billing. The meaningful distinction is monthly retainer (auto-renewing, predictable) vs. annual re-engagement (reinstatement risk). Monthly retainer coverage above 70% is explicitly modeled as a value premium in CPA deal structures. |

---

## Calibration Proof

### Step 1 — Readiness (must sum to 60)

| ID | Cell | G | Max (G x 5) | Changed? |
|---|---|---|---|---|
| q_how_heard | H10 | 0 | 0 | No (tracking-only) |
| q_thinking_about_selling | H11 | 0 | 0 | No (tracking-only) |
| q_exit_timeline | H12 | 2 | 10 | No |
| q_busy_season_capacity | H13 | 2 | 10 | Yes (text rewrite) |
| q_shareholder_count | H14 | 2 | 10 | No |
| q_partner_exit_history | H15 | 1 | 5 | Yes (full replacement) |
| q_shareholder_alignment | H16 | 2 | 10 | No |
| q_life_plan | H17 | 3 | 15 | No |
| q_sale_price_target | H18 | — | 0 / 15 | No (toggle preserved) |
| **STEP1_MAX** | | | **60** | |

Note: K18 = 0 when toggle is Off (the baseline). When toggle is On, K18 = 15, but K39 is evaluated at actual values — this is source-sheet behavior, preserved verbatim.

### Step 2 — Risk (must sum to 150)

| ID | Cell | G | Max (G x 5) | Changed? |
|---|---|---|---|---|
| q_fye | H24 | 0 | 0 | No (tracking-only) |
| q_incorporated | H25 | 3 | 15 | No |
| q_profit_last_year | H26 | 3 | 15 | No |
| q_profit_last_6mo | H27 | 3 | 15 | No |
| q_financial_trend | H28 | 2 | 10 | No |
| q_clean_financials | H29 | 2 | 10 | No |
| q_gm_or_coo | H30 | 3 | 15 | No |
| q_advisory_revenue_mix | H31 | 2 | 10 | Yes (full replacement) |
| q_client_concentration | H32 | 2 | 10 | Yes (full replacement) |
| q_partner_billable_split | H33 | 1 | 5 | Yes (full replacement) |
| q_realization_rate | H34 | 1 | 5 | Yes (full replacement) |
| q_partner_age_dynamics | H35 | 1 | 5 | Yes (full replacement) |
| q_practice_mgmt_stack | H36 | 2 | 10 | Yes (full replacement) |
| q_recurring_revenue_mix | H37 | 2 | 10 | Yes (full replacement) |
| q_active_lawsuits | H38 | 2 | 10 | No |
| q_spof_count | H39 | 1 | 5 | No |
| **STEP2_MAX** | | | **150** | |

COMBINED_MAX = 60 + 150 = **210** (= K39; J4 denominator unchanged)

---

## Open Questions for Matt

1. **Realization rate weight.** Currently G=1 (max 5 pts), matching the original "lease remaining" slot. Realization rate is arguably the single most important CPA-firm efficiency metric — the difference between 75% and 90% realization on a $1M firm is $150K of revenue. Should this be G=2 (max 10 pts) instead? Doing so requires reducing another question from G=2 to G=1 to keep STEP2_MAX=150. Candidate for reduction: q_advisory_revenue_mix (already captured partially by q_recurring_revenue_mix). Matt's call.

2. **Advisory mix vs. recurring mix overlap.** q_advisory_revenue_mix (advisory/CAS %) and q_recurring_revenue_mix (retainer %) are correlated: advisory firms tend to be on retainer. Should one replace the other entirely, freeing a question slot for something else? Or keep both because the correlation is imperfect (a pure-compliance firm can be on monthly retainer for write-up work)? If dropped, the freed G=2 slot could add a "staff retention rate" or "revenue per partner" question.

3. **Partner exit history scoring.** Score 3 is awarded to "No prior partner exit (founder-only firm)" — a solo founder who has never had to manage a partner transition gets a middle score. Some buyers will view this as lower risk (no messy partner dynamics) and some as higher risk (no evidence of transferability). Should the solo-founder answer score higher (4) or stay at 3?

4. **SPOFs scoring direction.** The source sheet scores 0 SPOFs as rawScore=0 (not rawScore=5). This is intentional — the SPOF question is a penalty-only question, not a bonus question. Confirming: 0 SPOFs contributes 0 points (not 5), and any SPOF identified is a deduction. This matches the source exactly. Flagging because it is counterintuitive — a firm with no SPOFs does not get rewarded, it simply avoids being penalized.

5. **CPA-specific multiple table.** The spec calls for replacing the dead NAICS-to-multiple chain with a curated CPA-firm multiple table (Mostad & Christensen / Accounting Today benchmarks). This is a separate deliverable (not in questions.ts) but the question set should drive it: the advisory/CAS mix, realization rate, and recurring revenue answers should be inputs to the multiple-selection logic. Worth designing the table alongside the questions before the engine is built.
