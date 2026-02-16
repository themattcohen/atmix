import { prisma } from "@/lib/db";

export type WizardStep = "threshold" | "personal" | "accounts" | "review" | "sign" | "payment" | "confirmation";

const STEP_ORDER: WizardStep[] = ["threshold", "personal", "accounts", "review", "sign", "payment", "confirmation"];

/**
 * Check if a user can access a given wizard step based on their filing state.
 * Returns { allowed: true } or { allowed: false, redirectTo: string }.
 */
export async function checkWizardAccess(
  userId: string,
  targetStep: WizardStep,
  filingId?: string
): Promise<{ allowed: true } | { allowed: false; redirectTo: string }> {
  // Threshold is always accessible (first step)
  if (targetStep === "threshold") return { allowed: true };

  // Personal is always accessible (user may need to fill in info)
  if (targetStep === "personal") return { allowed: true };

  // Check if user has personal info for subsequent steps
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, tin: true },
  });

  // Accounts requires personal info to be filled
  if (!user?.firstName || !user?.lastName) {
    return { allowed: false, redirectTo: "/personal" };
  }

  if (targetStep === "accounts") return { allowed: true };

  // Get the active filing — look for the specific filing if provided, otherwise most recent
  const filing = filingId
    ? await prisma.filingYear.findFirst({
        where: { id: filingId, userId },
        orderBy: { updatedAt: "desc" },
      })
    : await prisma.filingYear.findFirst({
        where: {
          userId,
          status: {
            in: ["IN_PROGRESS", "REVIEWED", "SIGNED", "PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED", "REJECTED"],
          },
        },
        orderBy: { updatedAt: "desc" },
      });

  // Review requires at least 1 account
  if (targetStep === "review") {
    if (!filing) return { allowed: false, redirectTo: "/threshold" };
    const accountCount = await prisma.foreignAccount.count({
      where: { userId, calendarYear: filing.calendarYear },
    });
    if (accountCount === 0) return { allowed: false, redirectTo: "/accounts" };
    return { allowed: true };
  }

  // Sign requires REVIEWED status
  if (targetStep === "sign") {
    if (!filing || filing.status !== "REVIEWED") {
      return { allowed: false, redirectTo: "/review" };
    }
    return { allowed: true };
  }

  // Payment requires SIGNED status
  if (targetStep === "payment") {
    if (!filing || filing.status !== "SIGNED") {
      return { allowed: false, redirectTo: "/sign" };
    }
    return { allowed: true };
  }

  // Confirmation requires PAID, SUBMITTING, SUBMITTED, ACCEPTED, or REJECTED
  if (targetStep === "confirmation") {
    if (!filing || !["PAID", "SUBMITTING", "SUBMITTED", "ACCEPTED", "REJECTED"].includes(filing.status)) {
      return { allowed: false, redirectTo: "/payment" };
    }
    return { allowed: true };
  }

  return { allowed: true };
}
