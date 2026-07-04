import type { ResumeData, ResumeItem } from '@/components/ResumePDF';
import { chatCompletion, extractJsonObject } from '@/lib/ai/openrouter';
import type { ExtractedResume } from './extract';
import { sourceContains } from './factual-validation';

const OPTIMIZE_TIMEOUT_MS = 60_000;
const OPTIMIZE_MAX_TOKENS = 5_000;
const MAX_EXPERIENCE_BULLETS = 7;
const MAX_PROJECT_BULLETS = 3;

export interface OptimizedContent {
  summary: string;
  skills: string[];
  items: { id: string; bullets: string[] }[];
  addedKeywords: { keyword: string; location: string }[];
}

const OPTIMIZE_SYSTEM_PROMPT = `
You are an elite ATS resume optimizer. You will receive the candidate's resume as LOCKED STRUCTURED FACTS plus a prioritized analysis of the target job description.

You may ONLY produce: a tailored professional summary, a reordered skills list, and rewritten bullets per item. All factual fields (names, employers, titles, durations, education, personal details) are locked server-side — you cannot and must not restate them; they are provided for context only.

RULES FOR BULLETS:
1. Rewrite each item's bullets using the job description's exact vocabulary WHERE the same skill, tool, responsibility, or outcome already exists in that item's original bullets.
2. Never invent technologies, tools, metrics, numbers, achievements, team sizes, or responsibilities that the original bullets do not state or strongly imply.
3. Reorder bullets so the most JD-relevant come first. Keep every original bullet's substance — condense wording but do not drop source-supported content merely to shorten.
4. Cover CRITICAL requirements first, then IMPORTANT, then nice-to-have — but only where original evidence exists.
5. Return bullets for every item id you receive. If an item needs no changes, return its original bullets unchanged.

RULES FOR SUMMARY:
- A direct, evidence-based pitch for this JD. Lead with the role that best matches the target JD. Mention years of experience only if the original resume states them. No fluffy adjectives.

RULES FOR SKILLS:
- Return the provided source skills reordered by JD relevance (critical first). You may rewrite a skill's wording to the JD's terminology ONLY if it is clearly the same skill (e.g. "ReactJS" -> "React.js"). Never add a skill that is not in the provided list.

RULES FOR addedKeywords:
- List each JD keyword you wove into the summary or bullets. Every keyword MUST be an exact substring of the text you generated.

Return ONLY one minified JSON object:
{
  "summary": "tailored summary",
  "skills": ["reordered source skill"],
  "items": [{"id": "exp-0", "bullets": ["rewritten bullet"]}],
  "addedKeywords": [{"keyword": "exact substring of generated text", "location": "summary or experience or projects"}]
}
`;

function itemsWithIds(facts: ExtractedResume) {
  return [
    ...facts.experience.map((item, index) => ({ id: `exp-${index}`, kind: 'experience' as const, item })),
    ...facts.projects.map((item, index) => ({ id: `proj-${index}`, kind: 'project' as const, item })),
  ];
}

function buildOptimizeInput(facts: ExtractedResume, jdTargets: string) {
  const items = itemsWithIds(facts).map(({ id, kind, item }) => ({
    id,
    kind,
    title: item.title,
    organization: item.organization,
    originalBullets: item.bullets,
  }));

  return `--- LOCKED RESUME FACTS (CONTEXT ONLY — DO NOT RESTATE) ---
Name: ${facts.name}
Original summary: ${facts.summary || '(none)'}
Source skills: ${facts.skills.join(', ')}
Items:
${JSON.stringify(items, null, 1)}

--- PRIORITIZED JD ANALYSIS (TARGETING GUIDANCE ONLY, NOT CANDIDATE FACTS) ---
${jdTargets}`;
}

function parseOptimizedContent(content: string): OptimizedContent {
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;
  const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const stringArray = (value: unknown) => Array.isArray(value)
    ? value.map(stringValue).filter(Boolean)
    : [];

  const items = Array.isArray(parsed.items)
    ? parsed.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({ id: stringValue(item.id), bullets: stringArray(item.bullets) }))
      .filter((item) => item.id && item.bullets.length > 0)
    : [];

  const addedKeywords = Array.isArray(parsed.addedKeywords)
    ? parsed.addedKeywords
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item) => ({ keyword: stringValue(item.keyword), location: stringValue(item.location) }))
      .filter((item) => item.keyword && item.location)
    : [];

  const summary = stringValue(parsed.summary);
  if (!summary || items.length === 0) {
    throw new Error('AI optimization response was incomplete');
  }

  return { summary, skills: stringArray(parsed.skills), items, addedKeywords };
}

async function requestOptimization(
  facts: ExtractedResume,
  jdTargets: string,
  jsonRetryMessage = '',
): Promise<OptimizedContent> {
  const retry = jsonRetryMessage ? `\n${jsonRetryMessage}\n` : '';
  const content = await chatCompletion({
    timeoutMs: OPTIMIZE_TIMEOUT_MS,
    maxTokens: OPTIMIZE_MAX_TOKENS,
    temperature: 0.1,
    messages: [
      { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
      { role: 'user', content: `${retry}${buildOptimizeInput(facts, jdTargets)}` },
    ],
  });

  try {
    return parseOptimizedContent(content);
  } catch (error) {
    if (!jsonRetryMessage) {
      console.error('AI optimization returned invalid content, retrying:', error);
      return requestOptimization(
        facts,
        jdTargets,
        'Your previous response was invalid or incomplete JSON. Return exactly one complete minified JSON object with non-empty "summary" and "items". Start with "{" and end with "}".',
      );
    }
    throw new Error('AI returned an invalid optimization response');
  }
}

function normalizeSkill(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#]+/g, '');
}

function resolveSkills(sourceSkills: string[], optimizedSkills: string[], sourceText: string) {
  const renames = new Map<string, string>();
  if (optimizedSkills.length === 0) return { skills: sourceSkills, renames };

  const remaining = new Map(sourceSkills.map((skill) => [normalizeSkill(skill), skill]));
  const resolved: string[] = [];

  for (const skill of optimizedSkills) {
    const key = normalizeSkill(skill);
    if (remaining.has(key)) {
      // Same skill; allow the JD-terminology rewrite as long as the source supports it.
      const chosen = sourceContains(sourceText, skill) ? skill : remaining.get(key)!;
      resolved.push(chosen);
      renames.set(key, chosen);
      remaining.delete(key);
    }
  }

  // Anything the model dropped or renamed beyond recognition stays, in source order.
  resolved.push(...remaining.values());
  return { skills: resolved, renames };
}

function resolveSkillGroups(
  facts: ExtractedResume,
  orderedSkills: string[],
  renames: Map<string, string>,
) {
  if (!facts.skillGroups?.length) return undefined;

  const order = new Map(orderedSkills.map((skill, index) => [normalizeSkill(skill), index]));
  return facts.skillGroups.map((group) => ({
    label: group.label,
    skills: [...group.skills]
      .map((skill) => renames.get(normalizeSkill(skill)) || skill)
      .sort((left, right) => (
        (order.get(normalizeSkill(left)) ?? Number.MAX_SAFE_INTEGER)
        - (order.get(normalizeSkill(right)) ?? Number.MAX_SAFE_INTEGER)
      )),
  }));
}

function assembleItems(
  sourceItems: ResumeItem[],
  prefix: string,
  optimizedById: Map<string, string[]>,
  bulletLimit: number,
): ResumeItem[] {
  return sourceItems.map((item, index) => ({
    ...item,
    bullets: (optimizedById.get(`${prefix}-${index}`) ?? item.bullets).slice(0, bulletLimit),
  }));
}

export function assembleResumeData(
  facts: ExtractedResume,
  optimized: OptimizedContent,
  sourceText: string,
): ResumeData {
  const optimizedById = new Map(optimized.items.map((item) => [item.id, item.bullets]));
  const { skills, renames } = resolveSkills(facts.skills, optimized.skills, sourceText);

  const assembled: ResumeData = {
    // Locked facts: copied from extraction, never from the optimizer's output.
    name: facts.name,
    contact: facts.contact,
    education: facts.education,
    additionalInformation: facts.additionalInformation,
    experience: assembleItems(facts.experience, 'exp', optimizedById, MAX_EXPERIENCE_BULLETS),
    projects: assembleItems(facts.projects, 'proj', optimizedById, MAX_PROJECT_BULLETS),
    // Optimized content:
    summary: optimized.summary,
    skills,
    skillGroups: resolveSkillGroups(facts, skills, renames),
    addedKeywords: [],
  };

  const generatedText = [
    assembled.summary,
    ...assembled.experience.flatMap((item) => item.bullets),
    ...assembled.projects.flatMap((item) => item.bullets),
  ].join('\n');

  const normalizeLocation = (location: string) => {
    if (/summ/i.test(location)) return 'summary';
    if (/proj/i.test(location)) return 'projects';
    return 'experience';
  };

  assembled.addedKeywords = optimized.addedKeywords
    .filter((item) => (
      sourceContains(sourceText, item.keyword)
      && generatedText.toLowerCase().includes(item.keyword.toLowerCase())
    ))
    .map((item) => ({ ...item, location: normalizeLocation(item.location) }));

  return assembled;
}

export async function optimizeResume(
  facts: ExtractedResume,
  jdTargets: string,
  sourceText: string,
): Promise<ResumeData> {
  const optimized = await requestOptimization(facts, jdTargets);
  return assembleResumeData(facts, optimized, sourceText);
}
