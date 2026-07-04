import { createHash } from 'node:crypto';
import { chatCompletion, extractJsonObject, isOpenRouterConfigured } from '@/lib/ai/openrouter';
import { RequestValidationError } from '@/lib/http/request-validation';
import { analyzeJobDescriptionWithTaxonomy } from './jd-analyzer';
import { normalizeText, unique } from './text';
import type {
  JdAnalysis,
  JdRequirement,
  RequirementPriority,
  SkillCategory,
} from './types';

const ANALYSIS_TIMEOUT_MS = 30_000;
const ANALYSIS_MAX_TOKENS = 2_500;
const ANALYSIS_CACHE_TTL_MS = 30 * 60 * 1000;
const ANALYSIS_CACHE_MAX_ENTRIES = 200;
const MAX_JD_ANALYSIS_CHARS = 24_000;

const SKILL_CATEGORIES: SkillCategory[] = ['skill', 'technology', 'framework', 'tool', 'soft-skill', 'domain', 'certification'];
const PRIORITIES: RequirementPriority[] = ['critical', 'important', 'nice-to-have'];

interface CacheEntry {
  analysis: JdAnalysis;
  expiresAt: number;
}

const analysisCache = new Map<string, CacheEntry>();

function cacheKey(jd: string) {
  return createHash('sha256').update(normalizeText(jd)).digest('hex');
}

function readCache(key: string) {
  const entry = analysisCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    analysisCache.delete(key);
    return null;
  }
  return entry.analysis;
}

function writeCache(key: string, analysis: JdAnalysis) {
  if (analysisCache.size >= ANALYSIS_CACHE_MAX_ENTRIES) {
    const oldestKey = analysisCache.keys().next().value;
    if (oldestKey) analysisCache.delete(oldestKey);
  }
  analysisCache.set(key, { analysis, expiresAt: Date.now() + ANALYSIS_CACHE_TTL_MS });
}

const JD_ANALYSIS_SYSTEM_PROMPT = `
You are a strict, senior ATS (Applicant Tracking System) analyst and technical recruiter. Analyze the job description and extract exactly what an ATS and a human screener would score a resume against.

EXTRACTION RULES:
0. If the provided text is clearly NOT a job description (for example a resume, article, song lyrics, or random text), return exactly {"notJobDescription": true} and nothing else.
1. Extract ONLY what the job description actually states or unambiguously implies. Never invent requirements.
2. skills must cover EVERY concrete competency in the JD: technologies, frameworks, tools, platforms, methodologies, domain knowledge, certifications, and important soft skills.
3. priority reflects how a screener would weigh each skill:
   - "critical": explicitly required, must-have, core to the role title, or mentioned repeatedly.
   - "important": clearly part of the day-to-day responsibilities but not phrased as a hard requirement.
   - "nice-to-have": preferred, bonus, "a plus", or optional.
4. aliases: common spellings/abbreviations/synonyms an ATS or resume may use for the same skill (e.g. "JavaScript" -> ["js", "ecmascript"]). Lowercase. Do not include unrelated terms.
5. atsKeywords: the exact words and short phrases (max 4 words each) from the JD that an ATS keyword scanner would look for, including role titles and domain vocabulary. Use the JD's own wording.
6. responsibilities: the core duties, condensed to short actionable phrases.
7. qualifications.experienceYears: quote the JD's experience requirement (e.g. "3+ years in QA"), or "" if none stated.
8. Be exhaustive on skills and atsKeywords, but never duplicate near-identical entries.

Return ONLY one minified JSON object with this exact shape (no markdown, no commentary):
{
  "roleTitle": "job title from the JD",
  "seniority": "intern|junior|mid|senior|lead|manager|director|unspecified",
  "summary": "1-2 sentence summary of what this role is and what the employer values most",
  "skills": [
    {"name": "Skill Name", "aliases": ["alias"], "category": "technology|framework|tool|skill|soft-skill|domain|certification", "priority": "critical|important|nice-to-have", "evidence": "short quote from the JD"}
  ],
  "responsibilities": ["condensed responsibility"],
  "qualifications": {
    "education": ["education requirement, or empty array"],
    "experienceYears": "experience requirement or empty string",
    "certifications": ["certification requirement, or empty array"]
  },
  "atsKeywords": ["exact keyword or phrase from the JD"]
}
`;

function asString(value: unknown, maxLength = 300) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function asStringArray(value: unknown, maxItems: number, maxLength = 200) {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .map((item) => asString(item, maxLength))
      .filter(Boolean),
  ).slice(0, maxItems);
}

function asCategory(value: unknown): SkillCategory {
  const text = asString(value, 40).toLowerCase() as SkillCategory;
  return SKILL_CATEGORIES.includes(text) ? text : 'skill';
}

function asPriority(value: unknown): RequirementPriority {
  const text = asString(value, 40).toLowerCase() as RequirementPriority;
  return PRIORITIES.includes(text) ? text : 'important';
}

function sanitizeRequirements(value: unknown): JdRequirement[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const requirements: JdRequirement[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = asString(record.name, 80);
    if (!name) continue;

    const dedupeKey = normalizeText(name);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const priority = asPriority(record.priority);
    requirements.push({
      name,
      category: asCategory(record.category),
      level: priority === 'nice-to-have' ? 'preferred' : 'required',
      priority,
      aliases: asStringArray(record.aliases, 8, 60).map((alias) => alias.toLowerCase()),
      evidence: asString(record.evidence, 240),
    });

    if (requirements.length >= 60) break;
  }

  return requirements;
}

function parseDeepAnalysis(content: string, jd: string): JdAnalysis {
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;
  if (parsed.notJobDescription === true) {
    throw new RequestValidationError('The provided text does not look like a job description. Paste the full JD from the job posting.', 422);
  }
  const requirements = sanitizeRequirements(parsed.skills);
  if (requirements.length === 0) {
    throw new Error('JD analysis returned no skills');
  }

  const qualificationsRecord = parsed.qualifications && typeof parsed.qualifications === 'object'
    ? parsed.qualifications as Record<string, unknown>
    : {};
  const education = asStringArray(qualificationsRecord.education, 6);
  const experienceYears = asString(qualificationsRecord.experienceYears, 160);

  return {
    roleTitle: asString(parsed.roleTitle, 120),
    seniority: asString(parsed.seniority, 30) || 'unspecified',
    summary: asString(parsed.summary, 400),
    responsibilities: asStringArray(parsed.responsibilities, 12, 240),
    qualifications: {
      education,
      experienceYears,
      certifications: asStringArray(qualificationsRecord.certifications, 6),
    },
    atsKeywords: asStringArray(parsed.atsKeywords, 40, 80),
    analysisSource: 'ai',
    requiredSkills: requirements.filter((item) => item.level === 'required').map((item) => item.name),
    preferredSkills: requirements.filter((item) => item.level === 'preferred').map((item) => item.name),
    technologies: requirements.filter((item) => item.category === 'technology').map((item) => item.name),
    frameworks: requirements.filter((item) => item.category === 'framework').map((item) => item.name),
    tools: requirements.filter((item) => item.category === 'tool').map((item) => item.name),
    educationRequirements: education,
    experienceRequirements: experienceYears ? [experienceYears] : extractExperienceLines(jd),
    requirements,
  };
}

function extractExperienceLines(jd: string) {
  return unique(
    jd
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /\b\d+\s*(?:\+|plus|-|to)?\s*\d*\s*years?\b/i.test(line)),
  ).slice(0, 6);
}

function mergeWithTaxonomy(analysis: JdAnalysis, jd: string): JdAnalysis {
  const fallback = analyzeJobDescriptionWithTaxonomy(jd);
  const existing = new Set(analysis.requirements.map((item) => normalizeText(item.name)));
  const additions = fallback.requirements.filter((item) => {
    if (existing.has(normalizeText(item.name))) return false;
    return !item.aliases.some((alias) => existing.has(normalizeText(alias)));
  });
  if (additions.length === 0) return analysis;

  const requirements = [...analysis.requirements, ...additions];
  return {
    ...analysis,
    requirements,
    requiredSkills: requirements.filter((item) => item.level === 'required').map((item) => item.name),
    preferredSkills: requirements.filter((item) => item.level === 'preferred').map((item) => item.name),
    technologies: requirements.filter((item) => item.category === 'technology').map((item) => item.name),
    frameworks: requirements.filter((item) => item.category === 'framework').map((item) => item.name),
    tools: requirements.filter((item) => item.category === 'tool').map((item) => item.name),
  };
}

export async function analyzeJobDescriptionDeep(jd: string): Promise<JdAnalysis> {
  const key = cacheKey(jd);
  const cached = readCache(key);
  if (cached) return cached;

  if (!isOpenRouterConfigured()) {
    const fallback = analyzeJobDescriptionWithTaxonomy(jd);
    writeCache(key, fallback);
    return fallback;
  }

  try {
    const content = await chatCompletion({
      timeoutMs: ANALYSIS_TIMEOUT_MS,
      maxTokens: ANALYSIS_MAX_TOKENS,
      temperature: 0,
      messages: [
        { role: 'system', content: JD_ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `--- JOB DESCRIPTION ---\n${jd.slice(0, MAX_JD_ANALYSIS_CHARS)}` },
      ],
    });

    const analysis = mergeWithTaxonomy(parseDeepAnalysis(content, jd), jd);
    writeCache(key, analysis);
    return analysis;
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    console.error('Deep JD analysis failed, falling back to taxonomy:', error);
    const fallback = analyzeJobDescriptionWithTaxonomy(jd);
    writeCache(key, fallback);
    return fallback;
  }
}
