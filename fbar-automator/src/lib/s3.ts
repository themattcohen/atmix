import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

// Helper to get S3 credentials with production safety
function getS3Credentials() {
  const isProduction = process.env.NODE_ENV === 'production'
  const accessKeyId = process.env.S3_ACCESS_KEY
  const secretAccessKey = process.env.S3_SECRET_KEY

  if (isProduction) {
    if (!accessKeyId) throw new Error('S3_ACCESS_KEY is required in production')
    if (!secretAccessKey) throw new Error('S3_SECRET_KEY is required in production')
  }

  return {
    accessKeyId: accessKeyId || 'minioadmin',
    secretAccessKey: secretAccessKey || 'minioadmin',
  }
}

// Lazy-initialized S3 clients (prevents build-time credential check)
let _s3Client: S3Client | null = null
let _s3PublicClient: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
      forcePathStyle: true, // Required for MinIO
      credentials: getS3Credentials(),
    })
  }
  return _s3Client
}

// Separate client for presigned URLs — uses browser-accessible endpoint
// so the HMAC signature matches the hostname the browser will use.
function getS3PublicClient(): S3Client {
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT
  if (!publicEndpoint) return getS3Client()
  if (!_s3PublicClient) {
    _s3PublicClient = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: publicEndpoint,
      forcePathStyle: true,
      credentials: getS3Credentials(),
    })
  }
  return _s3PublicClient
}

const BUCKET = process.env.S3_BUCKET || "fbar-statements"

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const isMinIO = (process.env.S3_ENDPOINT || "").includes("minio") || (process.env.S3_ENDPOINT || "").includes("9000")
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(isMinIO ? {} : { ServerSideEncryption: "AES256" as const }),
    })
  )
}

export async function getFileUrl(key: string, expiresIn = 900): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  // Use the public client so the presigned URL signature matches the
  // browser-accessible hostname (localhost:9000 instead of minio:9000).
  return getSignedUrl(getS3PublicClient(), command, { expiresIn })
}

export async function getFileBuffer(key: string): Promise<Buffer> {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
  const stream = response.Body
  if (!stream) throw new Error("Empty response body")
  const chunks: Uint8Array[] = []
  // @ts-expect-error - stream is readable
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function deleteFile(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

// Export getter for backward compatibility
const s3Client = { get client() { return getS3Client() } }
export { s3Client, BUCKET }
