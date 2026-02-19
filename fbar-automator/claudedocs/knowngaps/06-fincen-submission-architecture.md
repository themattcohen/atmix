# Gap #6: FinCEN Submission Triggered from Browser

**Severity:** High
**Effort:** L (4-8 hours)
**Depends on:** Gap #1 (XML generation), Gap #2 (Treasury rates)

## Problem

The FinCEN FBAR submission is initiated by a client-side `useEffect` in the browser. If the user closes the browser tab, navigates away, or loses connectivity after payment but before the `useEffect` fires and completes, the filing remains stuck in `PAID` status indefinitely. The user has paid but their FBAR was never transmitted to FinCEN. There is no server-side recovery mechanism.

The same problem extends to the acknowledgement polling loop on the confirmation page: the 30-second `setInterval` that drives `GET /api/sdtm/status` also runs entirely in the browser. If the user closes the tab after seeing "FBAR Submitted", the BSA ID is never fetched and the filing stays `SUBMITTED` forever.

## Current State

### Trigger point — confirmation page (browser)

`d2c/src/app/(app)/confirmation/page.tsx`, lines 179-215:

```
useEffect(() => {
  if (status === "paid" && filing?.id && !hasSubmitted.current) {
    hasSubmitted.current = true;
    setStatus("submitting");
    const submit = async () => {
      const res = await fetch("/api/sdtm/submit", {   // <-- browser-initiated
        method: "POST",
        ...
        body: JSON.stringify({ filingYearId: filing.id }),
      });
      ...
    };
    submit();
  }
}, [status, filing?.id, loadFiling]);
```

The submission is fired from a React `useEffect`. It has no server-side fallback if the browser session ends.

### Submit route — already correct internally

`d2c/src/app/api/sdtm/submit/route.ts`, lines 38-100:

The route correctly implements:
- Atomic `PAID → SUBMITTING` transition via `updateMany` with a status guard (line 39-43)
- Idempotency check for already-submitted filings (lines 27-36)
- Revert from `SUBMITTING → PAID` on SFTP failure (lines 80-84)

The route itself is sound. The problem is that nothing calls it server-side after payment.

### Stripe webhook — stops at PAID

`d2c/src/app/api/stripe/webhook/route.ts`, lines 71-78:

```
// Update filing year with userId verification
await prisma.filingYear.updateMany({
  where: { id: filingYearId, userId },
  data: {
    status: "PAID",             // <-- stops here, does NOT submit
    stripePaymentId: ...,
    stripeSessionId: ...,
  },
});
```

The `checkout.session.completed` handler transitions the filing to `PAID` and then returns. Submission is not attempted. This is the correct insertion point for a server-side submission trigger.

### Acknowledgement polling — also browser-only

`d2c/src/app/(app)/confirmation/page.tsx`, lines 218-240:

```
useEffect(() => {
  if (status !== "submitted" || !filing?.id) return;
  const interval = setInterval(async () => {
    const res = await fetch(`/api/sdtm/status?filingYearId=${filing.id}`);
    ...
  }, 30000);   // polls every 30s, only while browser tab is open
  return () => clearInterval(interval);
}, [status, filing?.id, loadFiling]);
```

`d2c/src/app/api/sdtm/status/route.ts`, lines 44-101: The status route calls `checkAcknowledgement()`, parses the SFTP response, and writes `ACCEPTED`/`REJECTED` + BSA ID to the database. This is correct logic, but it is only called when a browser is actively polling.

### Schema — no retry metadata

`d2c/prisma/schema.prisma`, lines 68-103: `FilingYear` has no field for tracking submission attempt count, last attempt timestamp, or next retry time. The `SUBMITTING` status exists but a filing can get stuck there if the server crashes after the atomic lock but before the SFTP write completes (since the revert is in the same request handler, not a separate recovery path).

### Infrastructure — Redis is available but D2C doesn't use it

`docker-compose.prod.yml`, lines 334-379: Redis 7 is running in the backend network and is fully operational for the B2B BullMQ worker. The D2C `d2c-app` service is on the same backend network but has no Redis env vars and no worker container.

## Implementation Plan

### Step 1: Move submission trigger into Stripe webhook

Modify `d2c/src/app/api/stripe/webhook/route.ts` to call the submission logic directly after setting status to `PAID`.

The existing `POST /api/sdtm/submit` route contains all the right logic. Extract the core submission logic into a shared server-side function so it can be called from both the webhook and the existing route (for retries).

**New file: `d2c/src/lib/fincen-submit.ts`**

Extract the submission logic from `route.ts` into a reusable function:

```typescript
// d2c/src/lib/fincen-submit.ts
import { prisma } from "@/lib/db";
import { generateFincenXml } from "@/lib/fincen-xml";
import { submitBatch } from "@/lib/sdtm";
import { sendSubmissionEmail } from "@/lib/email";
import crypto from "crypto";

export type SubmitFilingResult =
  | { success: true; batchId: string; submittedAt: string; alreadySubmitted?: boolean }
  | { success: false; error: string; conflict?: boolean };

export async function submitFiling(
  filingYearId: string,
  userId: string
): Promise<SubmitFilingResult> {
  const filingYear = await prisma.filingYear.findFirst({
    where: { id: filingYearId, userId },
  });

  if (!filingYear) {
    return { success: false, error: "Filing year not found" };
  }

  // Idempotency: already past submission
  if (["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(filingYear.status)) {
    return {
      success: true,
      batchId: filingYear.sdtmBatchId ?? "",
      submittedAt: filingYear.submittedAt?.toISOString() ?? "",
      alreadySubmitted: true,
    };
  }

  // Atomic PAID → SUBMITTING lock
  const locked = await prisma.filingYear.updateMany({
    where: { id: filingYearId, userId, status: "PAID" },
    data: { status: "SUBMITTING" },
  });

  if (locked.count === 0) {
    // Check current state for idempotent return
    const current = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId },
      select: { status: true, sdtmBatchId: true, submittedAt: true },
    });
    if (current && ["SUBMITTED", "SUBMITTING", "ACCEPTED", "REJECTED"].includes(current.status)) {
      return {
        success: true,
        batchId: current.sdtmBatchId ?? "",
        submittedAt: current.submittedAt?.toISOString() ?? "",
        alreadySubmitted: true,
      };
    }
    return { success: false, error: "Filing is not in a submittable state", conflict: true };
  }

  try {
    const xml = await generateFincenXml(filingYearId);
    const batchId = crypto.randomUUID();
    const result = await submitBatch(xml, batchId);

    if (!result.success) {
      // Revert lock on failure
      await prisma.filingYear.updateMany({
        where: { id: filingYearId, userId, status: "SUBMITTING" },
        data: { status: "PAID" },
      });
      return { success: false, error: result.error ?? "Submission failed" };
    }

    await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId, status: "SUBMITTING" },
      data: {
        status: "SUBMITTED",
        sdtmSubmissionId: result.remoteFilePath,
        sdtmBatchId: batchId,
        submittedAt: new Date(),
      },
    });

    // Non-blocking email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      sendSubmissionEmail(user.email, {
        firstName: user.firstName ?? "",
        calendarYear: filingYear.calendarYear,
      }).catch((err) =>
        console.error("Submission email failed:", err instanceof Error ? err.message : err)
      );
    }

    return { success: true, batchId, submittedAt: new Date().toISOString() };
  } catch (err) {
    // Safety revert if an unexpected error occurs after locking
    await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId, status: "SUBMITTING" },
      data: { status: "PAID" },
    }).catch(() => {}); // best-effort revert
    return { success: false, error: err instanceof Error ? err.message : "Internal error" };
  }
}
```

### Step 2: Update the Stripe webhook to call submitFiling

Modify `d2c/src/app/api/stripe/webhook/route.ts`, inside the `checkout.session.completed` case, after the `filingYear.updateMany` call that sets status to `PAID` (line 71).

Add immediately after line 78 (after the `updateMany` that writes `PAID`):

```typescript
// Trigger server-side FinCEN submission — no browser required
import { submitFiling } from "@/lib/fincen-submit";

// ... inside checkout.session.completed case, after PAID update:
const submitResult = await submitFiling(filingYearId, userId);
if (!submitResult.success) {
  // Log but do NOT fail the webhook response — PAID status is set, browser can retry
  console.error(
    `[Webhook] FinCEN submission failed for filing ${filingYearId}:`,
    submitResult.error
  );
} else {
  console.log(
    `[Webhook] FinCEN submission initiated for filing ${filingYearId}, batchId: ${submitResult.batchId}`
  );
}
```

The webhook must still return `200 OK` regardless of submission outcome. Stripe retries webhook delivery on non-2xx responses, which would cause duplicate PAID processing attempts. The submission failure is recoverable via Step 3.

### Step 3: Add a cron endpoint to recover stuck PAID filings

Add a new internal cron route: `d2c/src/app/api/cron/submit-paid/route.ts`

This route scans for filings that have been in `PAID` status for more than 5 minutes (webhook submitted but SFTP failed, or webhook never arrived) and retries submission.

```typescript
// d2c/src/app/api/cron/submit-paid/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitFiling } from "@/lib/fincen-submit";

export async function GET(req: NextRequest) {
  // Protect with a shared secret to prevent public invocation
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find filings stuck in PAID for >5 minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const stuckFilings = await prisma.filingYear.findMany({
    where: {
      status: "PAID",
      updatedAt: { lt: cutoff },
    },
    select: { id: true, userId: true, calendarYear: true },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const filing of stuckFilings) {
    const result = await submitFiling(filing.id, filing.userId);
    results.push({
      id: filing.id,
      outcome: result.success
        ? result.alreadySubmitted
          ? "already_submitted"
          : "submitted"
        : `failed: ${result.error}`,
    });
  }

  return NextResponse.json({ processed: results.length, results });
}
```

### Step 4: Add a cron endpoint to recover stuck SUBMITTED filings

Add a companion route: `d2c/src/app/api/cron/poll-submitted/route.ts`

This calls `GET /api/sdtm/status` logic server-side for all filings in `SUBMITTED` status, so BSA ID acknowledgement happens even when no browser is open.

```typescript
// d2c/src/app/api/cron/poll-submitted/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAcknowledgement } from "@/lib/sdtm";
import { sendConfirmationEmail, sendRejectionEmail } from "@/lib/email";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const submittedFilings = await prisma.filingYear.findMany({
    where: { status: "SUBMITTED", sdtmBatchId: { not: null } },
    include: { user: { select: { email: true, firstName: true } } },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const filing of submittedFilings) {
    if (!filing.sdtmBatchId) continue;

    const ack = await checkAcknowledgement(filing.sdtmBatchId);

    if (ack.status === "accepted" && ack.bsaId) {
      await prisma.filingYear.update({
        where: { id: filing.id },
        data: { status: "ACCEPTED", bsaId: ack.bsaId, acknowledgedAt: new Date() },
      });
      if (filing.user.email) {
        sendConfirmationEmail(filing.user.email, {
          firstName: filing.user.firstName ?? "",
          calendarYear: filing.calendarYear,
          bsaId: ack.bsaId,
        }).catch(() => {});
      }
      results.push({ id: filing.id, outcome: "accepted" });
    } else if (ack.status === "rejected") {
      await prisma.filingYear.update({
        where: { id: filing.id },
        data: {
          status: "REJECTED",
          rejectionReason: ack.rejectionReason,
          acknowledgedAt: new Date(),
        },
      });
      if (filing.user.email) {
        sendRejectionEmail(filing.user.email, {
          firstName: filing.user.firstName ?? "",
          calendarYear: filing.calendarYear,
          reason: ack.rejectionReason ?? "Unknown reason",
        }).catch(() => {});
      }
      results.push({ id: filing.id, outcome: "rejected" });
    } else {
      results.push({ id: filing.id, outcome: "pending" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
```

### ⚠️ Cross-Gap Resolution: Gap #14 Merged Here

Gap #14 ("BSA-ID Confirmation Email Requires User to Revisit") proposes a separate `/api/cron/sdtm-poll` route and a separate `d2c-cron` Docker service. That functionality is fully absorbed by this gap's `/api/cron/poll-submitted` route (Step 4) and `d2c-cron` service (Step 6).

**Gap #14's proposed `/api/cron/sdtm-poll` route must NOT be implemented.** Its logic (poll FinCEN SFTP for SUBMITTED filings, update DB, send confirmation/rejection emails) is identical to Step 4's `poll-submitted` route.

The `d2c-cron` Docker service defined in Step 6 calls both `submit-paid` and `poll-submitted` on a 5-minute interval, which supersedes Gap #14's proposed Alpine container with a 15-minute sleep loop.

### Step 5: Update the existing submit route to use the shared function

Replace the inline logic in `d2c/src/app/api/sdtm/submit/route.ts` with a call to `submitFiling()`. This eliminates duplicated code and ensures the route and webhook use identical logic.

```typescript
// d2c/src/app/api/sdtm/submit/route.ts (simplified)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { submitFiling } from "@/lib/fincen-submit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filingYearId } = await req.json();
  const result = await submitFiling(filingYearId, session.user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: result.conflict ? 409 : 500 }
    );
  }

  return NextResponse.json({ success: true, data: result });
}
```

### Step 6: Wire up cron invocations

**Option A: Docker cron container (recommended for 1.9 GB VPS)**

Add a lightweight cron service to `docker-compose.prod.yml`. Uses BusyBox crond — no Redis, no BullMQ, no extra memory.

```yaml
# d2c-cron — lightweight cron to recover stuck filings
d2c-cron:
  image: busybox:latest
  command: >
    sh -c 'echo "*/5 * * * * wget -q -O- --header=\"Authorization: Bearer $CRON_SECRET\"
    http://d2c-app:3001/api/cron/submit-paid >> /proc/1/fd/1 2>&1
    && wget -q -O- --header=\"Authorization: Bearer $CRON_SECRET\"
    http://d2c-app:3001/api/cron/poll-submitted >> /proc/1/fd/1 2>&1"
    | crontab - && crond -f -l 2'
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
```

`CRON_SECRET` is already defined in `.env` (used by the B2B app at line 82 of `docker-compose.prod.yml`). Reuse the same value for D2C cron.

**Option B: Use the existing `d2c-app` container's startup timer**

If adding a container is undesirable given the 1.9 GB RAM constraint (16 MB is negligible but still), the cron calls can be driven externally by a simple Hetzner cron job via SSH:

```bash
# /etc/cron.d/fbar-d2c on the Hetzner VPS
*/5 * * * * root curl -s -H "Authorization: Bearer $CRON_SECRET" https://fbardirect.com/api/cron/submit-paid
*/5 * * * * root curl -s -H "Authorization: Bearer $CRON_SECRET" https://fbardirect.com/api/cron/poll-submitted
```

Option A is preferred because it works even when the public domain is unreachable and keeps cron configuration in the repo.

### Step 7: Update the confirmation page to handle server-side submission gracefully

Modify `d2c/src/app/(app)/confirmation/page.tsx`, lines 179-215 (the auto-submit `useEffect`).

The webhook now submits on the server side, so by the time the browser reaches the confirmation page, the filing is often already `SUBMITTED`. The `useEffect` should still attempt submission as a fallback (it is idempotent), but should first re-check filing status to avoid redundant SFTP calls:

```typescript
// Modified auto-submit useEffect (lines 179-215)
useEffect(() => {
  if (status === "paid" && filing?.id && !hasSubmitted.current) {
    hasSubmitted.current = true;

    // Re-check status first — webhook may have already submitted server-side
    const checkAndSubmit = async () => {
      const latestStatus = await loadFiling();
      if (latestStatus && ["SUBMITTED", "ACCEPTED", "REJECTED", "SUBMITTING"].includes(latestStatus)) {
        // Server already handled it — no browser submission needed
        updateStatusFromFiling(latestStatus);
        return;
      }
      // Still PAID — fall back to browser-initiated submission
      setStatus("submitting");
      const res = await fetch("/api/sdtm/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ filingYearId: filing.id }),
      });
      // ... rest of existing error handling unchanged
    };
    checkAndSubmit();
  }
}, [status, filing?.id, loadFiling]);
```

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/fincen-submit.ts` | **NEW** — Extract shared submission logic from route |
| `d2c/src/app/api/sdtm/submit/route.ts` | Replace inline logic with call to `submitFiling()` |
| `d2c/src/app/api/stripe/webhook/route.ts` | Call `submitFiling()` after PAID status is set in `checkout.session.completed` handler |
| `d2c/src/app/api/cron/submit-paid/route.ts` | **NEW** — Cron endpoint to retry stuck PAID filings |
| `d2c/src/app/api/cron/poll-submitted/route.ts` | **NEW** — Cron endpoint to poll acknowledgements for SUBMITTED filings |
| `d2c/src/app/(app)/confirmation/page.tsx` | Add status re-check before browser-initiated submission (lines 179-215) |
| `docker-compose.prod.yml` | Add `d2c-cron` service |

## Environment / Config Changes

No new environment variables required.

- `CRON_SECRET` already exists in `.env` (used by B2B). The same variable is reused for D2C cron route authentication. Verify it is present in `.env` before deploying.
- No new Stripe configuration needed.
- No Redis or BullMQ dependency added for D2C — the cron approach uses HTTP polling only.

**Confirm in `.env`:**
```
CRON_SECRET=<existing value from B2B>
```

**Add to D2C app environment in `docker-compose.prod.yml` `d2c-app` service:**
```yaml
- CRON_SECRET=${CRON_SECRET}
```

## Testing

### Manual verification (happy path — browser stays open)

1. Complete a full wizard flow through payment.
2. On confirmation page, verify filing transitions: `PAID` → `SUBMITTING` → `SUBMITTED`.
3. In SDTM sandbox mode, the transition should be near-instant.
4. Confirm submission email is received.

### Manual verification (browser-closed scenario)

1. Complete payment and immediately close the browser before the confirmation page `useEffect` fires.
2. Wait 6 minutes for the cron to run.
3. Reopen the dashboard and verify the filing status is `SUBMITTED` (not `PAID`).
4. This can be simulated by manually setting a test filing to `PAID` in Postgres and invoking the cron endpoint directly:
   ```bash
   curl -H "Authorization: Bearer <secret>" http://localhost:3001/api/cron/submit-paid
   ```
5. Check the response includes the filing ID with `outcome: "submitted"`.

### Unit tests

Add `d2c/tests/unit/fincen-submit.test.ts`:
- Mock `prisma`, `generateFincenXml`, `submitBatch`, `sendSubmissionEmail`.
- Test: idempotent return when status is already `SUBMITTED`.
- Test: atomic lock prevents double submission (simulate `updateMany` returning `count: 0`).
- Test: revert to `PAID` when SFTP `submitBatch` returns `success: false`.
- Test: happy path returns `{ success: true, batchId, submittedAt }`.

### E2E test additions

Add to `d2c/tests/e2e/` — a test that:
1. Pays for a filing.
2. Directly hits `GET /api/cron/submit-paid` with the `Authorization: Bearer` header.
3. Asserts the filing status in the database (via the filing API) transitions to `SUBMITTED`.

### Cron endpoint smoke test

```bash
# Expect 401
curl http://localhost:3001/api/cron/submit-paid

# Expect 200 with { processed: N, results: [...] }
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/submit-paid

# Expect 200 with { processed: N, results: [...] }
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/poll-submitted
```

## Risks / Notes

**Webhook timeout.** Stripe expects a `200 OK` within 30 seconds. The `submitFiling()` call includes SFTP I/O, which may be slow. If SDTM SFTP latency exceeds ~20 seconds, Stripe will retry the webhook and the submission could be double-attempted. The atomic `PAID → SUBMITTING` lock in `submitFiling()` prevents double-submission, but the cron still needs to recover the filing if the webhook timed out mid-SFTP. If Stripe webhook timeouts are observed in production logs, move the `submitFiling()` call to a fire-and-forget pattern (e.g., `setImmediate(() => submitFiling(...))`) so the webhook returns immediately. This carries a small risk of the Node process exiting before submission completes, which the cron would recover from within 5 minutes.

**SUBMITTING stuck state.** If the server crashes after the `PAID → SUBMITTING` lock but before the SFTP write, the filing is stuck in `SUBMITTING` forever — neither the webhook recovery path nor the cron endpoint handles `SUBMITTING` (only `PAID`). Add a secondary cron query or extend `submit-paid` to also revert stale `SUBMITTING` filings (older than 10 minutes) back to `PAID` so the cron can retry them:

```typescript
// In submit-paid cron, add before the PAID query:
await prisma.filingYear.updateMany({
  where: {
    status: "SUBMITTING",
    updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
  },
  data: { status: "PAID" },
});
```

**Browser submission remains as fallback.** After this change, the browser `useEffect` is no longer the primary submission path, but it is retained as a belt-and-suspenders fallback. The idempotency logic in `submitFiling()` ensures it is safe to call from both paths simultaneously.

**Redis is available but not used.** The existing Redis instance (used by B2B BullMQ) could power a proper D2C job queue in the future, but adding BullMQ to the D2C app would require a new D2C worker container and Dockerfile target. The cron HTTP approach is simpler, has no dependency on Redis, and is sufficient for the low submission volume expected (FBAR filings are once-per-year-per-user). Upgrade to BullMQ only if volume or latency requirements change.

**`CRON_SECRET` exposure.** The cron secret must be set in the D2C app environment. Verify it is not logged in Next.js startup output and is not exposed via any `/api/debug` or health endpoints.
