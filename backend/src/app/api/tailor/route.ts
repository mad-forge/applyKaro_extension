import { NextRequest, NextResponse } from 'next/server';
import { Agent, fetch as undiciFetch } from 'undici';
import type { ResumeData, ResumeItem, EducationItem, AdditionalItem } from '@/components/ResumePDF';
import { createAtsReport } from '@/lib/ats/ats-service';
import type { AtsReport, ResumeChanges } from '@/lib/ats/types';
import { createResumeChanges } from '@/lib/resume/change-preview';
import { extractPdfText } from '@/lib/resume/pdf-text';

export const runtime = 'nodejs';

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_TIMEOUT_MS = 30_000;
const OPENROUTER_ALLOW_SELF_SIGNED = process.env.OPENROUTER_ALLOW_SELF_SIGNED === 'true';
const MAX_JD_MODEL_CHARS = 12_000;
const MAX_OUTPUT_TOKENS = 6_500;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const JOB_TTL_MS = 60 * 60 * 1000;
const INSECURE_OPENROUTER_AGENT = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
});

interface TailorJobResult {
  atsScore: AtsReport['atsScore'];
  gapAnalysis: AtsReport['gapAnalysis'];
  keywordAnalysis: AtsReport['keywordAnalysis'];
  jdAnalysis: AtsReport['jdAnalysis'];
  resumeChanges: ResumeChanges;
  tailoredData: ResumeData;
  addedKeywords: ResumeData['addedKeywords'];
  pdfGeneration: {
    mode: 'client';
    instruction: string;
  };
}

type TailorJob =
  | {
    id: string;
    status: 'pending' | 'processing';
    createdAt: number;
    updatedAt: number;
  }
  | {
    id: string;
    status: 'completed';
    createdAt: number;
    updatedAt: number;
    result: TailorJobResult;
  }
  | {
    id: string;
    status: 'failed';
    createdAt: number;
    updatedAt: number;
    error: string;
    validationErrors?: string[];
  };

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const jobs = new Map<string, TailorJob>();
const rateLimits = new Map<string, RateLimitEntry>();
const JSON_HEADERS = { 'Access-Control-Allow-Origin': '*' };

function cleanupExpiredState() {
  const now = Date.now();

  for (const [jobId, job] of jobs.entries()) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(jobId);
  }

  for (const [ip, entry] of rateLimits.entries()) {
    if (now > entry.resetAt) rateLimits.delete(ip);
  }
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || forwardedFor
    || 'unknown';
}

function rateLimit(req: NextRequest) {
  const ip = getClientIp(req);
  const now = Date.now();
  const current = rateLimits.get(ip);

  if (!current || now > current.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimits.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count,
    resetAt: current.resetAt,
  };
}

function createJob() {
  cleanupExpiredState();

  const jobId = crypto.randomUUID();
  const now = Date.now();
  jobs.set(jobId, {
    id: jobId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });

  return jobId;
}

type TailorJobUpdate =
  | {
    status: 'pending' | 'processing';
    updatedAt: number;
  }
  | {
    status: 'completed';
    updatedAt: number;
    result: TailorJobResult;
  }
  | {
    status: 'failed';
    updatedAt: number;
    error: string;
    validationErrors?: string[];
  };

function updateJob(jobId: string, update: TailorJobUpdate) {
  const existing = jobs.get(jobId);
  const createdAt = existing?.createdAt ?? Date.now();

  if (update.status === 'completed') {
    jobs.set(jobId, { id: jobId, createdAt, ...update });
    return;
  }

  if (update.status === 'failed') {
    jobs.set(jobId, { id: jobId, createdAt, ...update });
    return;
  }

  jobs.set(jobId, { id: jobId, createdAt, ...update });
}

function serializeJob(job: TailorJob) {
  if (job.status === 'completed') {
    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      result: job.result,
    };
  }

  if (job.status === 'failed') {
    return {
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      validationErrors: job.validationErrors,
    };
  }

  return {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

const SYSTEM_PROMPT = `
You are an elite ATS-optimizing resume tailor and career strategist. Bridge the gap between the candidate's source resume and the target job description while preserving factual accuracy.

CORE RULES:
1. SMART RE-FRAMING:
- Rewrite summary and bullets using the exact vocabulary and keywords from the JD when the same skill, tool, responsibility, or outcome is already present or strongly implied in the source resume.
- Translate weak wording into recruiter/ATS-friendly phrasing without adding unsupported technologies, metrics, responsibilities, or achievements.

2. KEYWORD PRIORITIZATION & ORDERING:
- Recruiters read top-down. Reorder bullets under each experience/project so the top 1-2 bullets match the JD's primary requirements most closely.
- Push less relevant tasks lower while preserving useful source-supported content.
- Skills should be ordered by JD relevance, but every skill must be explicitly present in the source resume.

3. TARGETED & HIGH-IMPACT SUMMARY:
- Rewrite the Professional Summary as a direct pitch for this JD.
- If the candidate's source title contains multiple roles (e.g., 'QA Analyst | Frontend Developer'), explicitly lead the summary with the role that best matches the target JD.
- The first sentence must include actual years of experience only when directly present in the source resume, plus the strongest JD-matching source-supported skills.
- Avoid fluffy adjectives. Be objective, concise, and evidence-based.

4. ZERO HALLUCINATION & HONEST GAP HANDLING:
- Never invent, infer, estimate, modernize, or "correct" dates, employers, job titles, institutions, degrees, project names, contact details, or personal facts.
- Copy factual fields exactly as written in the source resume. If a duration is missing, return an empty string. Never create a date range.
- Keep employment and projects separate. Never convert a project, client, website, religious organization, academic item, or personal item into employment.
- If the JD requires a skill and there is zero evidence of it in the source resume, do not add it anywhere in the tailored resume or addedKeywords. The backend ATS report will expose it as a capability gap.

5. CRITICAL RULE FOR addedKeywords:
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

function normalizeForEvidence(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactEvidence(value: string) {
  return normalizeForEvidence(value).replace(/\s+/g, '');
}

function evidenceTokens(value: string) {
  return normalizeForEvidence(value).split(' ').filter((token) => token.length >= 2);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function tokenMatchesSource(token: string, sourceTokens: Set<string>) {
  if (sourceTokens.has(token)) return true;

  const allowedDistance = token.length >= 8 ? 2 : 1;
  for (const sourceToken of sourceTokens) {
    if (Math.abs(sourceToken.length - token.length) > allowedDistance) continue;
    if (levenshteinDistance(token, sourceToken) <= allowedDistance) return true;
  }

  return false;
}

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

function sourceContains(source: string, value: string) {
  const normalizedValue = normalizeForEvidence(value);
  if (!normalizedValue) return true;

  const normalizedSource = normalizeForEvidence(source);
  if (normalizedSource.includes(normalizedValue)) return true;

  const compactValue = compactEvidence(value);
  const compactSource = compactEvidence(source);
  if (compactValue.length >= 3 && compactSource.includes(compactValue)) return true;

  const valueTokens = evidenceTokens(value);
  if (valueTokens.length === 0) return true;

  const sourceTokenSet = new Set(evidenceTokens(source));
  const matchedTokens = valueTokens.filter((token) => (
    compactSource.includes(token) || tokenMatchesSource(token, sourceTokenSet)
  ));
  const requiredRatio = valueTokens.length <= 2 ? 1 : 0.8;

  return matchedTokens.length / valueTokens.length >= requiredRatio;
}

function sourceContainsParts(source: string, value: string) {
  const parts = value.split(/[\n|,;•&]+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => sourceContains(source, part));
}

const REQUIRED_ADDITIONAL_SECTIONS = ['languages', 'personal details'];
const SECTION_HEADING_PATTERN = /^(summary|professional summary|objective|skills|technical skills|experience|professional experience|work experience|employment|projects|education|certifications|languages|personal details|personal information|additional information|achievements|interests|hobbies|declaration)\b/i;

function findSourceSection(source: string, section: string) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const startIndex = lines.findIndex((line) => normalizeForEvidence(line).startsWith(section));
  if (startIndex === -1) {
    const normalizedSection = normalizeForEvidence(section);
    const exactHeadingMatch = source.match(new RegExp(`\\b${section.replace(/\s+/g, '\\s+')}\\b`, 'i'))?.[0];
    return exactHeadingMatch ? {
      label: exactHeadingMatch,
      value: exactHeadingMatch,
      sourceEvidence: exactHeadingMatch,
    } : {
      label: normalizedSection.split(' ').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' '),
      value: section,
      sourceEvidence: section,
    };
  }

  const values: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (SECTION_HEADING_PATTERN.test(line)) break;
    values.push(line);
  }

  const sameLineValue = lines[startIndex]
    .replace(new RegExp(`^${section.replace(/\s+/g, '\\s+')}\\s*[:|-]?\\s*`, 'i'), '')
    .trim();
  const value = [sameLineValue, ...values].filter(Boolean).join(' | ').trim();
  return value ? {
    label: lines[startIndex].replace(/[:|-]+$/, '').trim(),
    value,
    sourceEvidence: `${lines[startIndex]} ${values.slice(0, 2).join(' ')}`.trim(),
  } : {
    label: lines[startIndex].replace(/[:|-]+$/, '').trim(),
    value: lines[startIndex],
    sourceEvidence: lines[startIndex],
  };
}

function ensureRequiredAdditionalSections(source: string, data: ResumeData): ResumeData {
  const additionalInformation = [...data.additionalInformation];

  for (const section of REQUIRED_ADDITIONAL_SECTIONS) {
    const sourceHasSection = normalizeForEvidence(source).includes(section);
    const outputHasSection = additionalInformation.some((item) => normalizeForEvidence(item.label).includes(section));
    if (!sourceHasSection || outputHasSection) continue;

    const sourceSection = findSourceSection(source, section);
    if (sourceSection) additionalInformation.push(sourceSection);
  }

  return { ...data, additionalInformation };
}

function contactIsSupported(source: string, contact: string) {
  const sourceNormalized = normalizeForEvidence(source);
  const meaningfulTokens = normalizeForEvidence(contact).split(' ').filter((token) => token.length >= 4);
  return meaningfulTokens.length > 0 && meaningfulTokens.every((token) => sourceNormalized.includes(token));
}

function sanitizeOptionalData(source: string, data: ResumeData): ResumeData {
  const supportedSkills = data.skills.filter((skill) => sourceContains(source, skill));
  const supportedKeywords = data.addedKeywords.filter((item) => sourceContains(source, item.keyword));
  const compactItems = (items: ResumeItem[], limit: number) => items.map((item) => ({
    ...item,
    bullets: item.bullets.slice(0, limit),
  }));
  const compactAdditionalInformation = data.additionalInformation.map((item) => ({
    ...item,
    value: item.value.split('\n').map((part) => part.trim()).filter(Boolean).join(' | '),
  }));

  return {
    ...data,
    skills: supportedSkills,
    addedKeywords: supportedKeywords,
    experience: compactItems(data.experience, 7),
    projects: compactItems(data.projects, 3),
    additionalInformation: compactAdditionalInformation,
  };
}

function validateResumeItem(source: string, item: ResumeItem, path: string, errors: string[]) {
  if (!sourceContains(source, item.title)) errors.push(`${path}.title "${item.title}" was changed or invented`);
  if (!sourceContains(source, item.organization)) errors.push(`${path}.organization "${item.organization}" was changed or invented`);
  if (!sourceContains(source, item.duration)) errors.push(`${path}.duration "${item.duration}" was changed or invented`);
}

function validateEducationItem(source: string, item: EducationItem, path: string, errors: string[]) {
  if (!sourceContains(source, item.institution)) errors.push(`${path}.institution "${item.institution}" was changed or invented`);
  if (!sourceContains(source, item.degree)) errors.push(`${path}.degree "${item.degree}" was changed or invented`);
  if (!sourceContains(source, item.duration)) errors.push(`${path}.duration "${item.duration}" was changed or invented`);
}

function validateAdditionalItem(source: string, item: AdditionalItem, path: string, errors: string[]) {
  if (!sourceContainsParts(source, item.value)) errors.push(`${path}.value "${item.value}" was changed or invented`);
}

function validateTailoredData(source: string, data: ResumeData) {
  const errors: string[] = [];

  if (!sourceContains(source, data.name)) errors.push('name was changed or invented');
  if (!contactIsSupported(source, data.contact)) errors.push('contact details were changed or invented');
  for (const [index, item] of (data.experience || []).entries()) {
    validateResumeItem(source, item, `experience[${index}]`, errors);
  }
  for (const [index, item] of (data.projects || []).entries()) {
    validateResumeItem(source, item, `projects[${index}]`, errors);
  }
  for (const [index, item] of (data.education || []).entries()) {
    validateEducationItem(source, item, `education[${index}]`, errors);
  }
  for (const [index, item] of (data.additionalInformation || []).entries()) {
    validateAdditionalItem(source, item, `additionalInformation[${index}]`, errors);
  }
  for (const section of REQUIRED_ADDITIONAL_SECTIONS) {
    const sourceHasSection = normalizeForEvidence(source).includes(section);
    const outputHasSection = data.additionalInformation.some((item) => normalizeForEvidence(item.label).includes(section));
    if (sourceHasSection && !outputHasSection) errors.push(`additionalInformation is missing the source "${section}" section`);
  }

  return errors;
}

function extractJsonObject(content: string) {
  const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned;

  const start = cleaned.indexOf('{');
  if (start === -1) return cleaned;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const character = cleaned[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = inString;
      continue;
    }
    if (character === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return cleaned.slice(start, index + 1);
  }

  return cleaned.slice(start);
}

function parseModelJson(content: unknown): ResumeData {
  if (typeof content !== 'string') throw new Error('AI returned an empty response');
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;

  const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const optionalFactualValue = (value: unknown) => {
    const text = stringValue(value);
    return /^(empty|none|n\/a|null|not provided)$/i.test(text) ? '' : text;
  };
  const stringArray = (value: unknown) => Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
  const recordArray = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
  const resumeItems = (value: unknown): ResumeItem[] => recordArray(value).map((item) => ({
    title: stringValue(item.title),
    organization: optionalFactualValue(item.organization),
    duration: optionalFactualValue(item.duration),
    bullets: stringArray(item.bullets),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));
  const educationItems = (value: unknown): EducationItem[] => recordArray(value).map((item) => ({
    institution: stringValue(item.institution),
    degree: stringValue(item.degree),
    duration: optionalFactualValue(item.duration),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));
  const additionalItems = (value: unknown): AdditionalItem[] => recordArray(value).map((item) => ({
    label: stringValue(item.label),
    value: stringValue(item.value),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));

  return {
    name: stringValue(parsed.name),
    contact: stringValue(parsed.contact),
    summary: stringValue(parsed.summary),
    skills: stringArray(parsed.skills),
    experience: resumeItems(parsed.experience),
    projects: resumeItems(parsed.projects),
    education: educationItems(parsed.education),
    additionalInformation: additionalItems(parsed.additionalInformation),
    addedKeywords: recordArray(parsed.addedKeywords).map((item) => ({
      keyword: stringValue(item.keyword),
      location: stringValue(item.location),
    })).filter((item) => item.keyword && item.location),
  };
}

function getOpenRouterConfig() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is missing. Add OPENROUTER_API_KEY to backend/.env.local and restart the backend.');
  }

  return {
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: OPENROUTER_BASE_URL.replace(/\/+$/, ''),
    model: process.env.AI_MODEL || 'google/gemini-2.5-flash-lite',
  };
}

function createOpenRouterFetchError(error: unknown) {
  const cause = error instanceof Error ? error.cause : undefined;
  const causeCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;

  if (causeCode === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return new Error('OpenRouter TLS verification failed because a self-signed certificate is in the chain. Trust your proxy/root certificate, or set OPENROUTER_ALLOW_SELF_SIGNED=true in backend/.env.local for local development.');
  }

  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return new Error('OpenRouter timed out while tailoring the resume. Please retry in a moment.');
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new Error('OpenRouter request was aborted while tailoring the resume. Please retry.');
  }

  if (error instanceof TypeError) {
    return new Error('Could not reach OpenRouter from the backend. Check your internet connection, API URL, or proxy settings.');
  }

  return error;
}

async function requestTailoredResume(
  resumeText: string,
  jd: string,
  correctionErrors: string[] = [],
  jsonRetryMessage = '',
): Promise<ResumeData> {
  const { apiKey, baseUrl, model } = getOpenRouterConfig();
  const modelResumeText = compactForModel(resumeText);
  const modelJd = limitJdForModel(jd);
  const correction = correctionErrors.length > 0
    ? `\nYour previous response failed factual validation. Correct every issue below. Copy the exact source spelling/value; if you cannot find exact support, omit that item instead of guessing:\n- ${correctionErrors.join('\n- ')}\n`
    : '';
  const jsonCorrection = jsonRetryMessage ? `\n${jsonRetryMessage}\n` : '';

  let response: Response;
  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      signal: AbortSignal.timeout(OPENROUTER_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Resume Tailor',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${correction}${jsonCorrection}
--- SOURCE RESUME (ONLY SOURCE OF FACTS) ---
${modelResumeText}

--- TARGET JOB DESCRIPTION (KEYWORDS ONLY, NOT A SOURCE OF CANDIDATE FACTS) ---
${modelJd}`,
          },
        ],
      }),
    };

    if (OPENROUTER_ALLOW_SELF_SIGNED) {
      response = await undiciFetch(`${baseUrl}/chat/completions`, {
        ...fetchOptions,
        dispatcher: INSECURE_OPENROUTER_AGENT,
      } as Parameters<typeof undiciFetch>[1]) as unknown as Response;
    } else {
      response = await fetch(`${baseUrl}/chat/completions`, fetchOptions);
    }
  } catch (error) {
    throw createOpenRouterFetchError(error);
  }

  if (response.url.includes('blocked.teams.cloudflare.com')) {
    throw new Error('OpenRouter is blocked by your network/security policy. Try a different network, VPN/hotspot, or ask your administrator to allow openrouter.ai.');
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error('OpenRouter Error:', detail);
    throw new Error(`OpenRouter API error (${response.status}). Check your API key, credits, and selected model.`);
  }

  const result = await response.json() as {
    choices?: { message?: { content?: unknown } }[];
  };

  try {
    return parseModelJson(result.choices?.[0]?.message?.content);
  } catch (error) {
    console.error('AI returned invalid JSON:', {
      error,
      contentPreview: typeof result.choices?.[0]?.message?.content === 'string'
        ? result.choices[0].message.content.slice(0, 500)
        : result.choices?.[0]?.message?.content,
    });
    if (!jsonRetryMessage) {
      return requestTailoredResume(
        resumeText,
        jd,
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
    const atsReport = createAtsReport(resumeText, jdValue);

    let tailoredData = ensureRequiredAdditionalSections(
      resumeText,
      sanitizeOptionalData(resumeText, await requestTailoredResume(resumeText, jdValue)),
    );
    let validationErrors = validateTailoredData(resumeText, tailoredData);

    if (validationErrors.length > 0) {
      tailoredData = ensureRequiredAdditionalSections(
        resumeText,
        sanitizeOptionalData(resumeText, await requestTailoredResume(resumeText, jdValue, validationErrors)),
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

    updateJob(jobId, {
      status: 'completed',
      updatedAt: Date.now(),
      result: {
        atsScore: atsReport.atsScore,
        gapAnalysis: atsReport.gapAnalysis,
        keywordAnalysis: atsReport.keywordAnalysis,
        jdAnalysis: atsReport.jdAnalysis,
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
    cleanupExpiredState();

    const limit = rateLimit(req);
    if (!limit.allowed) {
      return NextResponse.json({
        error: 'Too many resume tailoring requests. Please try again after the hourly rate limit resets.',
        resetAt: new Date(limit.resetAt).toISOString(),
      }, {
        status: 429,
        headers: {
          ...JSON_HEADERS,
          'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(limit.resetAt / 1000)),
        },
      });
    }

    const formData = await req.formData();
    const jdValue = formData.get('jd');
    const fileValue = formData.get('resume');

    if (!(fileValue instanceof File) || typeof jdValue !== 'string' || !jdValue.trim()) {
      return NextResponse.json({ error: 'Missing PDF resume or job description' }, { status: 400 });
    }

    const jobId = createJob();
    void processTailorJob(jobId, fileValue, jdValue);

    return NextResponse.json({
      jobId,
      status: 'pending',
      pollUrl: `/api/tailor?jobId=${jobId}`,
    }, {
      status: 202,
      headers: {
        ...JSON_HEADERS,
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX_REQUESTS),
        'X-RateLimit-Remaining': String(limit.remaining),
        'X-RateLimit-Reset': String(Math.ceil(limit.resetAt / 1000)),
      },
    });
  } catch (error: unknown) {
    console.error('Error creating tailor job:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: JSON_HEADERS },
    );
  }
}

export async function GET(req: NextRequest) {
  cleanupExpiredState();

  const jobId = req.nextUrl.searchParams.get('jobId');
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400, headers: JSON_HEADERS });
  }

  const job = jobs.get(jobId);
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
