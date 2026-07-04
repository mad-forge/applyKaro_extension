import { describe, expect, it } from 'vitest';
import type { ResumeData } from '@/components/ResumePDF';
import { createResumeChanges } from './change-preview';
import { withFlattenedSkills } from './extract';

const baseData: ResumeData = {
  name: 'Shashwat',
  contact: 'x@y.com',
  summary: '',
  skills: [],
  experience: [],
  projects: [],
  education: [],
  additionalInformation: [],
  addedKeywords: [],
};

describe('createResumeChanges', () => {
  it('ignores PDF line-break hyphen artifacts when diffing bullets', () => {
    const facts: ResumeData = {
      ...baseData,
      experience: [{
        title: 'SDE I',
        organization: 'Acme',
        duration: '2024',
        bullets: [
          'optimizing complex form work- flows and API interactions.',
          'implemented background job pro- cessing with Node.js',
        ],
        sourceEvidence: '',
      }],
    };
    const tailored: ResumeData = {
      ...baseData,
      experience: [{
        ...facts.experience[0],
        bullets: [
          'optimizing complex form workflows and API interactions.',
          'implemented background job processing with NodeJS',
        ],
      }],
    };

    const changes = createResumeChanges('source text', tailored, facts);
    expect(changes.experienceChanges).toHaveLength(0);
  });

  it('still reports genuinely rewritten bullets', () => {
    const facts: ResumeData = {
      ...baseData,
      experience: [{
        title: 'SDE I',
        organization: 'Acme',
        duration: '2024',
        bullets: ['made website pages'],
        sourceEvidence: '',
      }],
    };
    const tailored: ResumeData = {
      ...baseData,
      experience: [{
        ...facts.experience[0],
        bullets: ['Developed responsive web applications using React.js'],
      }],
    };

    const changes = createResumeChanges('source', tailored, facts);
    expect(changes.experienceChanges).toHaveLength(1);
    expect(changes.experienceChanges[0].before).toBe('made website pages');
  });
});

describe('withFlattenedSkills', () => {
  it('fills the flat skills list from skillGroups when the model leaves it empty', () => {
    const data: ResumeData = {
      ...baseData,
      skills: [],
      skillGroups: [
        { label: 'Languages', skills: ['JavaScript', 'Java'] },
        { label: 'Frontend', skills: ['React.js', 'JavaScript'] },
      ],
    };
    expect(withFlattenedSkills(data).skills).toEqual(['JavaScript', 'Java', 'React.js']);
  });

  it('leaves a populated skills list untouched', () => {
    const data: ResumeData = {
      ...baseData,
      skills: ['SQL'],
      skillGroups: [{ label: 'Languages', skills: ['JavaScript'] }],
    };
    expect(withFlattenedSkills(data).skills).toEqual(['SQL']);
  });
});
