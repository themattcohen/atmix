import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting extraction seed...');

  // Known IDs from existing data
  const PRACTICE_ID = '00000000-0000-0000-0000-000000000001';
  const ADMIN_ID = '00000000-0000-0000-0000-000000000010';
  const CLIENT_ID = '655eeb60-ab8c-4144-898a-a03c82a9cc6b';
  const UBS_ACCOUNT_ID = 'b820e38c-6110-44c4-b657-7e597d20006a';
  const FILING_YEAR_ID = '31bc55c3-01e2-49a0-ae24-99205266f340';
  const CHF_EXCHANGE_RATE = 0.8876;

  // 1. Create second foreign account (Credit Suisse)
  const CS_ACCOUNT_ID = '9a1b2c3d-4e5f-6789-0abc-def123456789';
  console.log('Creating/updating Credit Suisse account...');

  // First, clean up any existing statements and related data for this account
  await prisma.extractedData.deleteMany({
    where: {
      statement: {
        foreignAccountId: CS_ACCOUNT_ID
      }
    }
  });
  await prisma.statement.deleteMany({
    where: {
      foreignAccountId: CS_ACCOUNT_ID
    }
  });
  await prisma.reviewedAccountYear.deleteMany({
    where: {
      foreignAccountId: CS_ACCOUNT_ID
    }
  });
  await prisma.foreignAccount.deleteMany({
    where: {
      id: CS_ACCOUNT_ID
    }
  });

  const csAccount = await prisma.foreignAccount.create({
    data: {
      id: CS_ACCOUNT_ID,
      clientId: CLIENT_ID,
      accountNumber: 'CH82-0483-5012-3456-7800-9',
      accountType: 'SECURITIES',
      accountTypeDescription: 'Investment Portfolio Account',
      institutionName: 'Credit Suisse AG (UBS Group)',
      institutionAddressStreet: 'Paradeplatz 8',
      institutionAddressCity: 'Zurich',
      institutionAddressState: 'ZH',
      institutionAddressCountry: 'CH',
      institutionAddressPostal: '8001',
      ownershipType: 'FINANCIAL_INTEREST',
      isJointlyOwned: false,
      isActive: true,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:00:00Z'),
    },
  });
  console.log(`Created Credit Suisse account: ${csAccount.id}`);

  // 2. Create two Statement records
  const processingStart1 = new Date('2025-12-15T14:30:00Z');
  const processingComplete1 = new Date('2025-12-15T14:30:45Z');

  console.log('Creating UBS statement...');
  const ubsStatement = await prisma.statement.create({
    data: {
      filingYearId: FILING_YEAR_ID,
      foreignAccountId: UBS_ACCOUNT_ID,
      fileName: 'UBS_Statement_2025_Annual.pdf',
      fileType: 'application/pdf',
      filePath: 'practices/00000000-0000-0000-0000-000000000001/statements/ubs-2025-annual.pdf',
      fileSizeBytes: 245000,
      pageCount: 4,
      processingStatus: 'COMPLETED',
      processingStartedAt: processingStart1,
      processingCompletedAt: processingComplete1,
      llmModelUsed: 'claude-sonnet-4-5-20250929',
      llmTokensUsed: 3200,
    },
  });
  console.log(`Created UBS statement: ${ubsStatement.id}`);

  const processingStart2 = new Date('2025-12-18T09:15:00Z');
  const processingComplete2 = new Date('2025-12-18T09:15:52Z');

  console.log('Creating Credit Suisse statement...');
  const csStatement = await prisma.statement.create({
    data: {
      filingYearId: FILING_YEAR_ID,
      foreignAccountId: csAccount.id,
      fileName: 'CreditSuisse_Portfolio_2025_Q4.pdf',
      fileType: 'application/pdf',
      filePath: 'practices/00000000-0000-0000-0000-000000000001/statements/cs-2025-q4.pdf',
      fileSizeBytes: 380000,
      pageCount: 6,
      processingStatus: 'COMPLETED',
      processingStartedAt: processingStart2,
      processingCompletedAt: processingComplete2,
      llmModelUsed: 'claude-sonnet-4-5-20250929',
      llmTokensUsed: 4100,
    },
  });
  console.log(`Created Credit Suisse statement: ${csStatement.id}`);

  // 3. Create two ExtractedData records
  console.log('Creating UBS extracted data...');
  const ubsRawLlmResponse = {
    accounts: [{
      bank_name: 'UBS AG',
      bank_address: {
        street: 'Bahnhofstrasse 45',
        city: 'Zurich',
        state_province: 'ZH',
        country: 'CH',
        postal_code: '8001'
      },
      account_number: 'CH93-0076-2011-6238-5295-7',
      account_type: 'bank',
      account_type_description: 'Personal Checking Account',
      currency: 'CHF',
      statement_period: {
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      },
      balances: [
        { date: '2025-03-31', amount: 45230.50, label: 'Q1 Closing Balance', is_maximum: false },
        { date: '2025-06-30', amount: 78450.25, label: 'Q2 Closing Balance', is_maximum: true },
        { date: '2025-09-30', amount: 62100.00, label: 'Q3 Closing Balance', is_maximum: false },
        { date: '2025-12-31', amount: 55890.75, label: 'Year-End Balance', is_maximum: false }
      ],
      max_balance: {
        amount: 78450.25,
        date: '2025-06-30',
        label: 'Q2 Closing Balance'
      },
      confidence: {
        bank_name: 'high',
        account_number: 'high',
        currency: 'high',
        max_balance: 'high',
        overall: 'high'
      },
      warnings: []
    }],
    document_language: 'en',
    document_metadata: {
      page_count: 4,
      is_multi_account: false,
      is_transaction_only: false
    }
  } as unknown as Prisma.InputJsonValue;

  const ubsBankAddress = {
    street: 'Bahnhofstrasse 45',
    city: 'Zurich',
    state_province: 'ZH',
    country: 'CH',
    postal_code: '8001'
  } as unknown as Prisma.InputJsonValue;

  const ubsBalances = [
    { date: '2025-03-31', amount: 45230.50, label: 'Q1 Closing Balance', is_maximum: false },
    { date: '2025-06-30', amount: 78450.25, label: 'Q2 Closing Balance', is_maximum: true },
    { date: '2025-09-30', amount: 62100.00, label: 'Q3 Closing Balance', is_maximum: false },
    { date: '2025-12-31', amount: 55890.75, label: 'Year-End Balance', is_maximum: false }
  ] as unknown as Prisma.InputJsonValue;

  await prisma.extractedData.create({
    data: {
      statementId: ubsStatement.id,
      rawLlmResponse: ubsRawLlmResponse,
      bankName: 'UBS AG',
      bankAddress: ubsBankAddress,
      accountNumber: 'CH93-0076-2011-6238-5295-7',
      accountTypeDetected: 'bank',
      currencyCode: 'CHF',
      balances: ubsBalances,
      maxBalanceLocal: 78450.25,
      maxBalanceDate: new Date('2025-06-30'),
      statementPeriodStart: new Date('2025-01-01'),
      statementPeriodEnd: new Date('2025-12-31'),
    },
  });
  console.log('Created UBS extracted data');

  console.log('Creating Credit Suisse extracted data...');
  const csRawLlmResponse = {
    accounts: [{
      bank_name: 'Credit Suisse AG (UBS Group)',
      bank_address: {
        street: 'Paradeplatz 8',
        city: 'Zurich',
        state_province: 'ZH',
        country: 'CH',
        postal_code: '8001'
      },
      account_number: 'CH82-0483-5012-3456-7800-9',
      account_type: 'securities',
      account_type_description: 'Investment Portfolio Account',
      currency: 'CHF',
      statement_period: {
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      },
      balances: [
        { date: '2025-03-31', amount: 234500.00, label: 'Q1 Closing Balance', is_maximum: false },
        { date: '2025-06-30', amount: 289750.50, label: 'Q2 Closing Balance', is_maximum: true },
        { date: '2025-09-30', amount: 265200.00, label: 'Q3 Closing Balance', is_maximum: false },
        { date: '2025-12-31', amount: 278100.25, label: 'Year-End Balance', is_maximum: false }
      ],
      max_balance: {
        amount: 289750.50,
        date: '2025-06-30',
        label: 'Q2 Closing Balance'
      },
      confidence: {
        bank_name: 'high',
        account_number: 'medium',
        currency: 'high',
        max_balance: 'high',
        overall: 'high'
      },
      warnings: ['Account was migrated from Credit Suisse to UBS Group in 2024']
    }],
    document_language: 'en',
    document_metadata: {
      page_count: 6,
      is_multi_account: false,
      is_transaction_only: false
    }
  } as unknown as Prisma.InputJsonValue;

  const csBankAddress = {
    street: 'Paradeplatz 8',
    city: 'Zurich',
    state_province: 'ZH',
    country: 'CH',
    postal_code: '8001'
  } as unknown as Prisma.InputJsonValue;

  const csBalances = [
    { date: '2025-03-31', amount: 234500.00, label: 'Q1 Closing Balance', is_maximum: false },
    { date: '2025-06-30', amount: 289750.50, label: 'Q2 Closing Balance', is_maximum: true },
    { date: '2025-09-30', amount: 265200.00, label: 'Q3 Closing Balance', is_maximum: false },
    { date: '2025-12-31', amount: 278100.25, label: 'Year-End Balance', is_maximum: false }
  ] as unknown as Prisma.InputJsonValue;

  await prisma.extractedData.create({
    data: {
      statementId: csStatement.id,
      rawLlmResponse: csRawLlmResponse,
      bankName: 'Credit Suisse AG (UBS Group)',
      bankAddress: csBankAddress,
      accountNumber: 'CH82-0483-5012-3456-7800-9',
      accountTypeDetected: 'securities',
      currencyCode: 'CHF',
      balances: csBalances,
      maxBalanceLocal: 289750.50,
      maxBalanceDate: new Date('2025-06-30'),
      statementPeriodStart: new Date('2025-01-01'),
      statementPeriodEnd: new Date('2025-12-31'),
    },
  });
  console.log('Created Credit Suisse extracted data');

  // 4. Create two ReviewedAccountYear records
  const reviewedAt = new Date('2026-01-20T16:45:00Z');

  console.log('Creating ReviewedAccountYear for UBS...');
  const ubsMaxValueUsd = 78450.25 / CHF_EXCHANGE_RATE; // ~88,380.09
  await prisma.reviewedAccountYear.create({
    data: {
      foreignAccountId: UBS_ACCOUNT_ID,
      filingYearId: FILING_YEAR_ID,
      maxValueLocal: 78450.25,
      currencyCode: 'CHF',
      exchangeRate: CHF_EXCHANGE_RATE,
      exchangeRateSource: 'TREASURY',
      maxValueUsd: ubsMaxValueUsd,
      isValueUnknown: false,
      reviewedById: ADMIN_ID,
      reviewedAt: reviewedAt,
    },
  });
  console.log(`Created UBS ReviewedAccountYear (maxValueUsd: ${ubsMaxValueUsd.toFixed(2)})`);

  console.log('Creating ReviewedAccountYear for Credit Suisse...');
  const csMaxValueUsd = 289750.50 / CHF_EXCHANGE_RATE; // ~326,440.16
  await prisma.reviewedAccountYear.create({
    data: {
      foreignAccountId: csAccount.id,
      filingYearId: FILING_YEAR_ID,
      maxValueLocal: 289750.50,
      currencyCode: 'CHF',
      exchangeRate: CHF_EXCHANGE_RATE,
      exchangeRateSource: 'TREASURY',
      maxValueUsd: csMaxValueUsd,
      isValueUnknown: false,
      reviewedById: ADMIN_ID,
      reviewedAt: reviewedAt,
    },
  });
  console.log(`Created CS ReviewedAccountYear (maxValueUsd: ${csMaxValueUsd.toFixed(2)})`);

  // 5. Update filing year status to EXPORTED
  console.log('Updating filing year status to EXPORTED...');
  const exportedAt = new Date('2026-01-20T17:00:00Z');
  await prisma.filingYear.update({
    where: { id: FILING_YEAR_ID },
    data: {
      status: 'EXPORTED',
      reviewedById: ADMIN_ID,
      reviewedAt: reviewedAt,
      exportedAt: exportedAt,
    },
  });
  console.log('Updated filing year to EXPORTED');

  console.log('\n✅ Extraction seed completed successfully!');
  console.log('\nCreated IDs:');
  console.log(`  Credit Suisse Account: ${csAccount.id}`);
  console.log(`  UBS Statement: ${ubsStatement.id}`);
  console.log(`  CS Statement: ${csStatement.id}`);
  console.log(`\nTotal USD values:`);
  console.log(`  UBS: $${ubsMaxValueUsd.toFixed(2)}`);
  console.log(`  CS: $${csMaxValueUsd.toFixed(2)}`);
  console.log(`  Combined: $${(ubsMaxValueUsd + csMaxValueUsd).toFixed(2)}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
