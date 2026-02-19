/**
 * Encryption Key Rotation Script (P5-4)
 *
 * Re-encrypts all encrypted fields (User.tin, ForeignAccount.accountNumber)
 * from the old key to the new key with the v1: version prefix.
 *
 * Prerequisites:
 *   - ENCRYPTION_KEY    = new 64-hex-char key
 *   - ENCRYPTION_KEY_PREV = old 64-hex-char key (the key data was encrypted with)
 *   - DATABASE_URL      = Postgres connection string
 *
 * Usage:
 *   npx tsx scripts/rotate-encryption-key.ts
 *   npx tsx scripts/rotate-encryption-key.ts --dry-run
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const VERSION_PREFIX = "v1";
const BATCH_SIZE = 100;
const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Key helpers (standalone — does not import from src/lib to keep script self-contained)
// ---------------------------------------------------------------------------

function parseKey(hex: string | undefined, label: string): Buffer {
  if (!hex) throw new Error(`${label} environment variable is required`);
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`${label} must be 64 hex characters (32 bytes), got ${buf.length} bytes`);
  }
  return buf;
}

function decryptWithKey(
  encrypted: string,
  keys: Buffer[]
): string {
  if (!encrypted) return "";

  const parts = encrypted.split(":");

  let ivHex: string;
  let authTagHex: string;
  let cipherHex: string;

  if (parts.length === 4 && parts[0] === VERSION_PREFIX) {
    [, ivHex, authTagHex, cipherHex] = parts;
  } else if (parts.length === 3) {
    [ivHex, authTagHex, cipherHex] = parts;
  } else {
    throw new Error(`Invalid encrypted format: ${parts.length} parts`);
  }

  const iv = Buffer.from(ivHex!, "hex");
  const authTag = Buffer.from(authTagHex!, "hex");
  const ciphertext = Buffer.from(cipherHex!, "hex");

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
    } catch {
      // Try next key
    }
  }
  throw new Error("Decryption failed with all available keys");
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function isAlreadyRotated(encrypted: string): boolean {
  return encrypted.startsWith(`${VERSION_PREFIX}:`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Encryption Key Rotation Script ===");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log();

  const newKey = parseKey(process.env.ENCRYPTION_KEY, "ENCRYPTION_KEY");
  const oldKey = parseKey(process.env.ENCRYPTION_KEY_PREV, "ENCRYPTION_KEY_PREV");

  // Try both keys for decryption: new key first (for already-rotated rows), then old key
  const decryptionKeys = [newKey, oldKey];

  const prisma = new PrismaClient();

  try {
    // -----------------------------------------------------------------------
    // 1. Rotate User.tin
    // -----------------------------------------------------------------------
    console.log("--- Rotating User.tin ---");
    const users = await prisma.user.findMany({
      where: { tin: { not: null } },
      select: { id: true, tin: true },
    });
    console.log(`Found ${users.length} users with encrypted TIN`);

    let userRotated = 0;
    let userSkipped = 0;
    let userFailed = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          for (const user of batch) {
            if (!user.tin) continue;

            if (isAlreadyRotated(user.tin)) {
              userSkipped++;
              continue;
            }

            try {
              const plaintext = decryptWithKey(user.tin, decryptionKeys);
              const reEncrypted = encryptWithKey(plaintext, newKey);

              await tx.user.update({
                where: { id: user.id },
                data: { tin: reEncrypted },
              });
              userRotated++;
            } catch (err) {
              userFailed++;
              console.error(`  FAIL User ${user.id}: ${err instanceof Error ? err.message : err}`);
            }
          }
        });
      } else {
        // Dry run: just test decryption
        for (const user of batch) {
          if (!user.tin) continue;
          if (isAlreadyRotated(user.tin)) {
            userSkipped++;
            continue;
          }
          try {
            decryptWithKey(user.tin, decryptionKeys);
            userRotated++;
          } catch (err) {
            userFailed++;
            console.error(`  FAIL User ${user.id}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }

      console.log(`  Processed ${Math.min(i + BATCH_SIZE, users.length)}/${users.length} users`);
    }

    console.log(`  Rotated: ${userRotated}, Skipped (already v1): ${userSkipped}, Failed: ${userFailed}`);
    console.log();

    // -----------------------------------------------------------------------
    // 2. Rotate ForeignAccount.accountNumber
    // -----------------------------------------------------------------------
    console.log("--- Rotating ForeignAccount.accountNumber ---");
    const accounts = await prisma.foreignAccount.findMany({
      select: { id: true, accountNumber: true },
    });
    console.log(`Found ${accounts.length} accounts with encrypted accountNumber`);

    let acctRotated = 0;
    let acctSkipped = 0;
    let acctFailed = 0;

    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);

      if (!DRY_RUN) {
        await prisma.$transaction(async (tx) => {
          for (const acct of batch) {
            if (!acct.accountNumber) continue;

            if (isAlreadyRotated(acct.accountNumber)) {
              acctSkipped++;
              continue;
            }

            try {
              const plaintext = decryptWithKey(acct.accountNumber, decryptionKeys);
              const reEncrypted = encryptWithKey(plaintext, newKey);

              await tx.foreignAccount.update({
                where: { id: acct.id },
                data: { accountNumber: reEncrypted },
              });
              acctRotated++;
            } catch (err) {
              acctFailed++;
              console.error(`  FAIL Account ${acct.id}: ${err instanceof Error ? err.message : err}`);
            }
          }
        });
      } else {
        for (const acct of batch) {
          if (!acct.accountNumber) continue;
          if (isAlreadyRotated(acct.accountNumber)) {
            acctSkipped++;
            continue;
          }
          try {
            decryptWithKey(acct.accountNumber, decryptionKeys);
            acctRotated++;
          } catch (err) {
            acctFailed++;
            console.error(`  FAIL Account ${acct.id}: ${err instanceof Error ? err.message : err}`);
          }
        }
      }

      console.log(`  Processed ${Math.min(i + BATCH_SIZE, accounts.length)}/${accounts.length} accounts`);
    }

    console.log(`  Rotated: ${acctRotated}, Skipped (already v1): ${acctSkipped}, Failed: ${acctFailed}`);
    console.log();

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------
    const totalFailed = userFailed + acctFailed;
    console.log("=== Summary ===");
    console.log(`Users:    ${userRotated} rotated, ${userSkipped} skipped, ${userFailed} failed`);
    console.log(`Accounts: ${acctRotated} rotated, ${acctSkipped} skipped, ${acctFailed} failed`);

    if (totalFailed > 0) {
      console.error(`\n${totalFailed} row(s) failed — review errors above.`);
      process.exit(1);
    }

    if (DRY_RUN) {
      console.log("\nDry run complete — no data was modified.");
    } else {
      console.log("\nRotation complete. You can now remove ENCRYPTION_KEY_PREV from env.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
