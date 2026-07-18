import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter, rateLimitHeaders } from '@/lib/http/rate-limit';
import { isR2Configured, uploadTailoredPdf } from '@/lib/storage/r2';

export const runtime = 'nodejs';

const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };
const MAX_PDF_BYTES = 8 * 1024 * 1024;

const rateLimit = createRateLimiter(20, 60 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: 'Cloud storage is not configured on this server.' },
        { status: 503, headers: JSON_HEADERS },
      );
    }

    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({
        error: 'Too many uploads. Please try again after the hourly rate limit resets.',
        resetAt: new Date(limit.resetAt).toISOString(),
      }, {
        status: 429,
        headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
      });
    }

    const formData = await req.formData();
    const file = formData.get('pdf');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "pdf" file field.' },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: 'PDF is too large (max 8 MB).' },
        { status: 413, headers: JSON_HEADERS },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json(
        { error: 'File is not a valid PDF.' },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const stored = await uploadTailoredPdf(buffer, file.name || 'tailored-resume.pdf');

    return NextResponse.json(stored, {
      status: 201,
      headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
    });
  } catch (error: unknown) {
    console.error('Error uploading tailored PDF:', error);
    return NextResponse.json(
      { error: 'Could not upload the PDF to cloud storage. Please try again.' },
      { status: 502, headers: JSON_HEADERS },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
