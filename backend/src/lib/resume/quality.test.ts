import { describe, expect, it } from 'vitest';
import { findTackOnBullets, findUnsupportedLeadTitle, stripTackOn, type OptimizedContent } from './optimize';
import { withDedupedProjects } from './extract';
import type { ResumeData } from '@/components/ResumePDF';

describe('tack-on keyword detection', () => {
  const tackOns = [
    'Developed and maintained robust Cypress automation scripts for web applications, contributing to Performance Optimization.',
    'Collaborated with developers and product owners in Agile sprints to review requirements, demonstrating Communication.',
    'Integrated Cypress tests with CI pipelines using GitHub Action for daily execution, supporting CI/CD.',
    'Developed reusable and modular UI components, focusing on UI/UX.',
  ];

  it('flags bolted-on keyword endings', () => {
    const optimized: OptimizedContent = {
      summary: 'x',
      skills: [],
      items: [{ id: 'exp-0', bullets: tackOns }],
      addedKeywords: [],
    };
    expect(findTackOnBullets(optimized)).toHaveLength(4);
  });

  it('strips the bolted-on clause and keeps a clean sentence', () => {
    expect(stripTackOn(tackOns[1])).toBe('Collaborated with developers and product owners in Agile sprints to review requirements.');
    expect(stripTackOn(tackOns[2])).toBe('Integrated Cypress tests with CI pipelines using GitHub Action for daily execution.');
  });

  it('leaves naturally integrated keywords alone', () => {
    const natural = [
      'Automated regression suites in Cypress and wired them into the CI/CD pipeline.',
      'Managed global application state using Redux Toolkit, improving load performance.',
      'Built responsive UI components, ensuring cross-browser compatibility and mobile-first design.',
    ];
    for (const bullet of natural) {
      expect(stripTackOn(bullet)).toBe(bullet);
    }
  });
});

describe('findUnsupportedLeadTitle', () => {
  const source = 'Detail-oriented QA Engineer with 4+ years of experience in Manual and Automation Testing. QA Analyst | Frontend Developer (React JS) at Codebucket Solutions.';

  it('flags a JD title the source never supports', () => {
    expect(findUnsupportedLeadTitle('Fullstack Engineer with 4+ years of experience in testing.', source)).toBe('Fullstack Engineer');
  });

  it('accepts titles present in the source resume', () => {
    expect(findUnsupportedLeadTitle('QA Engineer with 4+ years of experience.', source)).toBeNull();
    expect(findUnsupportedLeadTitle('Frontend Developer with React JS expertise.', source)).toBeNull();
  });
});

describe('withDedupedProjects', () => {
  it('merges same-titled projects keeping the union of bullets', () => {
    const data = {
      name: '', contact: '', summary: '', skills: [], experience: [], education: [],
      additionalInformation: [], addedKeywords: [],
      projects: [
        { title: 'Pandokhar Sarkar Dham', organization: 'WEB DEVELOPMENT PROJECTS', duration: '2023-25', bullets: ['Developed responsive UI', 'Implemented multilingual support'], sourceEvidence: '' },
        { title: 'ERP System', organization: '', duration: '', bullets: ['Inventory management'], sourceEvidence: '' },
        { title: 'Pandokhar  Sarkar Dham', organization: 'LATEST PROJECTS', duration: '', bullets: ['Developed responsive UI', 'Official website for devotees'], sourceEvidence: '' },
      ],
    } as ResumeData;

    const result = withDedupedProjects(data);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].bullets).toEqual([
      'Developed responsive UI',
      'Implemented multilingual support',
      'Official website for devotees',
    ]);
    expect(result.projects[0].organization).toBe('WEB DEVELOPMENT PROJECTS');
  });
});
