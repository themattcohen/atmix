import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto"

const ALGORITHM = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 16

/**
 * Derive a 256-bit encryption key from the ENCRYPTION_KEY env var using scrypt.
 *
 * scrypt is a memory-hard KDF which makes brute-force attacks against the key
 * significantly more expensive than PBKDF2 or plain SHA-256 hashing.
 *
 * @param salt - Random salt for key derivation (enhances security)
 */
function getKey(salt: Buffer): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is not set. " +
        "Generate one with: openssl rand -hex 32"
    )
  }
  return scryptSync(key, salt, KEY_LENGTH)
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns a colon-delimited string: salt:iv:authTag:ciphertext (all hex-encoded).
 * The auth tag provides authenticated encryption -- any tampering with the
 * ciphertext or IV will cause decryption to fail.
 * A random salt is generated per encryption to enhance key derivation security.
 */
export function encrypt(text: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = getKey(salt)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  return [salt.toString("hex"), iv.toString("hex"), authTag.toString("hex"), encrypted].join(":")
}

/**
 * Decrypt a string that was encrypted with `encrypt()`.
 *
 * Expects the colon-delimited format: salt:iv:authTag:ciphertext.
 * Throws if the data has been tampered with or the key is wrong.
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":")

  if (parts.length !== 4) {
    throw new Error("Invalid encrypted text format")
  }

  const [saltHex, ivHex, authTagHex, ciphertext] = parts
  const salt = Buffer.from(saltHex, "hex")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const key = getKey(salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Safely decrypt a string, returning the original value if it's not in
 * encrypted format. Useful for backward compatibility during migration
 * from plaintext to encrypted storage.
 */
export function safeDecrypt(value: string): string {
  const parts = value.split(":")
  if (parts.length !== 4) {
    return value
  }
  try {
    return decrypt(value)
  } catch {
    return value
  }
}
