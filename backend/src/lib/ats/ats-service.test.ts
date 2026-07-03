import { describe, expect, it } from 'vitest';
import { createAtsReport } from './ats-service';
import { analyzeJobDescription } from './jd-analyzer';

const jd = `
Required Skills
Strong knowledge of React.js, JavaScript ES6+, HTML5, CSS3, and RESTful APIs.
Experience with Git and Agile/Scrum practices.
Good to Have
Exposure to TypeScript and familiarity with Jest.
Bachelor's degree in Computer Science or related field.
2-4 years of frontend development experience.
`;

describe('analyzeJobDescription', () => {
  it('canonicalizes aliases and separates required from preferred skills', () => {
    const analysis = analyzeJobDescription(jd);

    expect(analysis.requiredSkills).toContain('React');
    expect(analysis.requiredSkills).toContain('JavaScript');
    expect(analysis.requiredSkills).toContain('REST APIs');
    expect(analysis.preferredSkills).toContain('TypeScript');
    expect(analysis.preferredSkills).toContain('Jest');
    expect(analysis.educationRequirements).toHaveLength(1);
    expect(analysis.experienceRequirements).toHaveLength(1);
  });

  it('does not let a later preferred marker downgrade earlier required terms', () => {
    const analysis = analyzeJobDescription(
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
