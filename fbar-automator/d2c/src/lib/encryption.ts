import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const VERSION_PREFIX = "v1";

function parseKey(hex: string, label: string): Buffer {
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error(`${label} must be 64 hex characters (32 bytes), got ${buf.length} bytes`);
  }
  return buf;
}

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY environment variable is required");
  return parseKey(key, "ENCRYPTION_KEY");
}

function getPrevKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY_PREV;
  if (!key) return null;
  return parseKey(key, "ENCRYPTION_KEY_PREV");
}

function decryptWithKey(iv: Buffer, authTag: Buffer, ciphertext: Buffer, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext, undefined, "utf8") + decipher.final("utf8");
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${VERSION_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encrypted: string): string {
  if (!encrypted) return "";

  const parts = encrypted.split(":");

  let ivHex: string;
  let authTagHex: string;
  let cipherHex: string;

  if (parts.length === 4 && parts[0] === VERSION_PREFIX) {
    // New versioned format: v1:iv:authTag:ciphertext
    [, ivHex, authTagHex, cipherHex] = parts;
  } else if (parts.length === 3) {
    // Legacy unversioned format: iv:authTag:ciphertext
    [ivHex, authTagHex, cipherHex] = parts;
  } else {
    throw new Error("Invalid encrypted format");
  }

  if (!ivHex || !authTagHex || !cipherHex) throw new Error("Invalid encrypted format");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(cipherHex, "hex");

  // Try current key first
  try {
    return decryptWithKey(iv, authTag, ciphertext, getKey());
  } catch (primaryError) {
    // For legacy (unversioned) format, try previous key if available
    const prevKey = getPrevKey();
    if (prevKey) {
      try {
        return decryptWithKey(iv, authTag, ciphertext, prevKey);
      } catch {
        // Both keys failed — throw the original error
        throw primaryError;
      }
    }
    throw primaryError;
  }
}

export function safeDecrypt(encrypted: string | null | undefined): string {
  if (!encrypted) return "";
  try {
    return decrypt(encrypted);
  } catch {
    console.warn("Decryption failed — may indicate key rotation or data corruption");
    return "";
  }
}
