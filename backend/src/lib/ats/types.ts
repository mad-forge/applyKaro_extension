export type SkillCategory =
  | 'skill'
  | 'technology'
  | 'framework'
  | 'tool'
  | 'soft-skill'
  | 'domain'
  | 'certification';
export type RequirementLevel = 'required' | 'preferred';
export type RequirementPriority = 'critical' | 'important' | 'nice-to-have';
export type JdAnalysisSource = 'ai' | 'taxonomy-fallback';

export interface TaxonomyEntry {
  canonical: string;
  aliases: string[];
  category: SkillCategory;
}

export interface JdRequirement {
  name: string;
  category: SkillCategory;
  level: RequirementLevel;
  priority: RequirementPriority;
  aliases: string[];
  evidence: string;
}

export interface JdQualifications {
  education: string[];
  experienceYears: string;
  certifications: string[];
}

export interface JdAnalysis {
  roleTitle: string;
  seniority: string;
  summary: string;
  responsibilities: string[];
  qualifications: JdQualifications;
  atsKeywords: string[];
  analysisSource: JdAnalysisSource;
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
  priority: RequirementPriority;
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
    atsKeywords: number;
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
