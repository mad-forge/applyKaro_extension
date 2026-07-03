import type { TaxonomyEntry } from './types';

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/node\.js/g, 'nodejs')
    .replace(/react\.js/g, 'reactjs')
    .replace(/next\.js/g, 'nextjs')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitIntoLines(value: string) {
  return value
    .split(/\n|[•●▪]|;|(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function containsAlias(text: string, entry: TaxonomyEntry) {
  const normalizedText = ` ${normalizeText(text)} `;
  return entry.aliases.some((alias) => normalizedText.includes(` ${normalizeText(alias)} `));
}

export function findEvidence(text: string, entry: TaxonomyEntry) {
  return splitIntoLines(text).find((line) => containsAlias(line, entry)) || '';
}

export function unique<T>(items: T[]) {
  return [...new Set(items)];
}
