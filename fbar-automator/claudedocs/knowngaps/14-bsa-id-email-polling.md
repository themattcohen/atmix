> **⚠️ SUPERSEDED:** This gap's implementation has been merged into [Gap #6](./06-fincen-submission-architecture.md). Gap #6's `/api/cron/poll-submitted` route absorbs this gap's proposed `/api/cron/sdtm-poll` route, and Gap #6's `d2c-cron` Docker service supersedes the Alpine cron container proposed here. **Do not implement this gap separately.** Refer to Gap #6, Steps 4 and 6 for the merged implementation.

# Gap #14: BSA-ID Confirmation Email Requires User to Revisit

**Severity:** Medium (Merged into Gap #6)
**Effort:** L (4-8 hours)
**Depends on:** None

## Problem

After a user pays and their FBAR is submitted to FinCEN, the system enters a `SUBMITTED` state
and waits for FinCEN to return an acknowledgement file via SFTP. FinCEN processing typically
takes 1-2 business days, and can take longer.

The confirmation email (containing the BSA tracking ID) is sent inside `GET /api/sdtm/status`
(line 66), which is triggered only when the user polls that endpoint. If the user never returns
to the confirmation page during the window between submission and FinCEN's response, the email
is never sent — even though the acknowledgement is sitting on the SFTP server.

The same logic applies to rejection emails (line 92). A user who submits and moves on will never
learn their filing was rejected unless they manually revisit their dashboard.

The submission email (sent on payment/submit, `sendSubmissionEmail`) already tells users "we'll
email you when it's ready," which creates an unfulfilled promise if they don't revisit.

## Current State

**`d2c/src/app/api/sdtm/status/route.ts`**

- Lines 7-115: Single `GET` handler, authenticated, requires `filingYearId` query param.
- Lines 28-38: Returns immediately if status is already `ACCEPTED` or `REJECTED` (no email re-send).
- Lines 44-45: Calls `checkAcknowledgement(filingYear.sdtmBatchId)` on every poll — makes a live
  SFTP connection to FinCEN on each user request.
- Lines 49-74: On `accepted`, updates DB and calls `sendConfirmationEmail`. Email is sent only in
  this branch, which is only reachable from this authenticated GET handler.
- Lines 75-100: On `rejected`, updates DB and calls `sendRejectionEmail`. Same polling dependency.

**`d2c/src/lib/email.ts`**

- `sendConfirmationEmail` (line 54): Takes `{ firstName, calendarYear, bsaId }`, sends via Resend.
- `sendRejectionEmail` (line 86): Takes `{ firstName, calendarYear, reason }`, sends via Resend.
- Both functions are ready to be called from a background context; they have no request-scoped
  dependencies.

**`d2c/src/lib/sdtm.ts`**

- `checkAcknowledgement` (lines 98-182): Makes a real SFTP connection to FinCEN, reads the
  `/download` directory, finds a file matching `batchId`, parses the XML, and returns
  `{ status: "pending" | "accepted" | "rejected", bsaId?, rejectionReason? }`.
- Sandbox mode (line 101-103): Returns `{ status: "pending" }` unconditionally — no SFTP calls.

**Infrastructure:**

- No background job infrastructure exists in the D2C app. Redis and BullMQ are B2B-only
  (`docker-compose.prod.yml` lines 119-169). The D2C app container runs a single Next.js process.
- No cron route exists under `d2c/src/app/api/`.
- `CRON_SECRET` is set in B2B env but not in D2C env (`docker-compose.prod.yml` lines 81, 192-218).

## Implementation Plan

### Step 1: Add `CRON_SECRET` to D2C environment

Add `CRON_SECRET` to the D2C app's environment in `docker-compose.prod.yml`. This secret is used
to authenticate the cron endpoint so it cannot be called by arbitrary HTTP clients.

```yaml
# docker-compose.prod.yml — d2c-app service, environment block
- CRON_SECRET=${CRON_SECRET}
```

The same `CRON_SECRET` value from `.env` can be shared between B2B and D2C.

### Step 2: Create the cron API route

Create `d2c/src/app/api/cron/sdtm-poll/route.ts`.

The handler must:
1. Authenticate the caller using `Authorization: Bearer <CRON_SECRET>` — return 401 otherwise.
2. Query all `FilingYear` rows in `SUBMITTED` status that have a `sdtmBatchId`.
3. For each filing, call `checkAcknowledgement(sdtmBatchId)`.
4. If accepted: update DB, send confirmation email.
5. If rejected: update DB, send rejection email.
6. Return a JSON summary of results.

```typescript
// d2c/src/app/api/cron/sdtm-poll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";

export const runtime = "nodejs"; // Required — ssh2 uses native Node modules

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all filings still awaiting FinCEN acknowledgement
  const pendingFilings = await prisma.filingYear.findMany({
    where: {
      status: "SUBMITTED",
      sdtmBatchId: { not: null },
    },
    include: { user: true },
  });

  const results = { checked: 0, accepted: 0, rejected: 0, errors: 0 };

  for (const filing of pendingFilings) {
    results.checked++;
    try {
      const ack = await checkAcknowledgement(filing.sdtmBatchId!);

      if (ack.status === "accepted" && ack.bsaId) {
        await prisma.filingYear.updateMany({
          where: { id: filing.id, userId: filing.userId },
          data: { status: "ACCEPTED", bsaId: ack.bsaId, acknowledgedAt: new Date() },
        });
        if (filing.user?.email) {
          await sendConfirmationEmail(filing.user.email, {
            firstName: filing.user.firstName || "",
            calendarYear: filing.calendarYear,
            bsaId: ack.bsaId,
          }).catch((err) =>
            console.error(`[cron] confirmation email failed for filing ${filing.id}:`, err)
          );
        }
        results.accepted++;

      } else if (ack.status === "rejected") {
        await prisma.filingYear.updateMany({
          where: { id: filing.id, userId: filing.userId },
          data: {
            status: "REJECTED",
            rejectionReason: ack.rejectionReason,
            acknowledgedAt: new Date(),
          },
        });
        if (filing.user?.email) {
          await sendRejectionEmail(filing.user.email, {
            firstName: filing.user.firstName || "",
            calendarYear: filing.calendarYear,
            reason: ack.rejectionReason || "Unknown reason",
          }).catch((err) =>
            console.error(`[cron] rejection email failed for filing ${filing.id}:`, err)
          );
        }
        results.rejected++;
      }
      // status === "pending" — do nothing, will check again next run
    } catch (err) {
      console.error(`[cron] sdtm-poll error for filing ${filing.id}:`, err);
      results.errors++;
    }
  }

  console.log("[cron] sdtm-poll complete:", results);
  return NextResponse.json({ ok: true, ...results });
}
```

Key notes:
- `export const runtime = "nodejs"` is required because `ssh2` (used by `sdtm.ts`) cannot run in
  the Edge runtime. Without this, Next.js may attempt to compile the route for the Edge runtime
  and fail at build time or runtime.
- Serial processing (`for...of` not `Promise.all`) prevents overwhelming FinCEN's SFTP server
  with parallel connections and keeps error isolation clean. Given the expected volume (tens of
  filings per day at most), serial is acceptable.
- Email send errors are caught per-filing so one bad email address does not abort the whole batch.

### Step 3: Schedule the cron job via Docker

Add a `d2c-cron` service to `docker-compose.prod.yml` that calls the endpoint every 15 minutes
using `wget` inside an Alpine container:

```yaml
# docker-compose.prod.yml — new service
d2c-cron:
  image: alpine:3.19
  entrypoint: >
    sh -c "while true; do
      wget -qO- --header='Authorization: Bearer ${CRON_SECRET}'
        http://d2c-app:3001/api/cron/sdtm-poll;
      sleep 900;
    done"
  environment:
    - CRON_SECRET=${CRON_SECRET}
  depends_on:
    d2c-app:
      condition: service_healthy
  networks:
    - frontend
  deploy:
    resources:
      limits:
        cpus: "0.05"
        memory: 16M
  restart: always
  logging:
    driver: json-file
    options:
      max-size: "2m"
      max-file: "3"
```

15-minute polling is a reasonable default. FinCEN's SFTP server is checked on every poll, so
more frequent polling would increase SFTP connection overhead. If FinCEN SLA improves, interval
can be reduced to 5 minutes without code changes.

### Step 4: Guard against duplicate emails on the existing `GET /api/sdtm/status` route

The existing `GET /api/sdtm/status` route (lines 28-38) already returns early when status is
`ACCEPTED` or `REJECTED`, so it will not re-send emails after the cron job has updated the DB.
No change is needed there. However, there is a small race window: if the user polls at the exact
moment the cron is writing, one write could succeed and the other be a no-op because `updateMany`
uses `where: { id, userId }` defense-in-depth. The email could be sent by both. To eliminate this
risk, add a check before sending the email in both places:

```typescript
// In both route.ts and the cron handler, before calling sendConfirmationEmail:
// Only send email if this updateMany actually changed a row (count === 1).
// This is already partially done in route.ts lines 59-61.
// The cron handler above should mirror this pattern:
const updateResult = await prisma.filingYear.updateMany({ ... });
if (updateResult.count === 1 && filing.user?.email) {
  await sendConfirmationEmail(...);
}
```

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/app/api/cron/sdtm-poll/route.ts` | **Create new** — background poll handler |
| `docker-compose.prod.yml` | Add `d2c-cron` service; add `CRON_SECRET` to `d2c-app` environment |

## Environment / Config Changes

Add to `docker-compose.prod.yml` `d2c-app` environment block:
```
- CRON_SECRET=${CRON_SECRET}
```

The `CRON_SECRET` variable already exists in `.env` (shared with B2B). No new secret needs to
be generated.

## Testing

**Unit / Integration:**
- No unit test framework is wired for API routes. Test via curl:
  ```bash
  # From inside the VPS or dev machine:
  curl -H "Authorization: Bearer <secret>" \
    http://localhost:3001/api/cron/sdtm-poll
  # Expect: {"ok":true,"checked":N,"accepted":0,"rejected":0,"errors":0}
  ```
- Test unauthorized rejection:
  ```bash
  curl http://localhost:3001/api/cron/sdtm-poll
  # Expect: 401 {"error":"Unauthorized"}
  ```

**Sandbox mode check:**
- With `SDTM_SANDBOX_MODE=true`, `checkAcknowledgement` always returns `pending` (sdtm.ts line 102).
  All filings will remain in `SUBMITTED` status. Confirm the cron logs `checked: N, accepted: 0`.

**Manual E2E with a real SFTP acknowledgement:**
1. Submit a test filing in sandbox mode, then manually flip its status to `SUBMITTED` in the DB
   with a known `sdtmBatchId`.
2. Temporarily disable sandbox mode and place a mock acknowledgement XML in the FinCEN `/download`
   directory matching that `batchId`.
3. Trigger the cron endpoint manually.
4. Verify: DB row is `ACCEPTED`, `bsaId` is set, confirmation email received in inbox.

**Regression:**
- Existing E2E test `t06-signup.spec.ts` and `marketing.spec.ts` should not be affected.
  Run `npx playwright test` to confirm.

## Risks / Notes

- **SFTP connection per filing:** Each call to `checkAcknowledgement` opens and closes one SFTP
  TCP connection. With tens of filings per run, this is fine. If volume grows to hundreds, consider
  batching by listing the entire `/download` directory once and matching all batchIds in memory,
  rather than opening a connection per filing.
- **Server RAM:** The `d2c-cron` Alpine container uses ~4-8 MB. Well within the 1.9 GB limit.
  No risk of OOM.
- **FinCEN sandbox:** `SDTM_SANDBOX_MODE=true` means `checkAcknowledgement` always returns
  `pending`. The cron will run harmlessly with zero updates until sandbox mode is disabled and
  real FinCEN credentials are configured.
- **idempotency:** If the cron fires and DB update succeeds but the email send fails, the DB is
  already in `ACCEPTED` state. On the next cron run, the `where: { status: "SUBMITTED" }` filter
  will exclude this filing, so no double-update. The email will be silently lost. To recover:
  add an `emailSentAt` timestamp to `FilingYear` and re-attempt sending if `acknowledgedAt` is set
  but `emailSentAt` is null. This is an optional follow-up improvement.
- **No Redis required:** This approach avoids adding Redis to the D2C stack, preserving the RAM
  budget and keeping D2C infrastructure simple.
