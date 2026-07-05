import { createHash } from 'node:crypto';
import type { ResumeData } from '@/components/ResumePDF';
import { chatCompletion, extractJsonObject } from '@/lib/ai/openrouter';
import { unique } from '@/lib/ats/text';
import { RequestValidationError } from '@/lib/http/request-validation';
import { parseModelResume } from './parse-model-resume';
import { validateTailoredData } from './factual-validation';

const EXTRACTION_TIMEOUT_MS = 60_000;
const EXTRACTION_MAX_TOKENS = 6_000;
const FACTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FACTS_CACHE_MAX_ENTRIES = 50;

// Source facts share the ResumeData shape; bullets hold the ORIGINAL wording.
export type ExtractedResume = ResumeData;

interface CacheEntry {
  facts: ExtractedResume;
  expiresAt: number;
}

const factsCache = new Map<string, CacheEntry>();

export function resumeFactsCacheKey(resumeText: string) {
  return createHash('sha256').update(resumeText).digest('hex');
}

function readCache(key: string) {
  const entry = factsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    factsCache.delete(key);
    return null;
  }
  return entry.facts;
}

function writeCache(key: string, facts: ExtractedResume) {
  if (factsCache.size >= FACTS_CACHE_MAX_ENTRIES) {
    const oldestKey = factsCache.keys().next().value;
    if (oldestKey) factsCache.delete(oldestKey);
  }
  factsCache.set(key, { facts, expiresAt: Date.now() + FACTS_CACHE_TTL_MS });
}

const EXTRACTION_SYSTEM_PROMPT = `
You are a precise resume parser. Convert the source resume text into structured JSON WITHOUT changing any wording. This is pure extraction, not rewriting.

STRICT RULES:
0. If the document is clearly NOT a person's resume/CV (for example a job description, invoice, article, or random text), return exactly {"notResume": true} and nothing else.
1. Copy every value VERBATIM from the source resume: names, contact details, job titles, employers, durations, degrees, institutions, project names, bullet text, section values.
2. Do not improve, summarize, translate, reorder, expand, or "fix" anything. Preserve the source's own wording, including its exact dates and duration strings.
3. If a field is absent in the source, use an empty string (never invent or estimate).
4. Keep employment under "experience" and non-employment work (personal/academic/client projects) under "projects". Never convert one into the other.
5. bullets: copy each source bullet/responsibility line as one array entry, verbatim. If a role has a paragraph instead of bullets, split it into its natural sentences without rephrasing.
6. skills: list every skill exactly as the source writes it.
6b. skillGroups: if the source groups its skills under category labels (e.g. "Languages:", "Frontend:", "Tools:"), reproduce those groups verbatim with the source's own labels and each group's skills. If the source has no grouping, return an empty array.
7. summary: copy the source's summary/objective section verbatim; empty string if none.
8. additionalInformation: capture remaining source sections (Languages, Personal Details, Certifications, Achievements, Interests, Declaration...) with their labels and verbatim values.
9. For every experience, project, education, and additional item, set sourceEvidence to a short verbatim excerpt from the source proving it.

Return ONLY one minified JSON object with this exact schema, nothing else:
{
  "name": "", "contact": "", "summary": "",
  "skills": [""],
  "skillGroups": [{"label": "", "skills": [""]}],
  "experience": [{"title": "", "organization": "", "duration": "", "bullets": [""], "sourceEvidence": ""}],
  "projects": [{"title": "", "organization": "", "duration": "", "bullets": [""], "sourceEvidence": ""}],
  "education": [{"institution": "", "degree": "", "duration": "", "sourceEvidence": ""}],
  "additionalInformation": [{"label": "", "value": "", "sourceEvidence": ""}],
  "addedKeywords": []
}
`;

async function requestExtraction(resumeText: string, correctionErrors: string[] = []): Promise<ExtractedResume> {
  const correction = correctionErrors.length > 0
    ? `\nYour previous extraction failed verbatim validation. Fix every issue below by copying the exact source value; if the source does not contain a value, use an empty string:\n- ${correctionErrors.join('\n- ')}\n`
    : '';

  const content = await chatCompletion({
    timeoutMs: EXTRACTION_TIMEOUT_MS,
    maxTokens: EXTRACTION_MAX_TOKENS,
    temperature: 0,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: `${correction}--- SOURCE RESUME ---\n${resumeText}` },
    ],
  });

  try {
    const raw = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;
    if (raw.notResume === true) {
      throw new RequestValidationError('The uploaded file does not look like a resume. Upload your actual resume (PDF or DOCX).', 422);
    }
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    // Fall through: parseModelResume reports malformed JSON with its own error.
  }

  return withDedupedProjects(withFlattenedSkills(parseModelResume(content)));
}

// The model sometimes fills skillGroups but leaves the flat skills list
// empty; downstream ordering/scoring relies on the flat list.
export function withFlattenedSkills(data: ExtractedResume): ExtractedResume {
  if (data.skills.length > 0 || !data.skillGroups?.length) return data;
  return { ...data, skills: unique(data.skillGroups.flatMap((group) => group.skills)) };
}

// Some resumes list the same project under multiple section headings; merge
// duplicates by title, keeping the first occurrence's fields and the union of
// bullets.
export function withDedupedProjects(data: ExtractedResume): ExtractedResume {
  if (data.projects.length < 2) return data;

  const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const byTitle = new Map<string, ExtractedResume['projects'][number]>();

  for (const project of data.projects) {
    const key = normalizeTitle(project.title);
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, { ...project, bullets: [...project.bullets] });
      continue;
    }
    existing.bullets = unique([...existing.bullets, ...project.bullets]);
    if (!existing.organization) existing.organization = project.organization;
    if (!existing.duration) existing.duration = project.duration;
  }

  return { ...data, projects: [...byTitle.values()] };
}

export async function extractResumeFacts(resumeText: string): Promise<ExtractedResume> {
  const key = resumeFactsCacheKey(resumeText);
  const cached = readCache(key);
  if (cached) return cached;

  let facts = await requestExtraction(resumeText);
  let errors = validateTailoredData(resumeText, facts, { enforceRequiredSections: false });

  if (errors.length > 0) {
    facts = await requestExtraction(resumeText, errors);
    errors = validateTailoredData(resumeText, facts, { enforceRequiredSections: false });
  }

  if (errors.length > 0) {
    console.error('Resume fact extraction failed validation:', errors);
    const error = new Error('Could not reliably extract the resume facts. Please retry.');
    (error as Error & { validationErrors?: string[] }).validationErrors = errors;
    throw error;
  }

  if (facts.experience.length === 0 && facts.projects.length === 0) {
    throw new RequestValidationError('Could not find any work experience or projects in this document. Make sure you uploaded your actual resume.', 422);
  }

  writeCache(key, facts);
  return facts;
}
