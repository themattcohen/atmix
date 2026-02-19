# D2C FBAR Filing Compliance Guide

## Background

FBAR Direct (D2C) files FBARs directly to FinCEN on behalf of consumers. The architecture is already built: Form 114a signing, filing status machine, BSA ID tracking. The XML generator is stubbed and SFTP credentials are placeholders.

This document covers all regulatory, legal, and operational requirements that must be satisfied before going live with direct FinCEN filing.

---

## 1. BSA E-Filing Registration

### How to Register

Register as an **Institution** (not Individual) at [bsaefiling.fincen.gov/enroll](https://bsaefiling.fincen.gov/enroll).

The **Supervisory User** is the liaison between BSA E-Filing and the filing organization. The Supervisory User can create General User accounts and track all filing statuses across the organization.

### License Requirements

No CPA, EA, or attorney license is required. FinCEN lists licensed practitioners as examples but any entity holding Form 114a authorization can file as a third party. Expatfile.tax operates as a pure SaaS company with authorized transmitter status — no licensed practitioners on staff.

### Vetting and Approval

There is no vetting or approval process beyond the self-enrollment form. Registration is self-service.

### Registration Process

1. Complete enrollment form at bsaefiling.fincen.gov/enroll
2. Receive confirmation from FinCEN
3. Set up Supervisory User credentials
4. Create General User accounts as needed for staff

---

## 2. SDTM (Secure Data Transfer Mode) / Batch Filing

### What Is SDTM

SDTM is system-to-system secure file transfer (SFTP). FinCEN supports three transfer methods:

- FTP over VPN
- Connect:Direct over VPN
- Connect:Direct with Secure+

### SDTM Setup Process

Contact the FinCEN help desk to initiate SDTM setup:

- Phone: 1-866-346-9478
- Email: BSAEFilingHelp@fincen.gov

Provide your Node Names and IP Addresses. FinCEN will open the necessary firewall rules on their end.

### Alternative: Web Portal Batch Upload

For lower filing volumes, the BSA E-Filing web portal supports batch XML upload without SDTM. This is simpler to set up and likely sufficient for D2C during the initial launch period before SDTM is approved and configured.

### TCC Testing Requirements

Before production filing is allowed, FinCEN requires a test submission:

- Use transmitter code `TBSATEST` in the test system
- Submit 25–50 sample FBARs
- FinCEN validates submissions within approximately 10 business days
- Upon successful validation, FinCEN issues a production TCC (`PBSA8180`)

The production TCC is required in all live FBAR XML submissions. Filing cannot go live without it.

### XML Generator

The B2B app (`fbar-automator/src/`) already contains a working FinCEN XML generator that produces schema-compliant FBAR XML. This generator must be ported to the D2C app before TCC testing can begin.

---

## 3. Form 114a Requirements

### Purpose

Form 114a (Record of Authorization to Electronically File FBARs) is required for every third-party filing. It documents that the filer has explicitly authorized the filing service to submit on their behalf.

### Digital Signatures

A digital signature is valid. No wet (ink) signature is required.

### Retention

Form 114a records must be retained for **5 years from the FBAR due date**. This means records for a calendar year 2024 FBAR (due April 15, 2025) must be kept until April 15, 2030.

### Submission to FinCEN

Form 114a is **not submitted to FinCEN**. It is kept on file by the filing service and produced on request during an IRS or FinCEN audit.

### Current Implementation

Form 114a is already implemented in the D2C app at `d2c/src/lib/form114a.ts`. The signing step in the wizard captures the user's authorization before submission.

---

## 4. Liability and Compliance

### Circular 230

IRS Circular 230 governs the practice of representatives before the IRS and applies to CPAs, EAs, and attorneys filing FBARs in their professional capacity. It does **not** apply to a filing service that is not a licensed practitioner.

### Liability Framework for Non-Practitioner Filing Services

A non-practitioner filing service's liability is governed by three sources:

1. **Terms of Service** — the contractual relationship with the user
2. **E&O Insurance** — coverage for errors and omissions in the filing service
3. **General consumer protection law** — FTC Act Section 5 and state equivalents

### Key Liability Mitigation Principles

- User certifies accuracy of all data provided
- The service transmits data only as provided by the user — it does not independently verify account balances, ownership, or other facts
- Liability is capped at the filing fee paid
- No specific federal penalties exist for filing services submitting incorrect FBARs — penalties fall on the individual filer, not the transmitting service

### E&O Insurance

E&O insurance is recommended and is referenced in the current Terms of Service. Typical coverage for a filing service of this type is $1M–$5M per occurrence. This should be obtained before going live.

---

## 5. Data Security — FTC Safeguards Rule

### Classification as a Financial Institution

FBAR filing services are **"financial institutions"** under the Gramm-Leach-Bliley Act (GLBA) Safeguards Rule. The FTC's definition is broad and explicitly covers tax preparers and financial filing services, not just banks.

### Small Business Exception (fewer than 5,000 consumers)

For filing services with fewer than 5,000 consumers, the minimum required controls are:

- Encryption at rest and in transit
- Multi-factor authentication (MFA)
- Secure disposal of consumer data

### Full Requirements (5,000 or more consumers)

Once the 5,000 consumer threshold is crossed, the following are required:

- Written Information Security Program (ISP)
- Designated Qualified Individual responsible for the ISP
- Formal risk assessment
- Access controls limiting employee data access to need-to-know
- Encryption at rest and in transit
- Multi-factor authentication
- Continuous monitoring or periodic penetration testing
- Vendor management program
- Incident response plan

### Breach Notification

As of May 2024, filing services must notify the FTC within **30 days** of discovering a breach affecting 500 or more consumers.

### Current D2C Status

| Control | Status |
|---------|--------|
| AES-256-GCM encryption at rest | Implemented |
| TLS in transit | Implemented |
| Access controls (userId defense-in-depth) | Implemented |
| MFA | Not implemented — on B2B roadmap |
| Written ISP | Not created |
| Designated Qualified Individual | Not designated |

---

## 6. Consumer Protection

### FTC Act Section 5

The FTC Act prohibits unfair or deceptive acts or practices. All marketing claims must be substantiated:

- The claim **"FinCEN-Registered BSA E-Filing Institution"** on marketing pages must be accurate before it appears publicly. This claim cannot be used until BSA E-Filing registration is complete.
- Filing timelines, success rates, and refund terms must be disclosed accurately

### State-Level Requirements

State consumer protection laws vary but generally require:

- Accuracy in advertising
- Clear refund policy disclosure
- No misleading representations about the nature of the service

### Current Terms of Service

The existing ToS already addresses the key risk areas:

- Filing-service-only disclaimer (not legal or tax advice)
- User bears responsibility for accuracy of submitted data
- Refund policy
- Class action waiver
- Binding arbitration clause

The resubmission language in the ToS should be reviewed by an attorney before go-live to ensure it clearly addresses what happens if FinCEN rejects a filing.

---

## 7. Competitive Landscape

| Competitor | Model | Files to FinCEN? | Entity Type |
|------------|-------|------------------|-------------|
| Expatfile.tax | SaaS, direct FinCEN connection | Yes — "authorized transmitter" | Tech company (not CPA firm) |
| TaxesForExpats (TFX) | Full service | Yes — files on behalf | CPA firm |
| H&R Block Expat | Full service | Yes — files on behalf | CPA firm |
| MyExpatFBAR | Prep-only | No — user submits | Tech company |
| Greenback | Full service | Yes — files on behalf | CPA firm |

**Key insight**: Expatfile.tax proves that a non-CPA SaaS company can register as a FinCEN-authorized transmitter and file directly. The regulatory path is open to a tech company operating as a filing service, with no professional license requirement.

---

## Action Items Checklist

| # | Action Item | Status | Priority | Notes |
|---|-------------|--------|----------|-------|
| 1 | Register as Institution on BSA E-Filing | NOT DONE | **BLOCKING** | bsaefiling.fincen.gov/enroll |
| 2 | Set up Supervisory User account | NOT DONE | **BLOCKING** | Part of registration |
| 3 | Submit batch test (25–50 FBARs) with TCC TBSATEST | NOT DONE | **BLOCKING** | FinCEN validates in ~10 business days |
| 4 | Receive production TCC from FinCEN | NOT DONE | **BLOCKING** | Issued after successful test |
| 5 | Contact FinCEN help desk for SDTM setup (or use web portal) | NOT DONE | High | 1-866-346-9478 / BSAEFilingHelp@fincen.gov |
| 6 | Port FinCEN XML generator from B2B app | NOT DONE | **BLOCKING** | B2B already has working generator |
| 7 | Configure SFTP credentials for production | NOT DONE | **BLOCKING** | After SDTM setup approved |
| 8 | Obtain E&O insurance policy | NOT DONE | High | $1M–$5M typical coverage |
| 9 | Write Information Security Program (ISP) document | NOT DONE | High | Required by FTC Safeguards Rule |
| 10 | Designate Qualified Individual for ISP | NOT DONE | High | Required by FTC Safeguards Rule |
| 11 | Implement MFA for admin/user accounts | NOT DONE | High | Already on B2B roadmap |
| 12 | Verify "FinCEN-Registered" marketing claim is accurate | NOT DONE | **BLOCKING** | Must register before going live |
| 13 | Review ToS with attorney (focus on "resubmission" language) | NOT DONE | Medium | |
| 14 | Set up Stripe production keys | NOT DONE | **BLOCKING** | Currently placeholder keys |
| 15 | Configure Resend email for production | NOT DONE | High | |

---

*Last updated: 2026-02-19*
*This document should be reviewed by legal counsel before FBAR Direct accepts live filings.*
