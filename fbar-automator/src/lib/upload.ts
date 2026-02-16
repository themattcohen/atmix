import { randomUUID } from "crypto"
import { uploadFile } from "./s3"

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Magic bytes for file type validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "application/pdf": [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  "image/jpeg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  "image/tiff": [
    Buffer.from([0x49, 0x49, 0x2A, 0x00]), // Little-endian
    Buffer.from([0x4D, 0x4D, 0x00, 0x2A]), // Big-endian
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    Buffer.from([0x50, 0x4B, 0x03, 0x04]),  // PK (ZIP signature)
  ],
}

interface UploadResult {
  key: string
  fileName: string
  fileType: string
  fileSizeBytes: number
}

function normalizeMimeType(file: { name: string; type: string }): string {
  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext === "csv" && (file.type === "text/plain" || file.type === "application/octet-stream" || !file.type)) {
    return "text/csv"
  }
  if (ext === "xlsx" && (file.type === "application/octet-stream" || !file.type)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
  return file.type
}

export function validateFile(file: { name: string; type: string; size: number }): string | null {
  const mimeType = normalizeMimeType(file)
  if (!ALLOWED_TYPES.has(mimeType)) {
    return `File type "${file.type}" is not supported. Accepted: PDF, JPEG, PNG, HEIC, TIFF, CSV, Excel (.xlsx).`
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the 50MB limit.`
  }
  if (file.size === 0) {
    return "File is empty."
  }
  return null
}

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  // Skip validation for HEIC (uses ISO BMFF container format, complex to validate)
  if (mimeType === "image/heic") {
    return true
  }

  if (mimeType === "text/csv") {
    return true
  }

  const expectedBytes = MAGIC_BYTES[mimeType]
  if (!expectedBytes) {
    return true // No magic bytes defined, skip validation
  }

  // Check if buffer matches any of the expected magic byte patterns
  return expectedBytes.some((magicBytes) => {
    if (buffer.length < magicBytes.length) {
      return false
    }
    return buffer.subarray(0, magicBytes.length).equals(magicBytes)
  })
}

export async function processUpload(
  file: File,
  practiceId: string,
  filingYearId: string
): Promise<UploadResult> {
  const error = validateFile(file)
  if (error) throw new Error(error)

  const normalizedType = normalizeMimeType(file)
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf"
  const key = `${practiceId}/${filingYearId}/${randomUUID()}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate file content matches declared MIME type
  if (!validateMagicBytes(buffer, normalizedType)) {
    throw new Error(`File content does not match declared type "${normalizedType}". Possible file corruption or spoofing.`)
  }

  await uploadFile(key, buffer, normalizedType)

  return {
    key,
    fileName: file.name,
    fileType: normalizedType,
    fileSizeBytes: file.size,
  }
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}
