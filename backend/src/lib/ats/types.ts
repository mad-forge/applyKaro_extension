export type SkillCategory = 'skill' | 'technology' | 'framework' | 'tool' | 'soft-skill';
export type RequirementLevel = 'required' | 'preferred';

export interface TaxonomyEntry {
  canonical: string;
  aliases: string[];
  category: SkillCategory;
}

export interface JdRequirement {
  name: string;
  category: SkillCategory;
  level: RequirementLevel;
  evidence: string;
}

export interface JdAnalysis {
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  frameworks: string[];
  tools: string[];
  educationRequirements: string[];
  experienceRequirements: string[];
  requirements: JdRequirement[];
}

export interface SkillMatch {
  skill: string;
  category: SkillCategory;
  requirementLevel: RequirementLevel;
  resumeEvidence: string;
}

export interface AtsScore {
  score: number;
  matchedSkills: SkillMatch[];
  missingSkills: JdRequirement[];
  matchedKeywords: string[];
  missingKeywords: string[];
  breakdown: {
    requiredSkills: number;
    preferredSkills: number;
    keywordCoverage: number;
    education: number;
    experience: number;
  };
}

export interface GapItem {
  term: string;
  reason: string;
  recommendation: string;
}

export interface GapAnalysis {
  visibilityGaps: GapItem[];
  wordingGaps: GapItem[];
  capabilityGaps: GapItem[];
}

export interface KeywordAnalysis {
  matched: string[];
  missing: string[];
}

export interface AtsReport {
  jdAnalysis: JdAnalysis;
  atsScore: AtsScore;
  gapAnalysis: GapAnalysis;
  keywordAnalysis: KeywordAnalysis;
}

export interface TextChange {
  before: string;
  after: string;
  location: string;
}

export interface ResumeChanges {
  summaryChanges: TextChange[];
  experienceChanges: TextChange[];
  skillsAdded: string[];
  keywordsAdded: string[];
}
