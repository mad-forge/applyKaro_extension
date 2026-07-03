import { SKILL_TAXONOMY } from './taxonomy';
import { containsAlias, findEvidence, normalizeText, unique } from './text';
import { analyzeJobDescription } from './jd-analyzer';
import type { AtsReport, GapAnalysis, JdRequirement, KeywordAnalysis, SkillMatch } from './types';

function ratio(matched: number, total: number) {
  return total === 0 ? 100 : Math.round((matched / total) * 100);
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
  const matched = requirements.filter((requirement) => {
    const entry = SKILL_TAXONOMY.find((item) => item.canonical === requirement.name);
    return entry ? containsAlias(resume, entry) : false;
  }).map((requirement) => requirement.name);
  const missing = requirements.filter((requirement) => !matched.includes(requirement.name)).map((item) => item.name);
  return { matched: unique(matched), missing: unique(missing) };
}

function gapAnalysis(requirements: JdRequirement[], resume: string): GapAnalysis {
  const visibilityGaps = [];
  const wordingGaps = [];
  const capabilityGaps = [];

  for (const requirement of requirements) {
    const entry = SKILL_TAXONOMY.find((item) => item.canonical === requirement.name);
    if (!entry) continue;
    const evidence = findEvidence(resume, entry);
    if (!evidence) {
      capabilityGaps.push({
        term: requirement.name,
        reason: `No evidence of ${requirement.name} was found in the resume.`,
        recommendation: `Do not add ${requirement.name} unless you have genuine experience. Address it through learning or a real project.`,
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

export function createAtsReport(resumeText: string, jd: string): AtsReport {
  const jdAnalysis = analyzeJobDescription(jd);
  const keywordResult = keywordAnalysis(jdAnalysis.requirements, resumeText);
  const matchedSkills: SkillMatch[] = jdAnalysis.requirements
    .filter((requirement) => keywordResult.matched.includes(requirement.name))
    .map((requirement) => {
      const entry = SKILL_TAXONOMY.find((item) => item.canonical === requirement.name)!;
      return {
        skill: requirement.name,
        category: requirement.category,
        requirementLevel: requirement.level,
        resumeEvidence: findEvidence(resumeText, entry),
      };
    });
  const missingSkills = jdAnalysis.requirements.filter((item) => keywordResult.missing.includes(item.name));

  const required = jdAnalysis.requirements.filter((item) => item.level === 'required');
  const preferred = jdAnalysis.requirements.filter((item) => item.level === 'preferred');
  const requiredMatched = required.filter((item) => keywordResult.matched.includes(item.name)).length;
  const preferredMatched = preferred.filter((item) => keywordResult.matched.includes(item.name)).length;
  const breakdown = {
    requiredSkills: ratio(requiredMatched, required.length),
    preferredSkills: ratio(preferredMatched, preferred.length),
    keywordCoverage: ratio(keywordResult.matched.length, jdAnalysis.requirements.length),
    education: hasEducationMatch(resumeText, jdAnalysis.educationRequirements),
    experience: hasExperienceMatch(resumeText, jdAnalysis.experienceRequirements),
  };
  const score = Math.round(
    breakdown.requiredSkills * 0.45
    + breakdown.preferredSkills * 0.10
    + breakdown.keywordCoverage * 0.25
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
