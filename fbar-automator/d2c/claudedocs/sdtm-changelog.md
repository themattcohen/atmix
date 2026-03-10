# SDTM Changelog

## 2026-03-10 — Fix `xsi:schemaLocation` URL format

**Problem:** 4 FBAR XML files uploaded to FinCEN SDTM sandbox SFTP never appeared in Track Org Status. FinCEN confirmed filenames were correct (`FBARXST.*`), meaning server-side XML validation was silently rejecting them.

**Root cause:** `xsi:schemaLocation` attribute used bare filename instead of full URL:
```xml
<!-- BEFORE (broken): -->
xsi:schemaLocation="www.fincen.gov/base EFL_FBARXBatchSchema.xsd"

<!-- AFTER (fixed): -->
xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"
```

The `xsi:schemaLocation` value is a namespace-URI pair. The second value must be a resolvable URL. The bare filename gave FinCEN's validator no way to resolve the schema.

**Evidence:**
- FinCEN DOEP XML User Guide example: `xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_DOEPXBatchSchema.xsd"`
- moov-io open-source reference uses full URL format
- XSD `xsi:schemaLocation` spec requires namespace + URL pair

**Files changed:**
- `d2c/src/lib/fincen-xml.ts` line 469 — fixed schemaLocation URL
- `d2c/tests/api/fincen-xml.test.ts` line 460 — updated test expectation
- `d2c/src/lib/sdtm.ts` — added console.log for SFTP upload start/complete/error

**Verification:**
- All 25 fincen-xml tests pass
- Old 4 files left on SFTP (to monitor if they get picked up)
- New test filings to be created and submitted with fixed XML

**B2B note:** `src/lib/export/fincen-xml.ts` line 511 has a similar issue (`"www.fincen.gov/base/EFL_FBARXBatchSchema.xsd"` — single concatenated path instead of namespace+URL pair). Not fixing now since B2B uses web upload, not SDTM. Fix before B2B SDTM integration.
