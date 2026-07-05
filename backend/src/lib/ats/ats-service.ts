import { containsAlias, findEvidence, normalizeText, unique } from './text';
import { analyzeJobDescriptionWithTaxonomy } from './jd-analyzer';
import { analyzeJobDescriptionDeep } from './jd-deep-analyzer';
import type {
  AtsReport,
  GapAnalysis,
  JdAnalysis,
  JdRequirement,
  KeywordAnalysis,
  SkillMatch,
  TaxonomyEntry,
} from './types';

const PRIORITY_WEIGHTS = { critical: 3, important: 2, 'nice-to-have': 1 } as const;

function ratio(matched: number, total: number) {
  return total === 0 ? 100 : Math.round((matched / total) * 100);
}

function requirementMatcher(requirement: JdRequirement): TaxonomyEntry {
  return {
    canonical: requirement.name,
    aliases: unique([requirement.name.toLowerCase(), ...requirement.aliases]),
    category: requirement.category,
  };
}

function hasEducationMatch(resume: string, requirements: string[]) {
  if (requirements.length === 0) return 100;
  const normalizedResume = normalizeText(resume);
  const matched = requirements.some((requirement) => {
    const words = normalizeText(requirement).split(' ').filter((word) => word.length > 3);
    return words.some((word) => normalizedResume.includes(word));
  });
  return matched ? 100 : 0;
}

function hasExperienceMatch(resume: string, requirements: string[]) {
  if (requirements.length === 0) return 100;
  const years = [...resume.matchAll(/\b(\d+)\+?\s*years?\b/gi)].map((match) => Number(match[1]));
  const requiredYears = [...requirements.join(' ').matchAll(/\b(\d+)\+?\s*years?\b/gi)].map((match) => Number(match[1]));
  if (requiredYears.length === 0) return 100;
  return Math.max(0, ...years) >= Math.min(...requiredYears) ? 100 : 0;
}

function keywordAnalysis(requirements: JdRequirement[], resume: string): KeywordAnalysis {
  const matched = requirements
    .filter((requirement) => containsAlias(resume, requirementMatcher(requirement)))
    .map((requirement) => requirement.name);
  const missing = requirements
    .filter((requirement) => !matched.includes(requirement.name))
    .map((item) => item.name);
  return { matched: unique(matched), missing: unique(missing) };
}

function atsKeywordCoverage(atsKeywords: string[], resume: string) {
  if (atsKeywords.length === 0) return 100;
  const normalizedResume = ` ${normalizeText(resume)} `;
  const matched = atsKeywords.filter((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return normalizedKeyword && normalizedResume.includes(` ${normalizedKeyword} `);
  });
  return ratio(matched.length, atsKeywords.length);
}

function gapAnalysis(requirements: JdRequirement[], resume: string): GapAnalysis {
  const visibilityGaps = [];
  const wordingGaps = [];
  const capabilityGaps = [];

  for (const requirement of requirements) {
    const matcher = requirementMatcher(requirement);
    const evidence = findEvidence(resume, matcher);
    if (!evidence) {
      capabilityGaps.push({
        term: requirement.name,
        reason: `No evidence of ${requirement.name} was found in the resume.`,
        recommendation: requirement.category === 'soft-skill'
          ? `Show ${requirement.name.toLowerCase()} through what you did in your bullets (e.g. collaboration, stakeholder updates, mentoring) rather than listing it as a skill.`
          : `Do not add ${requirement.name} unless you have genuine experience. Address it through learning or a real project.`,
      });
      continue;
    }
    const evidencePosition = normalizeText(resume).indexOf(normalizeText(evidence));
    if (evidencePosition > normalizeText(resume).length * 0.55) {
      visibilityGaps.push({
        term: requirement.name,
        reason: `${requirement.name} exists but appears late in the resume.`,
        recommendation: `Move the strongest verified ${requirement.name} evidence into the summary, skills, or top experience bullets.`,
      });
    }
    if (!normalizeText(evidence).includes(normalizeText(requirement.name))) {
      wordingGaps.push({
        term: requirement.name,
        reason: `The resume uses an alias or related wording instead of "${requirement.name}".`,
        recommendation: `Use the JD terminology "${requirement.name}" alongside the existing verified wording.`,
      });
    }
  }

  return { visibilityGaps, wordingGaps, capabilityGaps };
}

export function createAtsReportFromAnalysis(resumeText: string, jdAnalysis: JdAnalysis): AtsReport {
  const keywordResult = keywordAnalysis(jdAnalysis.requirements, resumeText);
  const matchedNames = new Set(keywordResult.matched);
  const matchedSkills: SkillMatch[] = jdAnalysis.requirements
    .filter((requirement) => matchedNames.has(requirement.name))
    .map((requirement) => ({
      skill: requirement.name,
      category: requirement.category,
      requirementLevel: requirement.level,
      priority: requirement.priority,
      resumeEvidence: findEvidence(resumeText, requirementMatcher(requirement)),
    }));
  const missingSkills = jdAnalysis.requirements.filter((item) => !matchedNames.has(item.name));

  const required = jdAnalysis.requirements.filter((item) => item.level === 'required');
  const preferred = jdAnalysis.requirements.filter((item) => item.level === 'preferred');
  const requiredMatched = required.filter((item) => matchedNames.has(item.name)).length;
  const preferredMatched = preferred.filter((item) => matchedNames.has(item.name)).length;

  const totalWeight = jdAnalysis.requirements.reduce((sum, item) => sum + PRIORITY_WEIGHTS[item.priority], 0);
  const matchedWeight = jdAnalysis.requirements
    .filter((item) => matchedNames.has(item.name))
    .reduce((sum, item) => sum + PRIORITY_WEIGHTS[item.priority], 0);

  const breakdown = {
    requiredSkills: ratio(requiredMatched, required.length),
    preferredSkills: ratio(preferredMatched, preferred.length),
    keywordCoverage: totalWeight === 0 ? 100 : Math.round((matchedWeight / totalWeight) * 100),
    atsKeywords: atsKeywordCoverage(jdAnalysis.atsKeywords, resumeText),
    education: hasEducationMatch(resumeText, jdAnalysis.educationRequirements),
    experience: hasExperienceMatch(resumeText, jdAnalysis.experienceRequirements),
  };
  const score = Math.round(
    breakdown.requiredSkills * 0.35
    + breakdown.preferredSkills * 0.05
    + breakdown.keywordCoverage * 0.25
    + breakdown.atsKeywords * 0.15
    + breakdown.education * 0.10
    + breakdown.experience * 0.10,
  );

  return {
    jdAnalysis,
    atsScore: {
      score,
      matchedSkills,
      missingSkills,
      matchedKeywords: keywordResult.matched,
      missingKeywords: keywordResult.missing,
      breakdown,
    },
    gapAnalysis: gapAnalysis(jdAnalysis.requirements, resumeText),
    keywordAnalysis: keywordResult,
  };
}

export async function createAtsReportDeep(resumeText: string, jd: string): Promise<AtsReport> {
  const jdAnalysis = await analyzeJobDescriptionDeep(jd);
  return createAtsReportFromAnalysis(resumeText, jdAnalysis);
}

export function createAtsReport(resumeText: string, jd: string): AtsReport {
  return createAtsReportFromAnalysis(resumeText, analyzeJobDescriptionWithTaxonomy(jd));
}
