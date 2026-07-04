import { NextRequest, NextResponse } from 'next/server';
import type { ResumeData } from '@/components/ResumePDF';
import { createAtsReportFromAnalysis } from '@/lib/ats/ats-service';
import { analyzeJobDescriptionDeep } from '@/lib/ats/jd-deep-analyzer';
import type { JdAnalysis } from '@/lib/ats/types';
import { createResumeChanges } from '@/lib/resume/change-preview';
import { extractResumeFacts } from '@/lib/resume/extract';
import { optimizeResume } from '@/lib/resume/optimize';
import { extractResumeText } from '@/lib/resume/pdf-text';
import { createRateLimiter, rateLimitHeaders } from '@/lib/http/rate-limit';
import { RequestValidationError, validateTailorInput } from '@/lib/http/request-validation';
import {
  cleanupExpiredJobs,
  createJob,
  getJob,
  serializeJob,
  updateJob,
} from '@/lib/tailor/job-store';

export const runtime = 'nodejs';

const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };

const rateLimit = createRateLimiter(5, 60 * 60 * 1000);

function buildJdTargets(analysis: JdAnalysis) {
  const names = (priority: string) => analysis.requirements
    .filter((item) => item.priority === priority)
    .map((item) => item.name);
  const critical = names('critical');
  const important = names('important');
  const niceToHave = names('nice-to-have');

  const lines = [
    analysis.roleTitle ? `Role: ${analysis.roleTitle}${analysis.seniority !== 'unspecified' ? ` (${analysis.seniority})` : ''}` : '',
    analysis.summary ? `What the employer values: ${analysis.summary}` : '',
    critical.length ? `CRITICAL requirements (highest priority): ${critical.join(', ')}` : '',
    important.length ? `IMPORTANT requirements: ${important.join(', ')}` : '',
    niceToHave.length ? `Nice-to-have: ${niceToHave.join(', ')}` : '',
    analysis.responsibilities.length ? `Key responsibilities to mirror where source-supported:\n${analysis.responsibilities.map((item) => `- ${item}`).join('\n')}` : '',
    analysis.atsKeywords.length ? `ATS keyword phrases to use verbatim where source-supported: ${analysis.atsKeywords.join(', ')}` : '',
    analysis.qualifications.experienceYears ? `Experience requirement: ${analysis.qualifications.experienceYears}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}

function resumeDataToText(data: ResumeData) {
  return [
    data.name,
    data.contact,
    data.summary,
    data.skills.join(', '),
    ...(data.skillGroups?.map((group) => `${group.label}: ${group.skills.join(', ')}`) ?? []),
    ...data.experience.flatMap((item) => [`${item.title} ${item.organization} ${item.duration}`, ...item.bullets]),
    ...data.projects.flatMap((item) => [`${item.title} ${item.organization} ${item.duration}`, ...item.bullets]),
    ...data.education.map((item) => `${item.degree} ${item.institution} ${item.duration}`),
    ...data.additionalInformation.map((item) => `${item.label}: ${item.value}`),
  ].filter(Boolean).join('\n');
}

async function processTailorJob(jobId: string, fileValue: File, jdValue: string) {
  updateJob(jobId, {
    status: 'processing',
    updatedAt: Date.now(),
  });

  try {
    const resumeText = await extractResumeText(fileValue);

    // Phase 1: locked facts (cached per resume) + deep JD analysis (cached per JD).
    const [facts, jdAnalysis] = await Promise.all([
      extractResumeFacts(resumeText),
      analyzeJobDescriptionDeep(jdValue),
    ]);
    const atsReport = createAtsReportFromAnalysis(resumeText, jdAnalysis);
    const jdTargets = buildJdTargets(jdAnalysis);

    // Phase 2: the model only returns summary/skills-order/bullets; every factual
    // field in tailoredData is copied from the extracted facts in code.
    const tailoredData = await optimizeResume(facts, jdTargets, resumeText);

    const resumeChanges = createResumeChanges(resumeText, tailoredData, facts);
    const tailoredReport = createAtsReportFromAnalysis(resumeDataToText(tailoredData), jdAnalysis);

    updateJob(jobId, {
      status: 'completed',
      updatedAt: Date.now(),
      result: {
        atsScore: atsReport.atsScore,
        gapAnalysis: atsReport.gapAnalysis,
        keywordAnalysis: atsReport.keywordAnalysis,
        jdAnalysis: atsReport.jdAnalysis,
        tailoredAtsScore: {
          score: tailoredReport.atsScore.score,
          breakdown: tailoredReport.atsScore.breakdown,
        },
        resumeChanges,
        tailoredData,
        addedKeywords: tailoredData.addedKeywords,
        pdfGeneration: {
          mode: 'client',
          // Frontend should use @react-pdf/renderer in the browser to render <ResumePDF data={tailoredData} /> into a Blob.
          instruction: 'Generate the PDF on the client with @react-pdf/renderer using the returned tailoredData JSON.',
        },
      },
    });
  } catch (error: unknown) {
    console.error('Error processing tailor job:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const validationErrors = error instanceof Error && Array.isArray((error as Error & { validationErrors?: string[] }).validationErrors)
      ? (error as Error & { validationErrors?: string[] }).validationErrors
      : undefined;
    updateJob(jobId, {
      status: 'failed',
      updatedAt: Date.now(),
      error: message,
      validationErrors,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    cleanupExpiredJobs();

    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({
        error: 'Too many resume tailoring requests. Please try again after the hourly rate limit resets.',
        resetAt: new Date(limit.resetAt).toISOString(),
      }, {
        status: 429,
        headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
      });
    }

    const formData = await req.formData();
    const { jd, resume } = validateTailorInput(formData.get('jd'), formData.get('resume'));

    const jobId = createJob();
    void processTailorJob(jobId, resume, jd);

    return NextResponse.json({
      jobId,
      status: 'pending',
      pollUrl: `/api/tailor?jobId=${jobId}`,
    }, {
      status: 202,
      headers: { ...JSON_HEADERS, ...rateLimitHeaders(limit) },
    });
  } catch (error: unknown) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: JSON_HEADERS },
      );
    }

    console.error('Error creating tailor job:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}

export async function GET(req: NextRequest) {
  cleanupExpiredJobs();

  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400, headers: JSON_HEADERS });
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: 'Tailor job not found or expired' }, { status: 404, headers: JSON_HEADERS });
  }

  return NextResponse.json(serializeJob(job), { headers: JSON_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
