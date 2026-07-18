// Live healthcheck for the Cloudflare R2 bucket: upload → list → presigned GET → delete.
// Run from backend/: node scripts/r2-healthcheck.mjs
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Agent } from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const insecure = env.S3_ALLOW_SELF_SIGNED === 'true';
if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION || 'auto',
  credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
  ...(insecure
    ? { requestHandler: new NodeHttpHandler({ httpsAgent: new Agent({ rejectUnauthorized: false }) }) }
    : {}),
});

const bucket = env.S3_BUCKET_PRIVATE;
const key = `healthcheck/r2-test-${Date.now()}.txt`;
const body = `applyKro R2 healthcheck ${new Date().toISOString()}`;

console.log('1. Upload to', bucket, key);
await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'text/plain' }));
console.log('   OK');

console.log('2. List bucket');
const list = await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
console.log('   OK, objects:', (list.Contents ?? []).length);

console.log('3. Presigned GET (5 min)');
const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
const res = await fetch(url);
const text = await res.text();
console.log('   HTTP', res.status, 'roundtrip match:', text === body);

console.log('4. Cleanup');
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log('   OK — R2 fully working');
