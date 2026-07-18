import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, extractJsonObject, isOpenRouterConfigured } from '@/lib/ai/openrouter';
import { createRateLimiter, rateLimitHeaders } from '@/lib/http/rate-limit';

export const runtime = 'nodejs';

const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };
const MAX_INPUT_CHARS = 30_000;
const MIN_INPUT_CHARS = 200;

const rateLimit = createRateLimiter(30, 60 * 60 * 1000);

const EXTRACT_PROMPT = `You are a text-cleaning filter. The user sends the readable text of a web page that may contain a job description surrounded by unrelated content (navigation, ads, cookie banners, related jobs, comments, footers).

Return strict JSON:
{"isJobDescription": boolean, "jd": string}

Rules:
- If the text contains a job description, set isJobDescription true and put ONLY the job description in "jd": the role, responsibilities, requirements/qualifications, and any skills, compensation, or location details that belong to THIS job posting.
- Keep the original wording of the job description verbatim. Do not summarize, rewrite, or translate. Preserve line breaks between sections and bullets.
- Drop everything that is not part of this job posting (menus, "similar jobs", company boilerplate unrelated to the role, comments).
- If there is no job description in the text, return {"isJobDescription": false, "jd": ""}.`;

export async function POST(req: NextRequest) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { error: 'AI is not configured on this server.' },
        { status: 503, headers: JSON_HEADERS },
      );
    }

    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({
        error: 'Too many extraction requests. Please try again later.',
        resetAt: new Date(limit.resetAt).toISOString(),
      }, {
        status: 429,
        headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
      });
    }

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (text.length < MIN_INPUT_CHARS) {
      return NextResponse.json(
        { error: `Send at least ${MIN_INPUT_CHARS} characters of page text.` },
        { status: 400, headers: JSON_HEADERS },
      );
    }

    const content = await chatCompletion({
      temperature: 0,
      maxTokens: 8_000,
      timeoutMs: 60_000,
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: text.slice(0, MAX_INPUT_CHARS) },
      ],
    });

    const parsed = JSON.parse(extractJsonObject(content)) as {
      isJobDescription?: boolean;
      jd?: string;
    };

    const jd = typeof parsed.jd === 'string' ? parsed.jd.trim() : '';
    return NextResponse.json({
      isJobDescription: Boolean(parsed.isJobDescription) && jd.length > 0,
      jd,
    }, {
      headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
    });
  } catch (error: unknown) {
    console.error('Error extracting JD:', error);
    const message = error instanceof Error ? error.message : 'Could not extract the job description.';
    return NextResponse.json(
      { error: message },
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
