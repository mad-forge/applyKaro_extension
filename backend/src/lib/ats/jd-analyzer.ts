import { EDUCATION_TERMS, PREFERRED_MARKERS, REQUIRED_MARKERS, SKILL_TAXONOMY } from './taxonomy';
import { containsAlias, normalizeText, splitIntoLines, unique } from './text';
import type { JdAnalysis, JdRequirement, RequirementLevel } from './types';

function requirementLevel(line: string, fallback: RequirementLevel): RequirementLevel {
  const normalized = normalizeText(line);
  if (PREFERRED_MARKERS.some((marker) => normalized.includes(normalizeText(marker)))) return 'preferred';
  if (REQUIRED_MARKERS.some((marker) => normalized.includes(normalizeText(marker)))) return 'required';
  return fallback;
}

export function analyzeJobDescriptionWithTaxonomy(jd: string): JdAnalysis {
  const lines = splitIntoLines(jd);
  const requirements = new Map<string, JdRequirement>();
  let currentLevel: RequirementLevel = 'required';

  for (const line of lines) {
    const normalizedLine = normalizeText(line);
    if (PREFERRED_MARKERS.some((marker) => normalizedLine.includes(normalizeText(marker)))) currentLevel = 'preferred';
    if (REQUIRED_MARKERS.some((marker) => normalizedLine.includes(normalizeText(marker)))) currentLevel = 'required';
    for (const entry of SKILL_TAXONOMY) {
      if (!containsAlias(line, entry)) continue;
      const level = requirementLevel(line, currentLevel);
      const existing = requirements.get(entry.canonical);
      if (!existing || existing.level === 'preferred' && level === 'required') {
        requirements.set(entry.canonical, {
          name: entry.canonical,
          category: entry.category,
          level,
          priority: level === 'preferred' ? 'nice-to-have' : 'important',
          aliases: entry.aliases,
          evidence: line,
        });
      }
    }
  }

  const normalizedJd = normalizeText(jd);
  const educationRequirements = unique(
    lines.filter((line) => EDUCATION_TERMS.some((term) => normalizeText(line).includes(normalizeText(term)))),
  );
  const experienceRequirements = unique(
    lines.filter((line) => /\b\d+\s*(?:\+|plus|-|to)?\s*\d*\s*years?\b/i.test(line)),
  );
  const all = [...requirements.values()];

  return {
    roleTitle: '',
    seniority: 'unspecified',
    summary: '',
    responsibilities: [],
    qualifications: {
      education: educationRequirements,
      experienceYears: experienceRequirements[0] || '',
      certifications: [],
    },
    atsKeywords: all.map((item) => item.name),
    analysisSource: 'taxonomy-fallback',
    requiredSkills: all.filter((item) => item.level === 'required').map((item) => item.name),
    preferredSkills: all.filter((item) => item.level === 'preferred').map((item) => item.name),
    technologies: all.filter((item) => item.category === 'technology').map((item) => item.name),
    frameworks: all.filter((item) => item.category === 'framework').map((item) => item.name),
    tools: all.filter((item) => item.category === 'tool').map((item) => item.name),
    educationRequirements: normalizedJd ? educationRequirements : [],
    experienceRequirements,
    requirements: all,
  };
}
