import type { AdditionalItem, EducationItem, ResumeData, ResumeItem } from '@/components/ResumePDF';

export function normalizeForEvidence(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactEvidence(value: string) {
  return normalizeForEvidence(value).replace(/\s+/g, '');
}

function evidenceTokens(value: string) {
  return normalizeForEvidence(value).split(' ').filter((token) => token.length >= 2);
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function tokenMatchesSource(token: string, sourceTokens: Set<string>) {
  if (sourceTokens.has(token)) return true;

  const allowedDistance = token.length >= 8 ? 2 : 1;
  for (const sourceToken of sourceTokens) {
    if (Math.abs(sourceToken.length - token.length) > allowedDistance) continue;
    if (levenshteinDistance(token, sourceToken) <= allowedDistance) return true;
  }

  return false;
}

export function sourceContains(source: string, value: string) {
  const normalizedValue = normalizeForEvidence(value);
  if (!normalizedValue) return true;

  const normalizedSource = normalizeForEvidence(source);
  if (normalizedSource.includes(normalizedValue)) return true;

  const compactValue = compactEvidence(value);
  const compactSource = compactEvidence(source);
  if (compactValue.length >= 3 && compactSource.includes(compactValue)) return true;

  const valueTokens = evidenceTokens(value);
  if (valueTokens.length === 0) return true;

  const sourceTokenSet = new Set(evidenceTokens(source));
  const matchedTokens = valueTokens.filter((token) => (
    compactSource.includes(token) || tokenMatchesSource(token, sourceTokenSet)
  ));
  const requiredRatio = valueTokens.length <= 2 ? 1 : 0.8;

  return matchedTokens.length / valueTokens.length >= requiredRatio;
}

function sourceContainsParts(source: string, value: string) {
  if (!value.trim()) return true;
  const parts = value.split(/[\n|,;•&]+/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => sourceContains(source, part));
}

const REQUIRED_ADDITIONAL_SECTIONS = ['languages', 'personal details'];
const SECTION_HEADING_PATTERN = /^(summary|professional summary|objective|skills|technical skills|experience|professional experience|work experience|employment|projects|education|certifications|languages|personal details|personal information|additional information|achievements|interests|hobbies|declaration)\b/i;

function findSourceSection(source: string, section: string) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const startIndex = lines.findIndex((line) => normalizeForEvidence(line).startsWith(section));
  if (startIndex === -1) {
    const normalizedSection = normalizeForEvidence(section);
    const exactHeadingMatch = source.match(new RegExp(`\\b${section.replace(/\s+/g, '\\s+')}\\b`, 'i'))?.[0];
    return exactHeadingMatch ? {
      label: exactHeadingMatch,
      value: exactHeadingMatch,
      sourceEvidence: exactHeadingMatch,
    } : {
      label: normalizedSection.split(' ').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' '),
      value: section,
      sourceEvidence: section,
    };
  }

  const values: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (SECTION_HEADING_PATTERN.test(line)) break;
    values.push(line);
  }

  const sameLineValue = lines[startIndex]
    .replace(new RegExp(`^${section.replace(/\s+/g, '\\s+')}\\s*[:|-]?\\s*`, 'i'), '')
    .trim();
  const value = [sameLineValue, ...values].filter(Boolean).join(' | ').trim();
  return value ? {
    label: lines[startIndex].replace(/[:|-]+$/, '').trim(),
    value,
    sourceEvidence: `${lines[startIndex]} ${values.slice(0, 2).join(' ')}`.trim(),
  } : {
    label: lines[startIndex].replace(/[:|-]+$/, '').trim(),
    value: lines[startIndex],
    sourceEvidence: lines[startIndex],
  };
}

export function ensureRequiredAdditionalSections(source: string, data: ResumeData): ResumeData {
  const additionalInformation = [...data.additionalInformation];

  for (const section of REQUIRED_ADDITIONAL_SECTIONS) {
    const sourceHasSection = normalizeForEvidence(source).includes(section);
    const outputHasSection = additionalInformation.some((item) => normalizeForEvidence(item.label).includes(section));
    if (!sourceHasSection || outputHasSection) continue;

    const sourceSection = findSourceSection(source, section);
    if (sourceSection) additionalInformation.push(sourceSection);
  }

  return { ...data, additionalInformation };
}

function contactIsSupported(source: string, contact: string) {
  const sourceNormalized = normalizeForEvidence(source);
  const meaningfulTokens = normalizeForEvidence(contact).split(' ').filter((token) => token.length >= 4);
  return meaningfulTokens.length > 0 && meaningfulTokens.every((token) => sourceNormalized.includes(token));
}

export function sanitizeOptionalData(source: string, data: ResumeData): ResumeData {
  const supportedSkills = data.skills.filter((skill) => sourceContains(source, skill));
  const supportedKeywords = data.addedKeywords.filter((item) => sourceContains(source, item.keyword));
  const compactItems = (items: ResumeItem[], limit: number) => items.map((item) => ({
    ...item,
    bullets: item.bullets.slice(0, limit),
  }));
  const compactAdditionalInformation = data.additionalInformation.map((item) => ({
    ...item,
    value: item.value.split('\n').map((part) => part.trim()).filter(Boolean).join(' | '),
  }));

  return {
    ...data,
    skills: supportedSkills,
    addedKeywords: supportedKeywords,
    experience: compactItems(data.experience, 7),
    projects: compactItems(data.projects, 3),
    additionalInformation: compactAdditionalInformation,
  };
}

function validateResumeItem(source: string, item: ResumeItem, path: string, errors: string[]) {
  if (!sourceContains(source, item.title)) errors.push(`${path}.title "${item.title}" was changed or invented`);
  if (!sourceContains(source, item.organization)) errors.push(`${path}.organization "${item.organization}" was changed or invented`);
  if (!sourceContains(source, item.duration)) errors.push(`${path}.duration "${item.duration}" was changed or invented`);
}

function validateEducationItem(source: string, item: EducationItem, path: string, errors: string[]) {
  if (!sourceContains(source, item.institution)) errors.push(`${path}.institution "${item.institution}" was changed or invented`);
  if (!sourceContains(source, item.degree)) errors.push(`${path}.degree "${item.degree}" was changed or invented`);
  if (!sourceContains(source, item.duration)) errors.push(`${path}.duration "${item.duration}" was changed or invented`);
}

function validateAdditionalItem(source: string, item: AdditionalItem, path: string, errors: string[]) {
  if (!sourceContainsParts(source, item.value)) errors.push(`${path}.value "${item.value}" was changed or invented`);
}

export interface ValidateOptions {
  // The extraction path trusts the extractor for section coverage; forcing
  // sections from raw source lines mangles skills-category labels like
  // "Languages: JavaScript, Java" into duplicate additional-info entries.
  enforceRequiredSections?: boolean;
}

export function validateTailoredData(source: string, data: ResumeData, options: ValidateOptions = {}) {
  const { enforceRequiredSections = true } = options;
  const errors: string[] = [];

  if (!sourceContains(source, data.name)) errors.push('name was changed or invented');
  if (!contactIsSupported(source, data.contact)) errors.push('contact details were changed or invented');
  for (const [index, item] of (data.experience || []).entries()) {
    validateResumeItem(source, item, `experience[${index}]`, errors);
  }
  for (const [index, item] of (data.projects || []).entries()) {
    validateResumeItem(source, item, `projects[${index}]`, errors);
  }
  for (const [index, item] of (data.education || []).entries()) {
    validateEducationItem(source, item, `education[${index}]`, errors);
  }
  for (const [index, item] of (data.additionalInformation || []).entries()) {
    validateAdditionalItem(source, item, `additionalInformation[${index}]`, errors);
  }
  if (enforceRequiredSections) {
    for (const section of REQUIRED_ADDITIONAL_SECTIONS) {
      const sourceHasSection = normalizeForEvidence(source).includes(section);
      const outputHasSection = data.additionalInformation.some((item) => normalizeForEvidence(item.label).includes(section));
      if (sourceHasSection && !outputHasSection) errors.push(`additionalInformation is missing the source "${section}" section`);
    }
  }

  return errors;
}
