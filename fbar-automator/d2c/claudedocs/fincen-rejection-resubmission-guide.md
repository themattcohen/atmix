# FinCEN FBAR Rejection & Resubmission Guide

> Research compiled 2026-03-31. Covers XML batch e-filing via SDTM.

## Key Principle: A Rejected Filing Never Existed

FinCEN's BSA E-Filing system treats a rejected submission as if it **never happened**. No BSA Identifier is assigned, the report does not appear in FinCEN's database, and the filer's obligation remains unsatisfied.

> "Rejection of a batch file does not relieve the filer of the responsibility to file within the required timeframes established by the BSA regulations."
> — FFIEC BSA/AML Examination Manual, Appendix T

A resubmission after rejection is an **initial filing**, not an amendment.

---

## Rejected vs. Accepted-With-Warnings

| Factor | Rejected (XML/Validation Failure) | Accepted With Warnings |
|--------|-----------------------------------|------------------------|
| BSA Identifier assigned | No | Yes |
| Legally counts as "filed" | No | Yes |
| Resubmission type | **Initial filing** | **Amended filing** |
| Prior BSA ID required | No (none exists) | Yes (must reference it) |
| Amendment checkbox | Do NOT check | Must check |
| Filing deadline satisfied | No — clock still running | Yes |

**The bright line:** assignment of a BSA Identifier. If FinCEN issued one, corrections are amendments referencing that ID. If not, the resubmission is a fresh initial filing.

---

## Resubmission Process

### Step 1 — Receive Rejection Notification

FinCEN sends a rejection via the SDTM acknowledgement channel. The `.MESSAGES.XML` file in the `/acks` directory contains error details. Our polling cron (`/api/cron/poll-submitted`) parses this and stores the `rejectionReason`.

### Step 2 — Identify Error Type

| Error Level | Description | Action |
|-------------|-------------|--------|
| **Fatal (F26, etc.)** | XML schema violation, missing required elements | Must fix. No override option. |
| **Secondary (F24, etc.)** | Data warnings, formatting issues | Fix recommended. Override available (but not for Fatal). |

### Step 3 — Fix the XML

Correct the schema issues in `d2c/src/lib/fincen-xml.ts`. Common rejection causes we've encountered:

| Issue | Root Cause | Fix | Commit |
|-------|-----------|-----|--------|
| Wrong `PartyCount` | Counted activity-level parties, not just type 41 | Count type 41 (FI) parties only | d87e5ea |
| Missing `CorrectsAmendsPriorReportIndicator` | Conditionally omitted for originals | Always emit; use empty string for originals | d87e5ea |
| Account numbers with spaces/dashes | IBANs had internal formatting | `sanitizeAccountNumber()` strips `[\s\-]` | d87e5ea |
| Missing Party type 43 | Signature authority accounts lacked No-FI Owner party | Emit type 43 alongside type 41 for sig auth accounts | b440a1f |
| Wrong `NoFIOwnerCount` | Hardcoded to "0" | Dynamically count sig auth accounts | b440a1f |
| ZIP codes with hyphens | "12345-6789" format rejected | Strip `[-\s]` from ZIP codes | b440a1f |
| C52 warn: `SignatureAuthoritiesQuantityText` < 25 | Field emitted for any sig auth count | Only emit when sigAuthCount >= 25 | (pending) |

### Step 4 — Resubmit as Initial Filing

- **Do NOT mark as amended** — no BSA ID exists to reference
- **Do NOT populate `EFilingPriorDocumentNumber`**
- **Update signature date** to the actual resubmission date (system enforces this)
- Submit via SFTP as a new batch

### Step 5 — Await New Acknowledgement

Poll the SDTM `/acks` directory for the new batch. A successful acceptance assigns a new BSA Identifier.

---

## Signature Requirements on Resubmission

### The user must re-sign

The signature date in the XML (`ApprovalOfficialSignatureDateText`) must be the **current date**. FinCEN's system rejects stale signature dates.

Our resubmit flow (`/api/filing/resubmit/route.ts`) handles this correctly:

1. Archives rejection history to `rejectionHistory` JSONB array
2. Clears `signatureData`, `signedAt`, `form114aUrl`
3. Resets filing status to `IN_PROGRESS`
4. User re-enters the review → sign → submit flow
5. New Form 114a PDF is generated with current timestamp and IP

### No compliance risk

- Same substantive data = same attestation under penalty of perjury
- XML structure fix ≠ change in disclosure content
- Re-signing simply refreshes the date to match the actual submission event
- The original rejected signature carried no legal weight (filing never existed)

---

## Our Filing Status Lifecycle

```
IN_PROGRESS → PAID → SUBMITTING → SUBMITTED
                                      ↓
                              ┌───────┴───────┐
                              ↓               ↓
                          ACCEPTED        REJECTED
                          (bsaId set)     (rejectionReason set)
                                              ↓
                                    [User clicks "Resubmit"]
                                              ↓
                                    IN_PROGRESS (history archived)
                                              ↓
                                    (re-enter sign → submit flow)
```

---

## Rejection History Audit Trail

When a filing is resubmitted, the previous rejection data is archived:

```json
{
  "rejectionHistory": [
    {
      "reason": "F26: PartyCount mismatch...",
      "submittedAt": "2026-03-28T...",
      "acknowledgedAt": "2026-03-29T...",
      "sdtmSubmissionId": "...",
      "sdtmBatchId": "...",
      "bsaId": null,
      "archivedAt": "2026-03-31T..."
    }
  ]
}
```

This preserves the full audit trail of submission attempts.

---

## Timing Considerations

- **30-day correction window** is the standard expectation after a rejection notice
- If the original submission was before the filing deadline and resubmission is also before the deadline, there is no late-filing issue
- If rejection pushes resubmission past the deadline, the original attempt timestamp may be cited in the filer's favor, but FinCEN considers the obligation unsatisfied until acceptance
- **FBAR deadline**: April 15 (auto-extended to October 15)

---

## XML Validation Checklist (Pre-Submission)

Our `validateFincenXml()` function checks:

- [ ] Root `EFilingBatchXML` element exists with correct counts
- [ ] `ActivityCount`, `PartyCount`, `AccountCount`, `NoFIOwnerCount` match actual data
- [ ] `FormTypeCode` = `"FBARX"`
- [ ] Filer Party (type 15) present
- [ ] Transmitter Party (type 35) present with TCC
- [ ] All `SeqNum` attributes are unique (monotonically increasing from 1)
- [ ] All dates in `YYYYMMDD` format
- [ ] Account amounts are non-negative integers
- [ ] No `UnknownMaximumValueIndicator` paired with a dollar amount
- [ ] No conflicting signature indicators (`PreparerFilingSignatureIndicator` vs `ThirdPartyPreparerIndicator`)
- [ ] Party type 43 emitted for every signature authority account
- [ ] `CorrectsAmendsPriorReportIndicator` always present (empty string for originals)

---

## Sources

- [FFIEC BSA/AML Examination Manual, Appendix T](https://bsaaml.ffiec.gov/manual/Appendices/21)
- [FinCEN FBAR XML Schema 2.0 User Guide](https://bsaefiling.fincen.gov/docs/XMLUserGuide_FinCENFBAR.pdf)
- [BSA Electronic Filing Requirements for FBAR](https://bsaefiling.fincen.gov/docs/FinCENFBARElectronicFilingRequirements.pdf)
- [FinCEN FBAR Line Item Filing Instructions](https://www.fincen.gov/sites/default/files/shared/FBAR%20Line%20Item%20Filing%20Instructions.pdf)
- [Drake Tax – FinCEN 114 FAQ](https://kb.drakesoftware.com/kb/Drake-Tax/14648.htm)
- BSA E-Filing Help Desk: 1-866-346-9478 / BSAEFilingHelp@fincen.gov (Mon–Fri, 8am–6pm EST)
