# FinCEN BSA E-Filing — Admin Call Script

**Purpose**: Call the BSA E-Filing Help Desk to confirm production TCC status and get a complete checklist for filing FBARs on behalf of others.

---

## Who to Call

| | |
|---|---|
| **Phone** | 1-866-346-9478 |
| **Hours** | Monday–Friday, 8am–6pm EST |
| **Email** (if needed) | BSAEFilingHelp@fincen.gov |

---

## Our Company Information (have ready)

| Field | Value |
|---|---|
| Organization | **All Solutions Consulting** |
| EIN | **88-3761328** |
| Production PIN | **48623952** |
| Account email | matt@atmix.org |
| Account holder | Matthew Cohen |

---

## What to Say

> "Hi, I'm calling on behalf of All Solutions Consulting. We registered on the BSA E-Filing production site and completed sandbox testing on February 20th. We're waiting on our production Transmitter Control Code and wanted to check the status and confirm what else we need to do to file FBARs on behalf of clients."

---

## Questions to Ask (in order)

### 1. Production TCC Status

> "We submitted a test batch on the sandbox on February 20th — Tracking ID **T-FBX26-00000047**, acknowledged as **T-FBX26-00000051** with 26 out of 26 activities accepted, zero errors. Can you confirm our production TCC is being processed and when we should expect it?"

**What to write down**: Expected date, any reference/ticket number they give you.

### 2. How the TCC Arrives

> "Will the production TCC be emailed automatically to matt@atmix.org, or do we need to take any action to receive it?"

**What to write down**: Delivery method (email, portal notification, etc.) and where to look for it.

### 3. Complete Filing Requirements Checklist

> "We want to file FBAR batches on behalf of our clients. Can you walk me through everything we need to have in place before we can submit production filings? We want to make sure we're not missing any steps."

**What to write down**: Every item they list. Specifically ask about:
- Whether the production TCC is the only thing we're waiting on
- Any additional agreements or forms to sign
- Whether there are annual renewal or re-certification requirements
- Whether there's a limit on the number of filings per batch or per year

### 4. SDTM (Automated Server Submission)

> "We'd also like to set up SDTM — Secure Data Transfer Mode — for automated submissions from our server. Can we start that process now, or do we need the production TCC first? What information do you need from us?"

**What to write down**: Whether SDTM can be started in parallel, and what they need. We expect they'll ask for:
- Our server's public IP address: **178.156.250.116**
- An SSH public key (we'll generate and send after the call)
- A node name (we'll use **FBARDIRECT-NODE-1**)

Also ask:
- How long does SDTM provisioning take?
- What will they provide back to us? (hostname, username, host fingerprint)

### 5. Manual Upload as Interim

> "While SDTM is being set up, can we upload signed batch XML files directly through the BSA E-Filing web portal for production submissions?"

**What to write down**: Whether this is allowed, and if there are any differences in the process vs. SDTM.

### 6. Preparer Requirements

> "As a third-party preparer filing on behalf of clients, are there any additional registration requirements beyond the TCC? For example, do we need a separate preparer agreement, or is our BSA E-Filing registration sufficient?"

**What to write down**: Any preparer-specific requirements, forms, or obligations.

---

## Our Sandbox Test Results (reference if they ask)

| Detail | Value |
|---|---|
| Sandbox Tracking ID | T-FBX26-00000047 |
| Acknowledgment ID | T-FBX26-00000051 |
| Activities submitted | 26 |
| Accounts | 51 across 19 countries |
| Calendar year | 2025 |
| Result | 26/26 ACCEPTED, 0 errors |
| Date submitted | Feb 20, 2026 ~11:07 AM MST |
| Date acknowledged | Feb 20, 2026 ~1:48 PM MST |
| TCC used in test | TBSATEST |
| Transmitter | All Solutions Consulting, EIN 88-3761328 |

---

## After the Call

Write down and send Matt:
1. Expected TCC delivery date
2. Any ticket/reference number from the call
3. The complete checklist of what's needed (every item they mentioned)
4. SDTM next steps and timeline
5. Whether manual portal upload works as interim
6. Any surprises or things we didn't expect
