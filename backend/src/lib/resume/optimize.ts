import type { ResumeData, ResumeItem } from '@/components/ResumePDF';
import { chatCompletion, extractJsonObject } from '@/lib/ai/openrouter';
import type { ExtractedResume } from './extract';
import { sourceContains } from './factual-validation';

const OPTIMIZE_TIMEOUT_MS = 120_000;
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
6. NEVER bolt a keyword onto the end of a bullet with filler such as ", demonstrating X", ", supporting Y", ", focusing on Z", ", contributing to W", ", showcasing V". That reads as machine-written keyword stuffing. A JD keyword may only appear as the natural verb or object of the accomplishment itself (e.g. "Automated regression suites in Cypress and wired them into the CI/CD pipeline"). If a keyword cannot fit naturally, leave the bullet unchanged.
7. Express soft skills (communication, leadership, collaboration) through what was actually done ("partnered with product owners to scope requirements"), never as abstract capitalized nouns.

RULES FOR SUMMARY:
- A direct, evidence-based pitch for this JD. Mention years of experience only if the original resume states them. No fluffy adjectives.
- Lead with a role title that the source resume itself supports (one of the source job titles, or the wording of the source summary). NEVER adopt the JD's title when the source does not support it — a QA/frontend candidate must not be relabeled "Fullstack Engineer".

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
  qualityCorrections: string[] = [],
  jsonRetryMessage = '',
): Promise<OptimizedContent> {
  const corrections = qualityCorrections.length > 0
    ? `\nYour previous response had quality problems. Fix every issue below while keeping all other rules:\n- ${qualityCorrections.join('\n- ')}\n`
    : '';
  const retry = jsonRetryMessage ? `\n${jsonRetryMessage}\n` : '';
  const content = await chatCompletion({
    timeoutMs: OPTIMIZE_TIMEOUT_MS,
    maxTokens: OPTIMIZE_MAX_TOKENS,
    temperature: 0.1,
    messages: [
      { role: 'system', content: OPTIMIZE_SYSTEM_PROMPT },
      { role: 'user', content: `${corrections}${retry}${buildOptimizeInput(facts, jdTargets)}` },
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
        qualityCorrections,
        'Your previous response was invalid or incomplete JSON. Return exactly one complete minified JSON object with non-empty "summary" and "items". Start with "{" and end with "}".',
      );
    }
    throw new Error('AI returned an invalid optimization response');
  }
}

// Detects the classic keyword-stuffing pattern: a comma followed by a filler
// participle and a bolted-on keyword phrase at the very end of a bullet.
const TACK_ON_PATTERN = /,\s+(?:thereby\s+)?(?:demonstrating|showcasing|supporting|contributing to|focusing on|highlighting|emphasizing|reflecting|exhibiting|aligning with)\s+[^,.]{2,60}[.!]?\s*$/i;

export function stripTackOn(bullet: string) {
  if (!TACK_ON_PATTERN.test(bullet)) return bullet;
  const stripped = bullet.replace(TACK_ON_PATTERN, '').trimEnd();
  return /[.!?]$/.test(stripped) ? stripped : `${stripped}.`;
}

export function findTackOnBullets(optimized: OptimizedContent) {
  return optimized.items.flatMap((item) => item.bullets.filter((bullet) => TACK_ON_PATTERN.test(bullet)));
}

// The summary must not relabel the candidate with a JD title the source
// resume never supports (e.g. QA/frontend -> "Fullstack Engineer"). A role
// claim must come from the source's own titles/summary — a project adjective
// like "built a full-stack app" does not make someone a Fullstack Engineer.
export function findUnsupportedLeadTitle(summary: string, titleEvidence: string) {
  const match = summary.match(/^([A-Z][A-Za-z0-9+#./&\- ]{2,50}?)\s+(?:with|having|who|experienced|skilled|specializ|bringing)/);
  if (!match) return null;
  const title = match[1].trim();
  return sourceContains(titleEvidence, title) ? null : title;
}

function titleEvidence(facts: ExtractedResume) {
  return [facts.summary, ...facts.experience.map((item) => item.title)].filter(Boolean).join('\n');
}

function qualityIssues(optimized: OptimizedContent, facts: ExtractedResume) {
  const issues: string[] = [];
  for (const bullet of findTackOnBullets(optimized)) {
    issues.push(`Rewrite this bullet without the bolted-on keyword ending — integrate the keyword naturally or drop it: "${bullet}"`);
  }
  const badTitle = findUnsupportedLeadTitle(optimized.summary, titleEvidence(facts));
  if (badTitle) {
    issues.push(`The summary opens with the title "${badTitle}", which the source resume's own titles do not support. Open with one of the source job titles or the source summary's role wording instead.`);
  }
  return issues;
}

// Last-resort deterministic cleanup when the retry still ships tack-ons or an
// invented title.
function enforceQuality(optimized: OptimizedContent, facts: ExtractedResume): OptimizedContent {
  const items = optimized.items.map((item) => ({
    ...item,
    bullets: item.bullets.map(stripTackOn),
  }));

  let summary = optimized.summary;
  const badTitle = findUnsupportedLeadTitle(summary, titleEvidence(facts));
  const fallbackTitle = facts.experience[0]?.title;
  if (badTitle && fallbackTitle) {
    summary = summary.replace(badTitle, fallbackTitle);
  }

  return { ...optimized, items, summary };
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

  const seenKeywordLocations = new Set<string>();
  assembled.addedKeywords = optimized.addedKeywords
    .filter((item) => (
      sourceContains(sourceText, item.keyword)
      && generatedText.toLowerCase().includes(item.keyword.toLowerCase())
    ))
    .map((item) => ({ ...item, location: normalizeLocation(item.location) }))
    // The model can independently report the same keyword for the same
    // section from two different bullets; that reads as a duplicate row
    // in the "Keywords incorporated" list, so keep only the first mention.
    .filter((item) => {
      const dedupeKey = `${item.keyword.toLowerCase()}|${item.location}`;
      if (seenKeywordLocations.has(dedupeKey)) return false;
      seenKeywordLocations.add(dedupeKey);
      return true;
    });

  return assembled;
}

export async function optimizeResume(
  facts: ExtractedResume,
  jdTargets: string,
  sourceText: string,
): Promise<ResumeData> {
  let optimized = await requestOptimization(facts, jdTargets);

  const issues = qualityIssues(optimized, facts);
  if (issues.length > 0) {
    console.warn('Optimization quality issues, retrying with corrections:', issues);
    optimized = await requestOptimization(facts, jdTargets, issues);
  }
  optimized = enforceQuality(optimized, facts);

  return assembleResumeData(facts, optimized, sourceText);
}
