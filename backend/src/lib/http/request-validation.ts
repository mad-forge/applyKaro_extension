export const MAX_JD_CHARS = 60_000;
export const MIN_JD_CHARS = 80;

export class RequestValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

export function validateTailorInput(jd: unknown, resume: unknown) {
  if (!(resume instanceof File)) {
    throw new RequestValidationError('Missing PDF resume file');
  }
  if (typeof jd !== 'string' || !jd.trim()) {
    throw new RequestValidationError('Missing job description');
  }

  const cleanJd = jd.trim();
  if (cleanJd.length < MIN_JD_CHARS) {
    throw new RequestValidationError(`The job description is too short to analyze (minimum ${MIN_JD_CHARS} characters). Paste the full JD.`);
  }
  if (cleanJd.length > MAX_JD_CHARS) {
    throw new RequestValidationError(`The job description is too long (maximum ${MAX_JD_CHARS.toLocaleString()} characters).`);
  }

  return { jd: cleanJd, resume };
}
