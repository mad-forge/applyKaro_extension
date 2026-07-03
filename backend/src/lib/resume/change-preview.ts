import type { ResumeData, ResumeItem } from '@/components/ResumePDF';
import type { ResumeChanges, TextChange } from '@/lib/ats/types';
import { normalizeText, unique } from '@/lib/ats/text';

function sameText(left: string, right: string) {
  return normalizeText(left) === normalizeText(right);
}

function itemChanges(sourceItems: ResumeItem[], tailoredItems: ResumeItem[]): TextChange[] {
  const changes: TextChange[] = [];

  for (const [index, tailoredItem] of tailoredItems.entries()) {
    const sourceItem = sourceItems[index];
    const originalBullets = sourceItem?.bullets || [];

    for (const [bulletIndex, bullet] of tailoredItem.bullets.entries()) {
      // A bullet that matches any original bullet was only moved, not rewritten.
      if (originalBullets.some((original) => sameText(original, bullet))) continue;
      changes.push({
        before: originalBullets[bulletIndex] || tailoredItem.sourceEvidence || 'Source-supported content',
        after: bullet,
        location: tailoredItem.title,
      });
    }
  }

  return changes;
}

export function createResumeChanges(
  source: string,
  data: ResumeData,
  facts?: ResumeData,
): ResumeChanges {
  const originalSummary = facts?.summary || 'Original professional summary/objective';
  const summaryChanges: TextChange[] = data.summary && !sameText(originalSummary, data.summary)
    ? [{ before: originalSummary, after: data.summary, location: 'Professional Summary' }]
    : [];

  const experienceChanges = facts
    ? [
      ...itemChanges(facts.experience, data.experience),
      ...itemChanges(facts.projects, data.projects),
    ]
    : legacyItemChanges(source, data);

  return {
    summaryChanges,
    experienceChanges,
    skillsAdded: data.skills.filter((skill) => !normalizeText(source).includes(normalizeText(skill))),
    keywordsAdded: unique(data.addedKeywords.map((item) => item.keyword)),
  };
}

function legacyItemChanges(source: string, data: ResumeData): TextChange[] {
  const changes: TextChange[] = [];
  for (const item of [...data.experience, ...data.projects]) {
    for (const bullet of item.bullets) {
      if (normalizeText(source).includes(normalizeText(bullet))) continue;
      changes.push({
        before: item.sourceEvidence || 'Source-supported content',
        after: bullet,
        location: item.title,
      });
    }
  }
  return changes;
}
