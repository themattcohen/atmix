import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding FBAR Direct database...");

  // -------------------------------------------------------------------------
  // 1. Test User (debug@example.com / Debug123!)
  // -------------------------------------------------------------------------
  const passwordHash = await bcrypt.hash("Debug123!", 12);
  const user = await prisma.user.upsert({
    where: { email: "debug@example.com" },
    update: {},
    create: {
      email: "debug@example.com",
      passwordHash,
      firstName: "Debug",
      lastName: "User",
    },
  });
  console.log(`  User: ${user.email} (${user.id})`);

  // -------------------------------------------------------------------------
  // 2. Sample Filing (IN_PROGRESS for current-1 year)
  // -------------------------------------------------------------------------
  const calendarYear = new Date().getFullYear() - 1;
  const filing = await prisma.filingYear.upsert({
    where: {
      userId_calendarYear_filingType: {
        userId: user.id,
        calendarYear,
        filingType: "ORIGINAL",
      },
    },
    update: {},
    create: {
      userId: user.id,
      calendarYear,
      status: "IN_PROGRESS",
      filingType: "ORIGINAL",
    },
  });
  console.log(`  Filing: ${filing.calendarYear} — ${filing.status} (${filing.id})`);

  // -------------------------------------------------------------------------
  // 3. Treasury Exchange Rates (12 currencies × 2 years)
  // -------------------------------------------------------------------------
  const exchangeRates = [
    { currencyCode: "EUR", countryName: "Euro Zone", rates: [{ year: 2024, rate: 0.9604 }, { year: 2025, rate: 0.9438 }] },
    { currencyCode: "GBP", countryName: "United Kingdom", rates: [{ year: 2024, rate: 0.7972 }, { year: 2025, rate: 0.7885 }] },
    { currencyCode: "JPY", countryName: "Japan", rates: [{ year: 2024, rate: 157.35 }, { year: 2025, rate: 152.1 }] },
    { currencyCode: "CHF", countryName: "Switzerland", rates: [{ year: 2024, rate: 0.9042 }, { year: 2025, rate: 0.8876 }] },
    { currencyCode: "CAD", countryName: "Canada", rates: [{ year: 2024, rate: 1.4388 }, { year: 2025, rate: 1.4215 }] },
    { currencyCode: "AUD", countryName: "Australia", rates: [{ year: 2024, rate: 1.6072 }, { year: 2025, rate: 1.5834 }] },
    { currencyCode: "CNY", countryName: "China", rates: [{ year: 2024, rate: 7.2988 }, { year: 2025, rate: 7.1845 }] },
    { currencyCode: "INR", countryName: "India", rates: [{ year: 2024, rate: 85.535 }, { year: 2025, rate: 84.72 }] },
    { currencyCode: "KRW", countryName: "South Korea", rates: [{ year: 2024, rate: 1472.5 }, { year: 2025, rate: 1438.0 }] },
    { currencyCode: "ILS", countryName: "Israel", rates: [{ year: 2024, rate: 3.6495 }, { year: 2025, rate: 3.588 }] },
    { currencyCode: "MXN", countryName: "Mexico", rates: [{ year: 2024, rate: 20.675 }, { year: 2025, rate: 20.12 }] },
    { currencyCode: "BRL", countryName: "Brazil", rates: [{ year: 2024, rate: 6.1923 }, { year: 2025, rate: 5.985 }] },
  ];

  let rateCount = 0;
  for (const currency of exchangeRates) {
    for (const entry of currency.rates) {
      const recordDate = new Date(`${entry.year}-12-31T00:00:00.000Z`);
      await prisma.exchangeRate.upsert({
        where: {
          currencyCode_recordDate_source: {
            currencyCode: currency.currencyCode,
            recordDate,
            source: "TREASURY",
          },
        },
        update: {
          rate: entry.rate,
          countryName: currency.countryName,
        },
        create: {
          currencyCode: currency.currencyCode,
          countryName: currency.countryName,
          rate: entry.rate,
          recordDate,
          source: "TREASURY",
        },
      });
      rateCount++;
    }
  }
  console.log(`  Exchange rates: ${rateCount} records seeded`);

  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
