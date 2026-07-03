import { describe, expect, it } from 'vitest';
import { assembleResumeData, type OptimizedContent } from './optimize';
import type { ExtractedResume } from './extract';

const sourceText = `
Shashwat Kumar
shashwat@example.com | +91 99999 99999
Software Engineer at TechCorp Pvt Ltd, Jan 2022 - Present
- Built web pages with ReactJS and integrated REST endpoints
- Fixed UI bugs reported by QA
Portfolio Website (personal project)
- Made a personal site with Next.js
B.Tech Computer Science, IIT Delhi, 2018 - 2022
Skills: ReactJS, JavaScript, Node.js
Languages: Hindi, English
`;

const facts: ExtractedResume = {
  name: 'Shashwat Kumar',
  contact: 'shashwat@example.com | +91 99999 99999',
  summary: '',
  skills: ['ReactJS', 'JavaScript', 'Node.js'],
  experience: [{
    title: 'Software Engineer',
    organization: 'TechCorp Pvt Ltd',
    duration: 'Jan 2022 - Present',
    bullets: [
      'Built web pages with ReactJS and integrated REST endpoints',
      'Fixed UI bugs reported by QA',
    ],
    sourceEvidence: 'Software Engineer at TechCorp Pvt Ltd, Jan 2022 - Present',
  }],
  projects: [{
    title: 'Portfolio Website',
    organization: '',
    duration: '',
    bullets: ['Made a personal site with Next.js'],
    sourceEvidence: 'Portfolio Website (personal project)',
  }],
  education: [{
    institution: 'IIT Delhi',
    degree: 'B.Tech Computer Science',
    duration: '2018 - 2022',
    sourceEvidence: 'B.Tech Computer Science, IIT Delhi, 2018 - 2022',
  }],
  additionalInformation: [{ label: 'Languages', value: 'Hindi, English', sourceEvidence: 'Languages: Hindi, English' }],
  skillGroups: [
    { label: 'Languages', skills: ['JavaScript'] },
    { label: 'Frontend', skills: ['ReactJS', 'Node.js'] },
  ],
  addedKeywords: [],
};

const optimized: OptimizedContent = {
  summary: 'Software Engineer experienced in React.js development and REST API integration.',
  skills: ['React.js', 'JavaScript', 'Node.js'],
  items: [
    { id: 'exp-0', bullets: ['Developed responsive web applications using React.js, integrating REST APIs', 'Resolved UI defects in collaboration with QA'] },
    { id: 'proj-0', bullets: ['Built a personal portfolio site with Next.js'] },
  ],
  addedKeywords: [
    { keyword: 'React.js', location: 'summary' },
    { keyword: 'Kubernetes', location: 'summary' },
  ],
};

describe('assembleResumeData', () => {
  it('copies every factual field from the extracted facts, ignoring the model for them', () => {
    const result = assembleResumeData(facts, optimized, sourceText);

    expect(result.name).toBe('Shashwat Kumar');
    expect(result.contact).toBe('shashwat@example.com | +91 99999 99999');
    expect(result.experience[0].title).toBe('Software Engineer');
    expect(result.experience[0].organization).toBe('TechCorp Pvt Ltd');
    expect(result.experience[0].duration).toBe('Jan 2022 - Present');
    expect(result.education).toEqual(facts.education);
    expect(result.additionalInformation).toEqual(facts.additionalInformation);
  });

  it('applies optimized bullets by item id and keeps originals for missing ids', () => {
    const partial: OptimizedContent = { ...optimized, items: [{ id: 'exp-0', bullets: ['Rewritten bullet about ReactJS work'] }] };
    const result = assembleResumeData(facts, partial, sourceText);

    expect(result.experience[0].bullets).toEqual(['Rewritten bullet about ReactJS work']);
    expect(result.projects[0].bullets).toEqual(facts.projects[0].bullets);
  });

  it('never lets the model add a skill that is not in the source list', () => {
    const sneaky: OptimizedContent = { ...optimized, skills: ['Kubernetes', 'React.js', 'JavaScript'] };
    const result = assembleResumeData(facts, sneaky, sourceText);

    expect(result.skills).not.toContain('Kubernetes');
    expect(result.skills).toContain('JavaScript');
    expect(result.skills).toContain('Node.js');
    expect(result.skills).toHaveLength(3);
  });

  it('keeps all source skills even when the model drops some', () => {
    const dropped: OptimizedContent = { ...optimized, skills: ['JavaScript'] };
    const result = assembleResumeData(facts, dropped, sourceText);

    expect(result.skills[0]).toBe('JavaScript');
    expect(result.skills).toHaveLength(3);
  });

  it('filters addedKeywords to source-supported keywords present in generated text', () => {
    const result = assembleResumeData(facts, optimized, sourceText);
    const keywords = result.addedKeywords.map((item) => item.keyword);

    expect(keywords).toContain('React.js');
    expect(keywords).not.toContain('Kubernetes');
  });

  it('preserves skill group labels and applies JD-terminology renames inside groups', () => {
    const result = assembleResumeData(facts, optimized, sourceText);

    expect(result.skillGroups?.map((group) => group.label)).toEqual(['Languages', 'Frontend']);
    expect(result.skillGroups?.[1].skills).toContain('React.js');
    expect(result.skillGroups?.[1].skills).not.toContain('Kubernetes');
  });

  it('caps bullets at 7 for experience and 3 for projects', () => {
    const many: OptimizedContent = {
      ...optimized,
      items: [
        { id: 'exp-0', bullets: Array.from({ length: 10 }, (_, i) => `Bullet ${i}`) },
        { id: 'proj-0', bullets: Array.from({ length: 5 }, (_, i) => `Project bullet ${i}`) },
      ],
    };
    const result = assembleResumeData(facts, many, sourceText);

    expect(result.experience[0].bullets).toHaveLength(7);
    expect(result.projects[0].bullets).toHaveLength(3);
  });
});
