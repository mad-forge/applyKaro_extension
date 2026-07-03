import type { AdditionalItem, EducationItem, ResumeData, ResumeItem } from '@/components/ResumePDF';
import { extractJsonObject } from '@/lib/ai/openrouter';

export function parseModelResume(content: unknown): ResumeData {
  if (typeof content !== 'string') throw new Error('AI returned an empty response');
  const parsed = JSON.parse(extractJsonObject(content)) as Record<string, unknown>;

  const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const optionalFactualValue = (value: unknown) => {
    const text = stringValue(value);
    return /^(empty|none|n\/a|null|not provided)$/i.test(text) ? '' : text;
  };
  const stringArray = (value: unknown) => Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
  const recordArray = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
  const resumeItems = (value: unknown): ResumeItem[] => recordArray(value).map((item) => ({
    title: stringValue(item.title),
    organization: optionalFactualValue(item.organization),
    duration: optionalFactualValue(item.duration),
    bullets: stringArray(item.bullets),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));
  const educationItems = (value: unknown): EducationItem[] => recordArray(value).map((item) => ({
    institution: stringValue(item.institution),
    degree: stringValue(item.degree),
    duration: optionalFactualValue(item.duration),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));
  const additionalItems = (value: unknown): AdditionalItem[] => recordArray(value).map((item) => ({
    label: stringValue(item.label),
    value: stringValue(item.value),
    sourceEvidence: stringValue(item.sourceEvidence),
  }));

  const skillGroups = recordArray(parsed.skillGroups)
    .map((group) => ({
      label: stringValue(group.label),
      skills: stringArray(group.skills),
    }))
    .filter((group) => group.label && group.skills.length > 0);

  return {
    name: stringValue(parsed.name),
    contact: stringValue(parsed.contact),
    summary: stringValue(parsed.summary),
    skills: stringArray(parsed.skills),
    skillGroups,
    experience: resumeItems(parsed.experience),
    projects: resumeItems(parsed.projects),
    education: educationItems(parsed.education),
    additionalInformation: additionalItems(parsed.additionalInformation),
    addedKeywords: recordArray(parsed.addedKeywords).map((item) => ({
      keyword: stringValue(item.keyword),
      location: stringValue(item.location),
    })).filter((item) => item.keyword && item.location),
  };
}
