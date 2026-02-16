import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
      forcePathStyle: true, // Required for MinIO
    });
  }
  return s3Client;
}

let s3PublicClient: S3Client | null = null;

function getS3PublicClient(): S3Client {
  if (!s3PublicClient) {
    s3PublicClient = new S3Client({
      endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
      forcePathStyle: true,
    });
  }
  return s3PublicClient;
}

const getBucket = () => process.env.S3_BUCKET || "fbar-direct";

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function downloadFile(key: string): Promise<Buffer> {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
  const stream = response.Body;
  if (!stream) throw new Error(`File not found: ${key}`);
  return Buffer.from(await stream.transformToByteArray());
}

export async function getPresignedUrl(
  key: string,
  expiresIn: number = 300
): Promise<string> {
  return getSignedUrl(
    getS3PublicClient(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
    { expiresIn }
  );
}

export async function deleteFile(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    })
  );
}
