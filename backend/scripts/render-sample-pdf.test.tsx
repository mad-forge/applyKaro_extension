// Dev utility (runs under vitest so TSX just works):
//   npx vitest run scripts/render-sample-pdf.test.tsx
// Renders ResumePDF with realistic tailored data to scripts/out/sample-resume.pdf
// so the layout can be eyeballed without the extension. Set RESUME_DATA_JSON to
// a tailoredData JSON file to render real pipeline output instead.
import { expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { ResumePDF, type ResumeData } from '@/components/ResumePDF';

const sampleData: ResumeData = {
  name: 'Shashwat Muzumdar',
  contact: 'shashwat11muz@gmail.com\n+91 98765 43210\nlinkedin.com/in/shashwat\ngithub.com/mad-forge',
  summary: 'Full-stack developer with hands-on experience building AI-powered web applications using React, Next.js, and Node.js. Shipped a Chrome extension and REST APIs used in production, with a focus on ATS-friendly document generation and LLM integration.',
  skills: [],
  skillGroups: [
    { label: 'Languages', skills: ['JavaScript', 'TypeScript', 'Python', 'SQL'] },
    { label: 'Frameworks', skills: ['React', 'Next.js', 'Node.js', 'Express', 'Tailwind CSS'] },
    { label: 'Tools & Cloud', skills: ['Cloudflare R2', 'Supabase', 'Git', 'Docker', 'Vite'] },
  ],
  experience: [
    {
      title: 'Software Developer Intern',
      organization: 'Codebucket Solutions',
      duration: 'Jan 2026 – Present',
      bullets: [
        'Built REST APIs in Next.js serving 3 internal dashboards, cutting manual report time by 40%.',
        'Integrated LLM-based document parsing that processes 500+ PDFs per week with validation guards.',
        'Set up Cloudflare R2 object storage with presigned URLs for secure file delivery.',
      ],
      sourceEvidence: '',
    },
  ],
  projects: [
    {
      title: 'ApplyKro — AI Resume Tailor',
      organization: 'Personal Project',
      duration: '2026',
      bullets: [
        'Chrome side-panel extension that scores resumes against job descriptions like an ATS and generates tailored one-page PDFs.',
        'Two-phase LLM pipeline (extract facts, then optimize wording) keeps employers, dates, and education locked by construction.',
      ],
      sourceEvidence: '',
    },
  ],
  education: [
    {
      institution: 'ABC Institute of Technology',
      degree: 'B.Tech, Computer Science & Engineering',
      duration: '2022 – 2026',
      sourceEvidence: '',
    },
  ],
  additionalInformation: [
    { label: 'Languages', value: 'English, Hindi', sourceEvidence: '' },
  ],
  addedKeywords: [],
};

it('renders the sample tailored resume to a PDF file', async () => {
  const data: ResumeData = process.env.RESUME_DATA_JSON
    ? JSON.parse(readFileSync(process.env.RESUME_DATA_JSON, 'utf8'))
    : sampleData;
  const buffer = await renderToBuffer(<ResumePDF data={data} />);
  expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buffer.length).toBeGreaterThan(1000);

  const outDir = join(__dirname, 'out');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'sample-resume.pdf');
  writeFileSync(outPath, buffer);
  console.log('Wrote', outPath, `${buffer.length} bytes`);
});
