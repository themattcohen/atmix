/**
 * One-shot migration script: Recalculate maxValueUsd for all non-USD accounts.
 *
 * The original code used `amount * rate` but Treasury rates are "foreign currency
 * per 1 USD", so the correct formula is `amount / rate`.
 *
 * Usage:
 *   cd d2c && npx tsx scripts/fix-exchange-rates.ts
 *
 * Safe to run multiple times — idempotent (recalculates from stored maxValueLocal + exchangeRate).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all non-USD accounts that have a stored maxValueUsd and exchangeRate
  const accounts = await prisma.foreignAccount.findMany({
    where: {
      currencyCode: { not: "USD" },
      maxValueUsd: { not: null },
      exchangeRate: { not: null },
    },
    select: {
      id: true,
      currencyCode: true,
      maxValueLocal: true,
      maxValueUsd: true,
      exchangeRate: true,
    },
  });

  console.log(`Found ${accounts.length} non-USD accounts with maxValueUsd to fix.`);

  let updated = 0;
  for (const account of accounts) {
    const rate = Number(account.exchangeRate);
    const local = Number(account.maxValueLocal);

    if (rate <= 0) {
      console.warn(`  SKIP ${account.id}: invalid rate ${rate}`);
      continue;
    }

    const oldUsd = Number(account.maxValueUsd);
    const newUsd = local / rate;

    console.log(
      `  ${account.id}: ${account.currencyCode} ${local} / ${rate} = $${newUsd.toFixed(2)} (was $${oldUsd.toFixed(2)})`
    );

    await prisma.foreignAccount.update({
      where: { id: account.id },
      data: { maxValueUsd: newUsd },
    });
    updated++;
  }

  console.log(`\nDone. Updated ${updated} accounts.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
