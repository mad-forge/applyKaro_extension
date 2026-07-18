import { Agent } from 'node:https';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { randomUUID } from 'node:crypto';

// R2 presigned URLs are capped at 7 days.
const DOWNLOAD_URL_TTL_SECONDS = 7 * 24 * 60 * 60;

const S3_ALLOW_SELF_SIGNED = process.env.S3_ALLOW_SELF_SIGNED === 'true';

let cachedClient: S3Client | null = null;

export function isR2Configured() {
  return Boolean(
    process.env.S3_ENDPOINT
    && process.env.S3_ACCESS_KEY_ID
    && process.env.S3_SECRET_ACCESS_KEY
    && process.env.S3_BUCKET_PRIVATE,
  );
}

function getClient(): S3Client {
  if (cachedClient) return cachedClient;

  if (!isR2Configured()) {
    throw new Error('R2 storage is not configured. Add S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET_PRIVATE to backend/.env.local.');
  }

  cachedClient = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'auto',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    ...(S3_ALLOW_SELF_SIGNED
      ? {
        requestHandler: new NodeHttpHandler({
          httpsAgent: new Agent({ rejectUnauthorized: false }),
        }),
      }
      : {}),
  });

  return cachedClient;
}

function sanitizeBaseName(name: string) {
  const cleaned = name
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'resume';
}

export interface StoredPdf {
  key: string;
  downloadUrl: string;
  expiresAt: string;
}

export async function uploadTailoredPdf(buffer: Buffer, originalName: string): Promise<StoredPdf> {
  const client = getClient();
  const bucket = process.env.S3_BUCKET_PRIVATE as string;
  const now = new Date();
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const baseName = sanitizeBaseName(originalName);
  const key = `tailored/${month}/${randomUUID()}/${baseName}.pdf`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
    ContentDisposition: `attachment; filename="${baseName}.pdf"`,
  }));

  const downloadUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );

  return {
    key,
    downloadUrl,
    expiresAt: new Date(Date.now() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}
