import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding FBAR Automator database...");

  // -------------------------------------------------------------------------
  // 1. Demo Practice
  // -------------------------------------------------------------------------
  const practice = await prisma.practice.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Demo Tax Practice",
      address: {
        street: "123 Main Street",
        suite: "Suite 400",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US",
      },
      ein: "12-3456789",
    },
  });
  console.log(`  Practice: ${practice.name} (${practice.id})`);

  // -------------------------------------------------------------------------
  // 2. Admin User
  //    Password: admin123 (for demo purposes only)
  // -------------------------------------------------------------------------
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      practiceId: practice.id,
      email: "admin@demo.com",
      name: "Admin User",
      passwordHash: "$2a$10$KO9wZGHTWoK718JKzVMlH.LVzjBPISsPWMb/57pTSDbMasCAUHtza",
      role: "ADMIN",
      mfaEnabled: false,
      emailVerified: new Date(),
    },
  });
  console.log(`  Admin user: ${adminUser.email} (${adminUser.id})`);

  // -------------------------------------------------------------------------
  // 2b. Preparer User (non-admin test user)
  //     Password: admin123 (for demo/test purposes only)
  // -------------------------------------------------------------------------
  const preparerUser = await prisma.user.upsert({
    where: { email: "preparer@demo.com" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000011",
      practiceId: practice.id,
      email: "preparer@demo.com",
      name: "Test Preparer",
      passwordHash: "$2a$10$KO9wZGHTWoK718JKzVMlH.LVzjBPISsPWMb/57pTSDbMasCAUHtza",
      role: "PREPARER",
      mfaEnabled: false,
      emailVerified: new Date(),
    },
  });
  console.log(`  Preparer user: ${preparerUser.email} (${preparerUser.id})`);

  // -------------------------------------------------------------------------
  // 3. Treasury Exchange Rates
  //    Rates are the foreign currency units per 1 USD as published by the
  //    U.S. Treasury for the last day of the calendar year. These are used
  //    to convert maximum foreign account values to USD for FBAR filing.
  // -------------------------------------------------------------------------

  // Realistic Treasury rates for Dec 31, 2024 and Dec 31, 2025.
  // Sources: U.S. Treasury Reporting Rates of Exchange
  const exchangeRates: Array<{
    currencyCode: string;
    countryName: string;
    rates: { year: number; rate: number }[];
  }> = [
    {
      currencyCode: "EUR",
      countryName: "Euro Zone",
      rates: [
        { year: 2024, rate: 0.9604 },
        { year: 2025, rate: 0.9438 },
      ],
    },
    {
      currencyCode: "GBP",
      countryName: "United Kingdom",
      rates: [
        { year: 2024, rate: 0.7972 },
        { year: 2025, rate: 0.7885 },
      ],
    },
    {
      currencyCode: "JPY",
      countryName: "Japan",
      rates: [
        { year: 2024, rate: 157.35 },
        { year: 2025, rate: 152.1 },
      ],
    },
    {
      currencyCode: "CHF",
      countryName: "Switzerland",
      rates: [
        { year: 2024, rate: 0.9042 },
        { year: 2025, rate: 0.8876 },
      ],
    },
    {
      currencyCode: "CAD",
      countryName: "Canada",
      rates: [
        { year: 2024, rate: 1.4388 },
        { year: 2025, rate: 1.4215 },
      ],
    },
    {
      currencyCode: "AUD",
      countryName: "Australia",
      rates: [
        { year: 2024, rate: 1.6072 },
        { year: 2025, rate: 1.5834 },
      ],
    },
    {
      currencyCode: "CNY",
      countryName: "China",
      rates: [
        { year: 2024, rate: 7.2988 },
        { year: 2025, rate: 7.1845 },
      ],
    },
    {
      currencyCode: "INR",
      countryName: "India",
      rates: [
        { year: 2024, rate: 85.535 },
        { year: 2025, rate: 84.72 },
      ],
    },
    {
      currencyCode: "KRW",
      countryName: "South Korea",
      rates: [
        { year: 2024, rate: 1472.5 },
        { year: 2025, rate: 1438.0 },
      ],
    },
    {
      currencyCode: "ILS",
      countryName: "Israel",
      rates: [
        { year: 2024, rate: 3.6495 },
        { year: 2025, rate: 3.588 },
      ],
    },
    {
      currencyCode: "MXN",
      countryName: "Mexico",
      rates: [
        { year: 2024, rate: 20.675 },
        { year: 2025, rate: 20.12 },
      ],
    },
    {
      currencyCode: "BRL",
      countryName: "Brazil",
      rates: [
        { year: 2024, rate: 6.1923 },
        { year: 2025, rate: 5.985 },
      ],
    },
  ];

  let rateCount = 0;
  for (const currency of exchangeRates) {
    for (const entry of currency.rates) {
      const recordDate = new Date(`${entry.year}-12-31T00:00:00.000Z`);
      await prisma.exchangeRate.upsert({
        where: {
          currencyCode_recordDate: {
            currencyCode: currency.currencyCode,
            recordDate,
          },
        },
        update: {
          rate: entry.rate,
          countryName: currency.countryName,
          fetchedAt: new Date(),
        },
        create: {
          currencyCode: currency.currencyCode,
          countryName: currency.countryName,
          rate: entry.rate,
          recordDate,
          source: "treasury_api",
          fetchedAt: new Date(),
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
