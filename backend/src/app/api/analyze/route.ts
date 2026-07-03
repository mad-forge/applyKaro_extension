import { NextRequest, NextResponse } from 'next/server';
import { createAtsReport } from '@/lib/ats/ats-service';
import { extractPdfText } from '@/lib/resume/pdf-text';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const jd = formData.get('jd');
    const resume = formData.get('resume');
    if (typeof jd !== 'string' || !jd.trim() || !(resume instanceof File)) {
      return NextResponse.json({ error: 'Missing PDF resume or job description' }, { status: 400 });
    }

    const resumeText = await extractPdfText(resume);
    return NextResponse.json(createAtsReport(resumeText, jd), {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze resume';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } },
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
