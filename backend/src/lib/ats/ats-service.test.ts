import { describe, expect, it } from 'vitest';
import { createAtsReport, createAtsReportFromAnalysis } from './ats-service';
import { analyzeJobDescriptionWithTaxonomy } from './jd-analyzer';
import type { JdAnalysis, JdRequirement } from './types';

const jd = `
Required Skills
Strong knowledge of React.js, JavaScript ES6+, HTML5, CSS3, and RESTful APIs.
Experience with Git and Agile/Scrum practices.
Good to Have
Exposure to TypeScript and familiarity with Jest.
Bachelor's degree in Computer Science or related field.
2-4 years of frontend development experience.
`;

describe('analyzeJobDescriptionWithTaxonomy', () => {
  it('canonicalizes aliases and separates required from preferred skills', () => {
    const analysis = analyzeJobDescriptionWithTaxonomy(jd);

    expect(analysis.requiredSkills).toContain('React');
    expect(analysis.requiredSkills).toContain('JavaScript');
    expect(analysis.requiredSkills).toContain('REST APIs');
    expect(analysis.preferredSkills).toContain('TypeScript');
    expect(analysis.preferredSkills).toContain('Jest');
    expect(analysis.educationRequirements).toHaveLength(1);
    expect(analysis.experienceRequirements).toHaveLength(1);
    expect(analysis.analysisSource).toBe('taxonomy-fallback');
  });

  it('does not let a later preferred marker downgrade earlier required terms', () => {
    const analysis = analyzeJobDescriptionWithTaxonomy(
      'Required: React.js and JavaScript. Good to have: TypeScript and Jest.',
    );
    expect(analysis.requiredSkills).toEqual(expect.arrayContaining(['React', 'JavaScript']));
    expect(analysis.preferredSkills).toEqual(expect.arrayContaining(['TypeScript', 'Jest']));
  });
});

describe('createAtsReport', () => {
  it('matches aliases and reports unsupported capabilities without inventing them', () => {
    const resume = `
Frontend Developer
Built responsive frontend features using React JS, Javascript, HTML, and CSS.
Integrated REST APIs and collaborated in Agile sprints using GitHub.
BCA, Computer Science.
4+ years of experience.
`;
    const report = createAtsReport(resume, jd);

    expect(report.atsScore.score).toBeGreaterThan(60);
    expect(report.keywordAnalysis.matched).toContain('React');
    expect(report.keywordAnalysis.matched).toContain('JavaScript');
    expect(report.keywordAnalysis.missing).toContain('TypeScript');
    expect(report.gapAnalysis.capabilityGaps.some((gap) => gap.term === 'TypeScript')).toBe(true);
  });

  it('returns a lower score when required skills are absent', () => {
    const report = createAtsReport('Manual QA tester with Jira experience.', jd);
    expect(report.atsScore.score).toBeLessThan(50);
    expect(report.atsScore.missingSkills.some((skill) => skill.name === 'React')).toBe(true);
  });
});

describe('createAtsReportFromAnalysis (deep analysis)', () => {
  const requirement = (name: string, priority: JdRequirement['priority'], aliases: string[] = []): JdRequirement => ({
    name,
    category: 'skill',
    level: priority === 'nice-to-have' ? 'preferred' : 'required',
    priority,
    aliases,
    evidence: `JD mentions ${name}`,
  });

  const deepAnalysis: JdAnalysis = {
    roleTitle: 'Content Operations Analyst',
    seniority: 'mid',
    summary: 'Manage JIRA-driven content workflows.',
    responsibilities: ['Analyze and resolve JIRA tickets', 'Manage CMS content updates'],
    qualifications: {
      education: ['Bachelor degree'],
      experienceYears: '2+ years of experience',
      certifications: [],
    },
    atsKeywords: ['JIRA', 'content management', 'stakeholder communication'],
    analysisSource: 'ai',
    requiredSkills: ['JIRA', 'Content Management'],
    preferredSkills: ['Confluence'],
    technologies: [],
    frameworks: [],
    tools: [],
    educationRequirements: ['Bachelor degree'],
    experienceRequirements: ['2+ years of experience'],
    requirements: [
      requirement('JIRA', 'critical', ['jira tickets']),
      requirement('Content Management', 'critical', ['cms', 'content management system']),
      requirement('Stakeholder Communication', 'important', ['stakeholder management']),
      requirement('Confluence', 'nice-to-have'),
    ],
  };

  it('scores non-taxonomy skills through the deep analysis requirements', () => {
    const resume = `
Operations Analyst with 3+ years of experience.
Resolved JIRA tickets and managed CMS content publishing workflows.
Bachelor of Commerce.
`;
    const report = createAtsReportFromAnalysis(resume, deepAnalysis);

    expect(report.keywordAnalysis.matched).toContain('JIRA');
    expect(report.keywordAnalysis.matched).toContain('Content Management');
    expect(report.keywordAnalysis.missing).toContain('Confluence');
    expect(report.atsScore.score).toBeGreaterThan(50);
  });

  it('weights critical requirements more than nice-to-haves', () => {
    const criticalOnlyResume = 'Managed JIRA tickets and content management workflows for 3+ years. Bachelor degree.';
    const niceOnlyResume = 'Used Confluence documentation for 3+ years. Bachelor degree.';

    const criticalReport = createAtsReportFromAnalysis(criticalOnlyResume, deepAnalysis);
    const niceReport = createAtsReportFromAnalysis(niceOnlyResume, deepAnalysis);

    expect(criticalReport.atsScore.score).toBeGreaterThan(niceReport.atsScore.score);
  });

  it('flags missing critical skills as capability gaps', () => {
    const report = createAtsReportFromAnalysis('Software developer using Python.', deepAnalysis);
    expect(report.gapAnalysis.capabilityGaps.some((gap) => gap.term === 'JIRA')).toBe(true);
    expect(report.atsScore.score).toBeLessThan(40);
  });
});
