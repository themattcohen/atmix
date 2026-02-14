import { randomUUID } from "crypto"
import { uploadFile } from "./s3"

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
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
}

interface UploadResult {
  key: string
  fileName: string
  fileType: string
  fileSizeBytes: number
}

export function validateFile(file: { name: string; type: string; size: number }): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return `File type "${file.type}" is not supported. Accepted: PDF, JPEG, PNG, HEIC, TIFF.`
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

  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf"
  const key = `${practiceId}/${filingYearId}/${randomUUID()}.${extension}`

  const buffer = Buffer.from(await file.arrayBuffer())

  // Validate file content matches declared MIME type
  if (!validateMagicBytes(buffer, file.type)) {
    throw new Error(`File content does not match declared type "${file.type}". Possible file corruption or spoofing.`)
  }

  await uploadFile(key, buffer, file.type)

  return {
    key,
    fileName: file.name,
    fileType: extension,
    fileSizeBytes: file.size,
  }
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || ""
}
