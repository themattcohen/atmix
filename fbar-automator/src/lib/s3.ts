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

// Lazy-initialized S3 client (prevents build-time credential check)
let _s3Client: S3Client | null = null

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
  let url = await getSignedUrl(getS3Client(), command, { expiresIn })

  // Presigned URLs contain the S3_ENDPOINT hostname. Inside Docker this is
  // "minio:9000" which the browser can't reach. Replace with the public
  // endpoint so the browser can fetch the file directly.
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT
  const internalEndpoint = process.env.S3_ENDPOINT
  if (publicEndpoint && internalEndpoint && url.startsWith(internalEndpoint)) {
    url = publicEndpoint + url.slice(internalEndpoint.length)
  }

  return url
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
