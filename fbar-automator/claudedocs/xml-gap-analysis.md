# FinCEN FBAR XML — Gap Analysis

## Resolution (2026-02-19)

**All 24 issues identified below have been fixed.** The `generateFincenXml()` function was rewritten to match `EFL_FBARXBatchSchema.xsd` v1.2. 107 tests pass (59 unit + 47 integration + 1 sample output). See commit `feat(b2b): rewrite FinCEN FBAR XML to match EFL_FBARXBatchSchema.xsd v1.2`.

---

## Post-Rewrite Bugs Found (2026-02-20)

**3 additional bugs** discovered during sandbox test batch generation. These survived the rewrite and exist in the current B2B code at `src/lib/export/fincen-xml.ts` (662 lines post-rewrite). They would cause **batch rejection by FinCEN**.

See full details: [`claudedocs/bsa-efiling-setup-2026-02-20.md`](bsa-efiling-setup-2026-02-20.md) §2 and §6.

### Bug 25: `RawPartyLegalName` — element does not exist in schema

- **Lines**: 223, 379, 437
- **Problem**: Uses `RawPartyLegalName` for entity names
- **Fix**: Change to `RawPartyFullName` — the only valid entity name element in both XSD schemas
- **Status**: NOT YET FIXED in B2B code. Fixed in test generator script.

### Bug 26: `EFilingPriorDocumentNumber` empty string — invalid for `xsd:long`

- **Line**: 192
- **Problem**: Emits `<fc2:EFilingPriorDocumentNumber></fc2:EFilingPriorDocumentNumber>` — empty string is not a valid `xsd:long`
- **Fix**: Omit the element entirely for non-amendments (`minOccurs="0"`)
- **Status**: NOT YET FIXED in B2B code. Omitted in test generator script.

### Bug 27: Transmitter Contact (type 37) name element order wrong

- **Lines**: 266-267
- **Problem**: Outputs FirstName before LastName
- **Fix**: XSD sequence requires `RawEntityIndividualLastName` before `RawIndividualFirstName`
- **Status**: NOT YET FIXED in B2B code. Fixed in test generator script.

---

**Current implementation:** `src/lib/export/fincen-xml.ts` (474 lines)
**Official schema:** `EFL_FBARXBatchSchema.xsd` v1.2 (7/31/2018)
**Official user guide:** `XMLUserGuide_FinCENFBAR.pdf` v1.4 (August 2021)

**~~Verdict: Our XML will be REJECTED by FinCEN.~~ RESOLVED — XML now validates against the official XSD.**

---

## CRITICAL — Structural Issues (Batch Rejection)

### 1. Account is nested inside Party — WRONG

**Our code (line 278):**
```
Activity → Party → Account  (Account nested inside Party)
```

**Correct structure per XSD/User Guide:**
```
Activity → Party (3-5 activity-level parties)
         → Account (0-9999, SIBLING of Party)
              → Party (nested inside Account — financial institution + owners)
```

Account must be a direct child of Activity, NOT nested inside a Party element. Each Account then contains its OWN Party sub-elements for the financial institution (type 41) and any joint/no-FI/consolidated owners (types 42/43/44).

**Impact:** Entire XML rejected. This is the #1 structural fix.

### 2. Wrong filer Party type code: 35 → should be 15

**Our code (line 176):** `ActivityPartyTypeCode: "35"` for the filer
**Correct:** `35` = Transmitter (the batch file handler), `15` = Foreign Account Filer

The filer is the person with foreign accounts. Our code assigns them code 35 (Transmitter), which is a completely different role. The batch requires BOTH a Transmitter (35) AND a Foreign Account Filer (15) as separate Party elements.

### 3. Missing required Activity-level Parties (minimum 3)

**Our code:** Only outputs 1 filer party + account "parties"
**Required (per User Guide p.10-11):** Minimum 3 Party elements at Activity level:

| Party Type | Code | Required | What we have |
|------------|------|----------|-------------|
| Transmitter | 35 | YES (exactly 1) | MISSING — we use 35 for filer, which is wrong |
| Transmitter Contact | 37 | YES (exactly 1) | MISSING entirely |
| Foreign Account Filer | 15 | YES (exactly 1) | MISSING — we incorrectly use 35 |
| Third Party Preparer | 57 | Conditional | MISSING (B2B is a preparer app!) |
| Third Party Preparer Firm | 56 | Conditional | MISSING |

Since this IS a B2B preparer app, we almost certainly need Party types 57 and 56 too (ThirdPartyPreparerIndicator = "Y").

### 4. Missing required `FormTypeCode` element

**Our code:** Not present
**Required:** `<fc2:FormTypeCode>FBARX</fc2:FormTypeCode>` as first child of `EFilingBatchXML`

Without this, the batch is rejected immediately.

### 5. Missing required `ForeignAccountActivity` element

**Our code:** Not present
**Required:** One `ForeignAccountActivity` per Activity, containing:
- `ReportCalendarYearText` (REQUIRED — the filing calendar year, e.g., "2024")
- `ForeignAccountHeldQuantityText` (conditional — if 25+ accounts)
- `SignatureAuthoritiesQuantityText` (conditional — if 25+ sig authority accounts)
- `LateFilingReasonCode` (conditional — if filing late)

Without `ReportCalendarYearText`, the batch is rejected.

### 6. Missing `fc2:` namespace prefix on ALL elements

**Our code:** Elements output as `<EFilingBatchXML>`, `<Activity>`, etc.
**Required (User Guide p.5):** ALL elements must use prefix `fc2`: `<fc2:EFilingBatchXML>`, `<fc2:Activity>`, etc.

The User Guide explicitly states: "Elements must include the prefix 'fc2'." Without this, the batch fails schema validation.

### 7. Wrong root element attributes

**Our code (lines 317-325):**
```ts
"@_xmlns": "www.fincen.gov/base",
"@_xmlns:fc2": "www.fincen.gov/base",
"@_SeqNum": "1",
"@_StatusCode": "A",      // WRONG — not in submission schema
"@_TotalAmount": "0",     // WRONG — not in submission schema
"@_PartyCount": "...",
"@_ActivityCount": "1",
"@_AccountCount": "...",
```

**Required (User Guide p.5-6):**
```
ActivityCount        — total Activity elements (we have this)
PartyCount           — count of Party type 41 (financial institutions), NOT total parties
AccountCount         — total Account elements (we have this)
JointlyOwnedOwnerCount   — count of Party type 42 (MISSING)
NoFIOwnerCount           — count of Party type 43 (MISSING)
ConsolidatedOwnerCount   — count of Party type 44 (MISSING)
xsi:schemaLocation       — must be "www.fincen.gov/base/EFL_FBARXBatchSchema.xsd" (MISSING)
xmlns:xsi                — must be "http://www.w3.org/2001/XMLSchema-instance" (MISSING)
xmlns:fc2                — must be "www.fincen.gov/base" (we have this)
```

`StatusCode` and `TotalAmount` are only in the ACKNOWLEDGEMENT schema (response from FinCEN), not the submission schema. `SeqNum` is also not a root attribute — it's on child elements.

**PartyCount definition is WRONG:** We count total parties (filer + accounts). FinCEN counts ONLY Party type 41 (Financial Institution Where Account is Held).

---

## HIGH — Value/Code Issues (Rejection or Warning)

### 8. `AccountTypeCode` "3" for OTHER — should be "999"

**Our code (line 27):** `OTHER: "3"`
**Correct:** `OTHER: "999"` (Bank=1, Securities=2, Other=999)

### 9. `EFilingAccountTypeCode` wrong values entirely

**Our code (line 239):** Uses `ACCOUNT_TYPE_CODE` mapping (1/2/3) for `EFilingAccountTypeCode`
**Correct:** EFilingAccountTypeCode is a DIFFERENT code set:
- `141` = Separately Owned Financial Account
- `142` = Jointly Owned Financial Account
- `143` = No Financial Interest Account
- `144` = Consolidated Report Account

Our code maps BANK→1, SECURITIES→2, OTHER→3 — these are the `AccountTypeCode` values, not `EFilingAccountTypeCode` values. We need to determine the account classification (Part II/III/IV/V) based on ownership, not account type.

### 10. `FOREIGN_TIN` type code "14" — should be "9"

**Our code (line 35):** `FOREIGN_TIN: "14"`
**Correct:** `9` = Foreign TIN for all party types. Code "14" doesn't exist in the FBAR schema.

Valid codes per party type:
- Activity-level filer (15): 1 (SSN/ITIN), 2 (EIN), 6 (Passport), 9 (Foreign TIN), 999 (Other)
- Transmitter (35): 4 (TIN), 28 (TCC)
- Third Party Preparer (57): 1 (SSN/ITIN), 9 (Foreign TIN), 31 (PTIN)
- Account owners (42/43/44): 1 (SSN/ITIN), 2 (EIN), 9 (Foreign TIN), -2 (Unknown)

### 11. `RawIndividualLastName` — should be `RawEntityIndividualLastName`

**Our code (line 190):** `RawIndividualLastName`
**Correct:** `RawEntityIndividualLastName` — this is the element name for both entity names AND individual last names.

### 12. `PartyAccountAssociation` does NOT exist in FBAR schema

**Our code (lines 247-260):** Builds `PartyAccountAssociation` with codes 8/9
**Reality:** This element is from the CTR (Currency Transaction Report) schema, NOT the FBAR schema. The FBAR schema has no `PartyAccountAssociation` element at all.

Account ownership is expressed through:
- `EFilingAccountTypeCode` (141=separately owned, 142=jointly owned, etc.)
- Party type codes inside Account (42=joint owner, 43=no-FI owner, 44=consolidated owner)

### 13. `AccountNumberText` in wrong location

**Our code (line 254):** Inside `PartyAccountAssociation` (which doesn't exist)
**Correct:** `AccountNumberText` is a direct child of `Account`, at the same level as `AccountMaximumValueAmountText`

### 14. `FilingDateText` doesn't exist in FBAR schema

**Our code (line 298):** `FilingDateText: today`
**Correct:** This element is not in the FBAR ActivityType restriction. Remove it.

### 15. `CorrectsAmendsPriorReportIndicator` wrong null handling

**Our code (line 301):** Sets to `"N"` when not amended
**Correct:** Set to `"Y"` for amendments, or leave the element with an empty/null value for original filings. The value must be "Y" or null — "N" may cause issues.

### 16. Missing `SignatureAuthoritiesIndicator` on filer

**Our code:** Not present on filer Party
**Required:** Must be "Y" or "N" on the Foreign Account Filer (15) Party element

### 17. Missing `PreparerFilingSignatureIndicator` / `ThirdPartyPreparerIndicator`

**Our code:** Not present
**Required:** Exactly one of these must be "Y" on the Activity element:
- `PreparerFilingSignatureIndicator` = "Y" if the filer prepared their own filing
- `ThirdPartyPreparerIndicator` = "Y" if a third party prepared it (B2B = this one)

---

## MEDIUM — Missing Data / Features

### 18. Transmitter requires TCC (Transmitter Control Code)

The Transmitter party (35) must have TWO PartyIdentification elements:
1. TIN (type code 4)
2. TCC (type code 28) — format: starts with "P", 8 chars total (e.g., "PTCC1234")

**We don't have a TCC.** This is obtained from FinCEN when registering as an electronic filer. The user (matt@atmix.org) needs to apply for a TCC via the BSA E-Filing system.

### 19. Transmitter party needs: name, address, phone, TIN+TCC

We have NO transmitter data model. Need to add:
- Practice/firm name (RawPartyFullName)
- Practice address
- Practice phone number
- Practice TIN (EIN likely)
- TCC

### 20. Transmitter Contact party needs: name only

Simple Party with just `RawPartyFullName` — the official contact person for the transmitter.

### 21. Third Party Preparer (57) needs: name, address, phone, TIN

Since B2B is a preparer app, every filing needs:
- Preparer's individual name (first/last)
- Preparer's address
- Preparer's phone
- Preparer's TIN (SSN/ITIN, PTIN, or Foreign TIN)
- `SelfEmployedIndicator` if applicable

### 22. Third Party Preparer Firm (56) needs: name, TIN

If preparer is not self-employed:
- Firm name (RawPartyFullName)
- Firm TIN (EIN or Foreign)

### 23. Account-level Party for Financial Institution (type 41)

Each Account needs a nested Party with:
- `ActivityPartyTypeCode`: "41"
- `PartyName` → `RawPartyFullName` (institution name)
- `Address` → city, country, street, zip (and state for CA/MX)

We have this data in `foreignAccount.institutionName`, `institutionAddressCity`, etc. — it just needs to be restructured from an Activity-level party to an Account-level party.

### 24. SeqNum counter starts at 2 instead of 1

**Our code (line 109):** `SeqNumCounter` starts at 1 and increments BEFORE returning, so the first SeqNum issued is 2.
**Required:** SeqNum should start at 1 (for the Activity element) and increment by 1. The first Activity `SeqNum` should be "1".

---

## Correct XML Structure (Reference)

Based on the XSD and User Guide, here's what a correct single-filing batch looks like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<fc2:EFilingBatchXML
  ActivityCount="1"
  PartyCount="1"
  AccountCount="2"
  JointlyOwnedOwnerCount="0"
  NoFIOwnerCount="0"
  ConsolidatedOwnerCount="0"
  xsi:schemaLocation="www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:fc2="www.fincen.gov/base">

  <fc2:FormTypeCode>FBARX</fc2:FormTypeCode>

  <fc2:Activity SeqNum="1">
    <fc2:ApprovalOfficialSignatureDateText>20260218</fc2:ApprovalOfficialSignatureDateText>
    <fc2:ThirdPartyPreparerIndicator>Y</fc2:ThirdPartyPreparerIndicator>

    <fc2:ActivityAssociation SeqNum="2">
      <fc2:CorrectsAmendsPriorReportIndicator/>
    </fc2:ActivityAssociation>

    <!-- Party 1: Transmitter (35) -->
    <fc2:Party SeqNum="3">
      <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>
      <fc2:PartyName SeqNum="4">
        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
        <fc2:RawPartyFullName>ATMIX LLC</fc2:RawPartyFullName>
      </fc2:PartyName>
      <fc2:Address SeqNum="5">
        <fc2:RawCityText>...</fc2:RawCityText>
        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>
        <fc2:RawStateCodeText>...</fc2:RawStateCodeText>
        <fc2:RawStreetAddress1Text>...</fc2:RawStreetAddress1Text>
        <fc2:RawZIPCode>...</fc2:RawZIPCode>
      </fc2:Address>
      <fc2:PhoneNumber SeqNum="6">
        <fc2:PhoneNumberText>...</fc2:PhoneNumberText>
      </fc2:PhoneNumber>
      <fc2:PartyIdentification SeqNum="7">
        <fc2:PartyIdentificationNumberText>EINHERE</fc2:PartyIdentificationNumberText>
        <fc2:PartyIdentificationTypeCode>4</fc2:PartyIdentificationTypeCode>
      </fc2:PartyIdentification>
      <fc2:PartyIdentification SeqNum="8">
        <fc2:PartyIdentificationNumberText>PTCC1234</fc2:PartyIdentificationNumberText>
        <fc2:PartyIdentificationTypeCode>28</fc2:PartyIdentificationTypeCode>
      </fc2:PartyIdentification>
    </fc2:Party>

    <!-- Party 2: Transmitter Contact (37) -->
    <fc2:Party SeqNum="9">
      <fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>
      <fc2:PartyName SeqNum="10">
        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
        <fc2:RawPartyFullName>Matt (Contact Name)</fc2:RawPartyFullName>
      </fc2:PartyName>
    </fc2:Party>

    <!-- Party 3: Foreign Account Filer (15) -->
    <fc2:Party SeqNum="11">
      <fc2:ActivityPartyTypeCode>15</fc2:ActivityPartyTypeCode>
      <fc2:FilerFinancialInterest25ForeignAccountIndicator>N</fc2:FilerFinancialInterest25ForeignAccountIndicator>
      <fc2:FilerTypeIndividualIndicator>Y</fc2:FilerTypeIndividualIndicator>
      <fc2:IndividualBirthDateText>19850101</fc2:IndividualBirthDateText>
      <fc2:SignatureAuthoritiesIndicator>N</fc2:SignatureAuthoritiesIndicator>
      <fc2:PartyName SeqNum="12">
        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
        <fc2:RawEntityIndividualLastName>Smith</fc2:RawEntityIndividualLastName>
        <fc2:RawIndividualFirstName>John</fc2:RawIndividualFirstName>
      </fc2:PartyName>
      <fc2:Address SeqNum="13">
        <fc2:RawCityText>New York</fc2:RawCityText>
        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>
        <fc2:RawStateCodeText>NY</fc2:RawStateCodeText>
        <fc2:RawStreetAddress1Text>123 Main St</fc2:RawStreetAddress1Text>
        <fc2:RawZIPCode>10001</fc2:RawZIPCode>
      </fc2:Address>
      <fc2:PartyIdentification SeqNum="14">
        <fc2:PartyIdentificationNumberText>123456789</fc2:PartyIdentificationNumberText>
        <fc2:PartyIdentificationTypeCode>1</fc2:PartyIdentificationTypeCode>
      </fc2:PartyIdentification>
    </fc2:Party>

    <!-- Party 4: Third Party Preparer (57) — because B2B -->
    <fc2:Party SeqNum="15">
      <fc2:ActivityPartyTypeCode>57</fc2:ActivityPartyTypeCode>
      <fc2:PartyName SeqNum="16">
        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
        <fc2:RawEntityIndividualLastName>Preparer</fc2:RawEntityIndividualLastName>
        <fc2:RawIndividualFirstName>Jane</fc2:RawIndividualFirstName>
      </fc2:PartyName>
      <fc2:Address SeqNum="17">
        <fc2:RawCityText>...</fc2:RawCityText>
        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>
        <fc2:RawStateCodeText>...</fc2:RawStateCodeText>
        <fc2:RawStreetAddress1Text>...</fc2:RawStreetAddress1Text>
        <fc2:RawZIPCode>...</fc2:RawZIPCode>
      </fc2:Address>
      <fc2:PhoneNumber SeqNum="18">
        <fc2:PhoneNumberText>...</fc2:PhoneNumberText>
      </fc2:PhoneNumber>
      <fc2:PartyIdentification SeqNum="19">
        <fc2:PartyIdentificationNumberText>P12345678</fc2:PartyIdentificationNumberText>
        <fc2:PartyIdentificationTypeCode>31</fc2:PartyIdentificationTypeCode>
      </fc2:PartyIdentification>
    </fc2:Party>

    <!-- Party 5: Third Party Preparer Firm (56) — if not self-employed -->
    <fc2:Party SeqNum="20">
      <fc2:ActivityPartyTypeCode>56</fc2:ActivityPartyTypeCode>
      <fc2:PartyName SeqNum="21">
        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
        <fc2:RawPartyFullName>ATMIX LLC</fc2:RawPartyFullName>
      </fc2:PartyName>
      <fc2:PartyIdentification SeqNum="22">
        <fc2:PartyIdentificationNumberText>987654321</fc2:PartyIdentificationNumberText>
        <fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>
      </fc2:PartyIdentification>
    </fc2:Party>

    <!-- Account 1: Separately Owned -->
    <fc2:Account SeqNum="23">
      <fc2:AccountMaximumValueAmountText>25000</fc2:AccountMaximumValueAmountText>
      <fc2:AccountNumberText>123456789</fc2:AccountNumberText>
      <fc2:AccountTypeCode>1</fc2:AccountTypeCode>
      <fc2:EFilingAccountTypeCode>141</fc2:EFilingAccountTypeCode>
      <!-- Financial Institution (type 41) nested inside Account -->
      <fc2:Party SeqNum="24">
        <fc2:ActivityPartyTypeCode>41</fc2:ActivityPartyTypeCode>
        <fc2:PartyName SeqNum="25">
          <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>
          <fc2:RawPartyFullName>Swiss National Bank</fc2:RawPartyFullName>
        </fc2:PartyName>
        <fc2:Address SeqNum="26">
          <fc2:RawCityText>Zurich</fc2:RawCityText>
          <fc2:RawCountryCodeText>CH</fc2:RawCountryCodeText>
          <fc2:RawStreetAddress1Text>Bundesplatz 1</fc2:RawStreetAddress1Text>
          <fc2:RawZIPCode>3003</fc2:RawZIPCode>
        </fc2:Address>
      </fc2:Party>
    </fc2:Account>

    <!-- ForeignAccountActivity (REQUIRED) -->
    <fc2:ForeignAccountActivity SeqNum="27">
      <fc2:ReportCalendarYearText>2024</fc2:ReportCalendarYearText>
    </fc2:ForeignAccountActivity>

  </fc2:Activity>
</fc2:EFilingBatchXML>
```

---

## Blockers Before Rewrite

1. **TCC (Transmitter Control Code):** Must be obtained from FinCEN. Apply at BSA E-Filing System → "Apply for TCC". Without this, we cannot submit batches.

2. **Transmitter/Practice data model:** We need to store firm name, address, phone, EIN, TCC, and preparer info. Currently the Practice model has `name` but not the rest.

3. **Preparer data model:** Need individual preparer name, address, phone, PTIN/TIN. Currently the User model has `name` and `email` but not address, phone, or PTIN.

4. **EFilingAccountTypeCode determination:** Need to map from our ownership model to 141/142/143/144. Current `OwnershipType` enum (FINANCIAL_INTEREST, SIGNATURE_AUTHORITY, BOTH) maps roughly:
   - FINANCIAL_INTEREST (sole owner) → 141 (Separately Owned)
   - FINANCIAL_INTEREST (joint) → 142 (Jointly Owned)
   - SIGNATURE_AUTHORITY → 143 (No Financial Interest)
   - We don't have a "Consolidated Report" concept → 144

5. **Joint account owners data:** For jointly owned accounts (142), we need Party elements for each co-owner with their name, address, and TIN. Our data model doesn't capture co-owner information.

---

## Implementation Priority

| Priority | Issue | Effort | Risk |
|----------|-------|--------|------|
| P0 | Restructure Account as Activity sibling (#1) | Large | Batch rejected |
| P0 | Add Transmitter party (#3, #18, #19) | Medium | Batch rejected |
| P0 | Add Transmitter Contact party (#3, #20) | Small | Batch rejected |
| P0 | Fix filer to type 15 (#2) | Small | Batch rejected |
| P0 | Add FormTypeCode (#4) | Trivial | Batch rejected |
| P0 | Add ForeignAccountActivity (#5) | Small | Batch rejected |
| P0 | Add fc2: namespace prefix (#6) | Medium | Batch rejected |
| P0 | Fix root attributes (#7) | Small | Batch rejected |
| P0 | Add Third Party Preparer/Firm (#21, #22) | Medium | Batch rejected |
| P1 | Fix AccountTypeCode OTHER→999 (#8) | Trivial | Rejection |
| P1 | Fix EFilingAccountTypeCode (#9) | Medium | Rejection |
| P1 | Fix FOREIGN_TIN code 14→9 (#10) | Trivial | Rejection |
| P1 | Fix element name RawEntityIndividualLastName (#11) | Trivial | Rejection |
| P1 | Remove PartyAccountAssociation (#12) | Small | Rejection |
| P1 | Move AccountNumberText to Account (#13) | Small | Rejection |
| P1 | Remove FilingDateText (#14) | Trivial | Rejection |
| P1 | Fix CorrectsAmendsPriorReportIndicator (#15) | Trivial | Warning |
| P1 | Add SignatureAuthoritiesIndicator (#16) | Small | Rejection |
| P1 | Add PreparerFilingSignatureIndicator (#17) | Small | Rejection |
| P2 | Fix SeqNum start (#24) | Trivial | Possible rejection |
| P2 | DB schema for practice/preparer data | Medium | Blocking P0 items |

---

## Summary

**17 issues cause batch rejection.** The XML structure is fundamentally incompatible with the FinCEN FBAR batch schema. Key problems:

1. Accounts nested inside Party (should be siblings at Activity level)
2. Only 1 Party (should be 3-5 at Activity level, plus Parties inside each Account)
3. Wrong party type codes, wrong account type codes, wrong TIN type codes
4. Missing FormTypeCode, ForeignAccountActivity, namespace prefixes
5. Non-existent elements (PartyAccountAssociation, FilingDateText)
6. Missing required data: TCC, transmitter info, preparer info

**Estimated rewrite effort:** The `generateFincenXml` function needs to be rewritten from scratch. The `validateFincenXml` function's checks are also wrong and need updating. Additionally, the database schema needs new fields for practice/preparer information before the XML can be fully correct.
