import { NextRequest, NextResponse } from 'next/server';
import { createAtsReportDeep } from '@/lib/ats/ats-service';
import { extractResumeText } from '@/lib/resume/pdf-text';
import { createRateLimiter, rateLimitHeaders } from '@/lib/http/rate-limit';
import { RequestValidationError, validateTailorInput } from '@/lib/http/request-validation';

export const runtime = 'nodejs';

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };
const rateLimit = createRateLimiter(20, 60 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({
        error: 'Too many analysis requests. Please try again after the hourly rate limit resets.',
        resetAt: new Date(limit.resetAt).toISOString(),
      }, {
        status: 429,
        headers: { ...CORS_HEADERS, ...rateLimitHeaders(limit) },
      });
    }

    const formData = await req.formData();
    const { jd, resume } = validateTailorInput(formData.get('jd'), formData.get('resume'));

    const resumeText = await extractResumeText(resume);
    const report = await createAtsReportDeep(resumeText, jd);

    return NextResponse.json(report, {
      headers: { ...CORS_HEADERS, ...rateLimitHeaders(limit) },
    });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: CORS_HEADERS },
      );
    }

    console.error('Error analyzing resume:', error);
    const message = error instanceof Error ? error.message : 'Unable to analyze resume';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS },
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
