# Fix FBAR FinCEN Rejection

You are fixing a rejected FBAR filing. FinCEN rejected the XML submission due to schema or data errors. Your job: diagnose, fix the code, validate against sandbox, deploy, and resubmit. Do NOT ask the user questions — work autonomously.

## Input

`$ARGUMENTS` is either:
- A filing ID (looks like a cuid: `cm...`) — fetch rejection details from the production database
- Pasted rejection error text — use it directly

## Phase 1: Research

### If filing ID provided:
Fetch rejection details from production DB:
```bash
ssh -i ~/.ssh/hetzner_claude root@178.156.250.116 'cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec -T d2c-app node -e "
const { PrismaClient } = require(\"@prisma/client\");
const p = new PrismaClient();
p.filingYear.findUnique({
  where: { id: \"FILING_ID_HERE\" },
  select: { id: true, status: true, rejectionReason: true, calendarYear: true, sdtmBatchId: true, rejectionHistory: true, userId: true }
}).then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"'
```
Replace `FILING_ID_HERE` with the filing ID from $ARGUMENTS.

### Read these files (ALWAYS):
1. `fbar-automator/d2c/src/lib/fincen-xml.ts` — the XML generator (both `generateFincenXml` and `validateFincenXml`). This is almost always where the fix goes.
2. `fbar-automator/d2c/schemas/fincen/EFL_FBARXBatchSchema.xsd` — the FinCEN XSD schema. Cross-reference errors against this.
3. `fbar-automator/d2c/claudedocs/fincen-rejection-resubmission-guide.md` — knowledge base of past rejections and fixes.
4. `fbar-automator/d2c/tests/api/fincen-xml.test.ts` — understand existing test coverage.

### Diagnose:
For each error in the rejection reason:
- Identify the XML element or attribute that's wrong
- Find the corresponding code in `fincen-xml.ts` that generates it
- Cross-reference with the XSD schema to understand what FinCEN expects
- Classify: **code bug** (XML generation is wrong) vs **data error** (user entered bad data)

If ALL errors are data errors (not code bugs): STOP. Report to the user that this is a data issue requiring the user to fix their information, not a code fix. Do not proceed with the loop.

## Phase 2: Local Fix + Validate Loop

### Step 1: Fix the code
- Edit `fbar-automator/d2c/src/lib/fincen-xml.ts` to fix the root cause of each error
- Update `validateFincenXml()` in the same file to catch this class of error in the future (add a new validation check)
- If fixing multiple errors, fix ALL of them before running tests

### Step 2: Run tests + XSD validation
```bash
cd fbar-automator/d2c && npx vitest run tests/api/fincen-xml.test.ts
```
- If tests FAIL: read the error output, fix the code, run tests again
- If tests PASS: proceed to sandbox test

### Step 3: Submit to FinCEN sandbox
```bash
cd fbar-automator/d2c && SDTM_SANDBOX_HOST=bsaefiling-direct-transfer-sandbox.fincen.gov npx vitest run tests/api/sandbox-submit.test.ts --reporter=verbose
```
- This generates XML from test data and submits to the real FinCEN sandbox via SFTP
- It polls for acknowledgement every 30 seconds (up to 15 minutes)
- Read the test output carefully

### Step 4: Evaluate sandbox result
- **ACCEPTED**: The fix is validated. Exit the loop, proceed to Phase 3.
- **REJECTED**: Read the NEW rejection reason from the test output. Go back to Step 1 with the new errors. You may need multiple iterations.
- **TIMEOUT (15 min with no ack)**: Warn the user that sandbox didn't respond. Ask if they want to proceed with deployment anyway or wait.

## Phase 3: Production Deploy + Resubmit

Only reach this phase after sandbox ACCEPTS.

### Step 1: Update rejection guide
Add a new entry to `fbar-automator/d2c/claudedocs/fincen-rejection-resubmission-guide.md` documenting:
- The rejection errors
- Root cause
- Code fix applied
- Date

### Step 2: Commit and push
```bash
cd fbar-automator
git add d2c/src/lib/fincen-xml.ts d2c/claudedocs/fincen-rejection-resubmission-guide.md
# Add any other files you modified
git commit -m "fix(fbar-d2c): fix FinCEN rejection — [brief description of what was fixed]"
git push origin main
```

### Step 3: Deploy to production
```bash
ssh -i ~/.ssh/hetzner_claude root@178.156.250.116 "cd /opt/fbar/fbar-automator && git pull origin main && ./scripts/deploy-d2c.sh"
```
This takes 5-8 minutes. Wait for it to complete. Check for "Deploy complete" in output.

If deploy fails: read the error output and report to the user. Do NOT proceed with resubmit.

### Step 4: Resubmit the filing
If you have a filing ID (from $ARGUMENTS or from Phase 1), use the admin resubmit endpoint:
```bash
ssh -i ~/.ssh/hetzner_claude root@178.156.250.116 'cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec -T d2c-app curl -s -X POST http://localhost:3000/api/admin/resubmit -H "Authorization: Bearer $ADMIN_SECRET" -H "Content-Type: application/json" -d "{\"filingYearId\": \"FILING_ID_HERE\"}"'
```
Replace `FILING_ID_HERE` with the actual filing ID. The endpoint archives the rejection, resets to PAID (preserving signature), and calls submitFiling() directly.

If you only have rejection text (no filing ID): tell the user you've fixed and deployed the code, but need the filing ID to trigger resubmission.

### Step 5: Report
Print a summary:
- What errors were found
- What code changes were made
- Test results (vitest + sandbox)
- Deploy status
- Resubmit result
- "The poll-submitted cron will detect FinCEN's acceptance in 1-2 business days. The user will receive a confirmation email automatically."
