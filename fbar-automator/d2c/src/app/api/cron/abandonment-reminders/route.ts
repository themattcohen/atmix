import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { getAbandonmentCopy } from "@/lib/abandonment-emails";
import { sendAbandonmentEmail } from "@/lib/email";

// Sequence timing thresholds (ms since last activity)
const SEQUENCE_THRESHOLDS = [
  { seq: 1, delayMs: 1 * 60 * 60 * 1000 },       // 1 hour
  { seq: 2, delayMs: 3 * 60 * 60 * 1000 },       // 3 hours
  { seq: 3, delayMs: 24 * 60 * 60 * 1000 },      // 24 hours
  { seq: 4, delayMs: 48 * 60 * 60 * 1000 },      // 48 hours
] as const;

const TERMINAL_STATUSES = ["PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED"] as const;

const EXCLUDED_EMAILS = ["matt@atmix.org"];

type Stage =
  | "SIGNED"
  | "REVIEWED"
  | "IN_PROGRESS_WITH_ACCOUNTS"
  | "IN_PROGRESS_PII_ONLY"
  | "IN_PROGRESS_EMPTY"
  | "NO_FILING";

function determineStage(
  filing: { status: string; signedAt: Date | null } | null,
  accountCount: number,
  hasTin: boolean,
): Stage {
  if (!filing) return "NO_FILING";
  if (filing.status === "SIGNED") return "SIGNED";
  if (filing.status === "REVIEWED") return "REVIEWED";
  // IN_PROGRESS, NOT_STARTED, or REJECTED — determine sub-stage
  if (accountCount > 0) return "IN_PROGRESS_WITH_ACCOUNTS";
  if (hasTin) return "IN_PROGRESS_PII_ONLY";
  return "IN_PROGRESS_EMPTY";
}

function getDeepLink(stage: Stage): string {
  const base = "https://fbardirect.com";
  switch (stage) {
    case "SIGNED":
      return `${base}/payment`;
    case "REVIEWED":
      return `${base}/sign`;
    case "IN_PROGRESS_WITH_ACCOUNTS":
      return `${base}/review`;
    case "IN_PROGRESS_PII_ONLY":
      return `${base}/accounts`;
    case "IN_PROGRESS_EMPTY":
      return `${base}/personal`;
    case "NO_FILING":
      return `${base}/threshold`;
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Fetch all eligible users with their latest filing, accounts, and abandonment history
    const users = await prisma.user.findMany({
      where: {
        emailVerified: true,
        unsubscribedFromReminders: false,
        email: { notIn: EXCLUDED_EMAILS },
        role: "USER",
        // Only email users who signed up after the cron was activated (2026-04-08)
        // to avoid blasting old pipeline users with overdue sequences
        createdAt: { gte: new Date("2026-04-08T00:00:00Z") },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        tin: true,
        usAddress: true,
        createdAt: true,
        unsubscribeToken: true,
        filingYears: {
          where: {
            status: { notIn: [...TERMINAL_STATUSES] },
          },
          orderBy: { updatedAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            signedAt: true,
            updatedAt: true,
          },
        },
        // Also check if user has ANY terminal filing (to exclude completed customers)
        _count: {
          select: {
            accounts: true,
            filingYears: { where: { status: { in: [...TERMINAL_STATUSES] } } },
          },
        },
        abandonmentEmails: {
          orderBy: { sequence: "desc" },
          take: 1,
          select: { sequence: true, sentAt: true },
        },
      },
    });

    for (const user of users) {
      processed++;

      // Skip users who already have a completed filing (PAID/SUBMITTED/ACCEPTED)
      if (user._count.filingYears > 0) {
        skipped++;
        continue;
      }

      const filing = user.filingYears[0] ?? null;
      const lastActivity = filing ? filing.updatedAt : user.createdAt;
      const msSinceActivity = now - lastActivity.getTime();
      const emailsSent = user.abandonmentEmails[0]?.sequence ?? 0;

      // Find the next qualifying sequence
      const nextSeq = SEQUENCE_THRESHOLDS.find(
        (t) => t.seq === emailsSent + 1 && msSinceActivity >= t.delayMs,
      );

      if (!nextSeq) {
        skipped++;
        continue;
      }

      const accountCount = user._count.accounts;
      const hasTin = user.tin !== null;
      const stage = determineStage(filing, accountCount, hasTin);

      const deepLink = getDeepLink(stage);
      const utmParams = `utm_source=email&utm_medium=abandonment&utm_campaign=reminder_${nextSeq.seq}`;
      const resumeUrl = `${deepLink}?${utmParams}`;
      const unsubscribeUrl = `https://fbardirect.com/api/unsubscribe?token=${user.unsubscribeToken}`;

      try {
        const deadlineDate = new Date("2026-04-15T23:59:59Z");
        const daysUntilDeadline = Math.max(0, Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

        const copy = getAbandonmentCopy(
          stage,
          nextSeq.seq,
          user.firstName ?? "there",
          resumeUrl,
          daysUntilDeadline,
        );

        await sendAbandonmentEmail(user.email, copy, resumeUrl, unsubscribeUrl);

        // Record the sent email — unique constraint prevents duplicates
        await prisma.abandonmentEmail.create({
          data: {
            userId: user.id,
            filingYearId: filing?.id ?? null,
            sequence: nextSeq.seq,
            stage,
          },
        });

        sent++;
        log("info", "Abandonment email sent", {
          userId: user.id,
          sequence: nextSeq.seq,
          stage,
        });
      } catch (err: unknown) {
        // Silently skip unique constraint violations (email already sent)
        if (
          err instanceof Error &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          skipped++;
          continue;
        }

        errors++;
        Sentry.captureException(err, {
          extra: { userId: user.id, sequence: nextSeq.seq, stage },
        });
        log("error", "Failed to send abandonment email", {
          userId: user.id,
          sequence: nextSeq.seq,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    log("error", "Abandonment reminders cron failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal error", processed, sent, skipped, errors },
      { status: 500 },
    );
  }

  return NextResponse.json({ processed, sent, skipped, errors });
}
