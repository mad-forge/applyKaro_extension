import type { ResumeData } from '@/components/ResumePDF';
import type { ResumeChanges, TextChange } from '@/lib/ats/types';
import { normalizeText, unique } from '@/lib/ats/text';

function changed(after: string, source: string) {
  return Boolean(after) && !normalizeText(source).includes(normalizeText(after));
}

export function createResumeChanges(source: string, data: ResumeData): ResumeChanges {
  const summaryChanges: TextChange[] = changed(data.summary, source)
    ? [{ before: 'Original professional summary/objective', after: data.summary, location: 'Professional Summary' }]
    : [];
  const experienceChanges: TextChange[] = [];

  for (const item of [...data.experience, ...data.projects]) {
    for (const bullet of item.bullets) {
      if (!changed(bullet, source)) continue;
      experienceChanges.push({
        before: item.sourceEvidence || 'Source-supported content',
        after: bullet,
        location: item.title,
      });
    }
  }

  return {
    summaryChanges,
    experienceChanges,
    skillsAdded: data.skills.filter((skill) => !normalizeText(source).includes(normalizeText(skill))),
    keywordsAdded: unique(data.addedKeywords.map((item) => item.keyword)),
  };
}
