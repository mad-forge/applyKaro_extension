import { NextRequest, NextResponse } from 'next/server';
import type { ResumeData } from '@/components/ResumePDF';
import { chatCompletion } from '@/lib/ai/openrouter';
import { createAtsReportFromAnalysis } from '@/lib/ats/ats-service';
import { analyzeJobDescriptionDeep } from '@/lib/ats/jd-deep-analyzer';
import type { JdAnalysis } from '@/lib/ats/types';
import { createResumeChanges } from '@/lib/resume/change-preview';
import {
  ensureRequiredAdditionalSections,
  sanitizeOptionalData,
  validateTailoredData,
} from '@/lib/resume/factual-validation';
import { parseModelResume } from '@/lib/resume/parse-model-resume';
import { extractPdfText } from '@/lib/resume/pdf-text';
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

const TAILOR_TIMEOUT_MS = 60_000;
const MAX_JD_MODEL_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 6_500;
const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };

const rateLimit = createRateLimiter(5, 60 * 60 * 1000);

const SYSTEM_PROMPT = `
You are an elite ATS-optimizing resume tailor and career strategist. Bridge the gap between the candidate's source resume and the target job description while preserving factual accuracy.

CORE RULES:
1. SMART RE-FRAMING:
- Rewrite summary and bullets using the exact vocabulary and keywords from the JD when the same skill, tool, responsibility, or outcome is already present or strongly implied in the source resume.
- Translate weak wording into recruiter/ATS-friendly phrasing without adding unsupported technologies, metrics, responsibilities, or achievements.

2. PRIORITIZED KEYWORD TARGETING:
- You will receive a PRIORITIZED JD ANALYSIS listing critical, important, and nice-to-have requirements plus exact ATS keyword phrases.
- Work through it in priority order: every CRITICAL requirement that has genuine source-resume evidence must surface in the summary, the top skills, or a top bullet, using the JD's exact terminology.
- Then cover IMPORTANT requirements, then nice-to-haves, but only where source evidence exists.
- Where the resume expresses a skill with different wording than the JD (e.g. "unit specs" vs "unit testing"), rewrite using the JD terminology.
- Mirror the JD's responsibility phrasing in bullets that genuinely describe equivalent source-supported work.

3. KEYWORD PRIORITIZATION & ORDERING:
- Recruiters read top-down. Reorder bullets under each experience/project so the top 1-2 bullets match the JD's critical requirements most closely.
- Push less relevant tasks lower while preserving useful source-supported content.
- Skills should be ordered by JD relevance (critical first), but every skill must be explicitly present in the source resume.

4. TARGETED & HIGH-IMPACT SUMMARY:
- Rewrite the Professional Summary as a direct pitch for this JD.
- If the candidate's source title contains multiple roles (e.g., 'QA Analyst | Frontend Developer'), explicitly lead the summary with the role that best matches the target JD.
- The first sentence must include actual years of experience only when directly present in the source resume, plus the strongest JD-matching source-supported skills.
- Avoid fluffy adjectives. Be objective, concise, and evidence-based.

5. ZERO HALLUCINATION & HONEST GAP HANDLING:
- Never invent, infer, estimate, modernize, or "correct" dates, employers, job titles, institutions, degrees, project names, contact details, or personal facts.
- Copy factual fields exactly as written in the source resume. If a duration is missing, return an empty string. Never create a date range.
- Keep employment and projects separate. Never convert a project, client, website, religious organization, academic item, or personal item into employment.
- If the JD requires a skill and there is zero evidence of it in the source resume, do not add it anywhere in the tailored resume or addedKeywords. The backend ATS report will expose it as a capability gap.

6. CRITICAL RULE FOR addedKeywords:
- Every single string listed in 'addedKeywords' MUST be an exact physical substring of the text you just generated in the 'summary', 'experience', or 'projects' sections.
- Do NOT list a keyword in the array if you did not explicitly write it in your tailored output.

PRESERVATION RULES:
- Do not remove relevant source projects, education, languages, personal details, or other useful sections merely to shorten the resume.
- For every experience, project, education, and additional-information item, include a short verbatim sourceEvidence excerpt proving its factual fields. Evidence is for server validation and will not appear in the PDF.
- Prefer one or two dense ATS-friendly pages. Use concise bullets without losing factual accuracy.
- Include no more than 7 bullets per experience and 3 bullets per project.
- Preserve source sections for Education, Projects, Languages, and Personal Details when present.

Return ONLY one complete valid minified JSON object matching this schema. Do not include markdown, comments, explanations, or text outside the JSON:
{
  "name": "exact source name",
  "contact": "exact source contact details, combined into one string",
  "summary": "tailored but factual summary",
  "skills": ["source-supported skill"],
  "experience": [
    {
      "title": "exact source job title",
      "organization": "exact source employer",
      "duration": "exact source duration or empty string",
      "bullets": ["factual tailored bullet"],
      "sourceEvidence": "short verbatim source excerpt"
    }
  ],
  "projects": [
    {
      "title": "exact source project name",
      "organization": "exact source organization/client or empty string",
      "duration": "exact source duration or empty string",
      "bullets": ["factual tailored bullet"],
      "sourceEvidence": "short verbatim source excerpt"
    }
  ],
  "education": [
    {
      "institution": "exact source institution",
      "degree": "exact source degree",
      "duration": "exact source duration or empty string",
      "sourceEvidence": "short verbatim source excerpt"
    }
  ],
  "additionalInformation": [
    {
      "label": "source section label, such as Languages",
      "value": "exact source-supported value",
      "sourceEvidence": "short verbatim source excerpt"
    }
  ],
  "addedKeywords": [
    {
      "keyword": "exact substring physically present in the generated tailored text above",
      "location": "summary or experience or projects"
    }
  ]
}
`;

function compactForModel(value: string) {
  return value
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function limitJdForModel(jd: string) {
  const compacted = compactForModel(jd);
  if (compacted.length <= MAX_JD_MODEL_CHARS) return compacted;
  return `${compacted.slice(0, MAX_JD_MODEL_CHARS)}

[JD truncated for speed: use the visible requirements above as keyword guidance only.]`;
}

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
    ...data.experience.flatMap((item) => [`${item.title} ${item.organization} ${item.duration}`, ...item.bullets]),
    ...data.projects.flatMap((item) => [`${item.title} ${item.organization} ${item.duration}`, ...item.bullets]),
    ...data.education.map((item) => `${item.degree} ${item.institution} ${item.duration}`),
    ...data.additionalInformation.map((item) => `${item.label}: ${item.value}`),
  ].filter(Boolean).join('\n');
}

async function requestTailoredResume(
  resumeText: string,
  jd: string,
  jdTargets: string,
  correctionErrors: string[] = [],
  jsonRetryMessage = '',
): Promise<ResumeData> {
  const modelResumeText = compactForModel(resumeText);
  const modelJd = limitJdForModel(jd);
  const correction = correctionErrors.length > 0
    ? `\nYour previous response failed factual validation. Correct every issue below. Copy the exact source spelling/value; if you cannot find exact support, omit that item instead of guessing:\n- ${correctionErrors.join('\n- ')}\n`
    : '';
  const jsonCorrection = jsonRetryMessage ? `\n${jsonRetryMessage}\n` : '';

  const content = await chatCompletion({
    timeoutMs: TAILOR_TIMEOUT_MS,
    maxTokens: MAX_OUTPUT_TOKENS,
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `${correction}${jsonCorrection}
--- SOURCE RESUME (ONLY SOURCE OF FACTS) ---
${modelResumeText}

--- TARGET JOB DESCRIPTION (KEYWORDS ONLY, NOT A SOURCE OF CANDIDATE FACTS) ---
${modelJd}

--- PRIORITIZED JD ANALYSIS (TARGETING GUIDANCE ONLY, NOT CANDIDATE FACTS) ---
${jdTargets}`,
      },
    ],
  });

  try {
    return parseModelResume(content);
  } catch (error) {
    console.error('AI returned invalid JSON:', {
      error,
      contentPreview: content.slice(0, 500),
    });
    if (!jsonRetryMessage) {
      return requestTailoredResume(
        resumeText,
        jd,
        jdTargets,
        correctionErrors,
        'Your previous response was invalid JSON. Return exactly one complete minified JSON object only. Start with "{" and end with "}". Do not include markdown or prose.',
      );
    }
    throw new Error('AI returned invalid JSON');
  }
}

async function processTailorJob(jobId: string, fileValue: File, jdValue: string) {
  updateJob(jobId, {
    status: 'processing',
    updatedAt: Date.now(),
  });

  try {
    const resumeText = await extractPdfText(fileValue);
    const jdAnalysis = await analyzeJobDescriptionDeep(jdValue);
    const atsReport = createAtsReportFromAnalysis(resumeText, jdAnalysis);
    const jdTargets = buildJdTargets(jdAnalysis);

    let tailoredData = ensureRequiredAdditionalSections(
      resumeText,
      sanitizeOptionalData(resumeText, await requestTailoredResume(resumeText, jdValue, jdTargets)),
    );
    let validationErrors = validateTailoredData(resumeText, tailoredData);

    if (validationErrors.length > 0) {
      tailoredData = ensureRequiredAdditionalSections(
        resumeText,
        sanitizeOptionalData(resumeText, await requestTailoredResume(resumeText, jdValue, jdTargets, validationErrors)),
      );
      validationErrors = validateTailoredData(resumeText, tailoredData);
    }

    if (validationErrors.length > 0) {
      console.error('AI factual validation failed:', validationErrors);
      updateJob(jobId, {
        status: 'failed',
        updatedAt: Date.now(),
        error: 'The AI changed factual resume details, so no unsafe PDF was generated. Please retry.',
        validationErrors,
      });
      return;
    }

    const resumeChanges = createResumeChanges(resumeText, tailoredData);
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
    updateJob(jobId, {
      status: 'failed',
      updatedAt: Date.now(),
      error: message,
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
