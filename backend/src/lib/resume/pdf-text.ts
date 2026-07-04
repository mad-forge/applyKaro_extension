import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { isOpenRouterConfigured } from '@/lib/ai/openrouter';
import { RequestValidationError } from '@/lib/http/request-validation';
import { ocrResumeFile } from './ocr';

export const MAX_RESUME_SIZE_BYTES = 8 * 1024 * 1024;
const MIN_TEXT_CHARS = 100;

export type ResumeFileKind =
  | { kind: 'pdf'; mime: 'application/pdf' }
  | { kind: 'docx'; mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  | { kind: 'image'; mime: 'image/png' | 'image/jpeg' | 'image/webp' };

// Detect by magic bytes, not by filename/mime — users rename anything.
export function detectResumeFileKind(buffer: Buffer, filename: string): ResumeFileKind | null {
  if (buffer.subarray(0, 5).toString('latin1').startsWith('%PDF')) {
    return { kind: 'pdf', mime: 'application/pdf' };
  }
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    // ZIP container; trust it as DOCX only when the name/extension agrees.
    if (/\.docx$/i.test(filename)) {
      return { kind: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    return null;
  }
  if (buffer[0] === 0x89 && buffer.subarray(1, 4).toString('latin1') === 'PNG') {
    return { kind: 'image', mime: 'image/png' };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { kind: 'image', mime: 'image/jpeg' };
  }
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { kind: 'image', mime: 'image/webp' };
  }
  return null;
}

function hasEnoughText(text: string) {
  return text.replace(/\s+/g, '').length >= MIN_TEXT_CHARS;
}

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/encrypt|password/i.test(message)) {
      throw new RequestValidationError('This PDF is password-protected. Remove the password and upload it again.', 422);
    }
    throw new RequestValidationError('Could not read this PDF. Re-export your resume as a standard PDF and try again.', 422);
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch {
    throw new RequestValidationError('Could not read this DOCX file. Re-save it from your editor or export it as PDF.', 422);
  }
}

async function ocrOrExplain(buffer: Buffer, mime: string, filename: string, explanation: string) {
  if (!isOpenRouterConfigured()) {
    throw new RequestValidationError(`${explanation} (AI OCR is not configured on the backend.)`, 422);
  }
  const text = await ocrResumeFile(buffer, mime, filename);
  if (!hasEnoughText(text)) {
    throw new RequestValidationError(explanation, 422);
  }
  return text;
}

export async function extractResumeText(file: File) {
  if (file.size === 0) {
    throw new RequestValidationError('The uploaded resume file is empty.', 400);
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    throw new RequestValidationError('Resume file must be smaller than 8 MB.', 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = detectResumeFileKind(buffer, file.name || '');
  if (!detected) {
    throw new RequestValidationError('This file is not a readable PDF, DOCX, or image. Export your resume as a PDF and upload that.', 400);
  }

  if (detected.kind === 'docx') {
    const text = await extractDocx(buffer);
    if (!hasEnoughText(text)) {
      throw new RequestValidationError('Could not find readable text in this DOCX. Export your resume as a PDF and try again.', 422);
    }
    return text;
  }

  if (detected.kind === 'image') {
    return ocrOrExplain(
      buffer,
      detected.mime,
      file.name || 'resume-image',
      'Could not read enough text from this image. Upload a clearer screenshot or export your resume as a PDF.',
    );
  }

  const text = await extractPdf(buffer);
  if (hasEnoughText(text)) return text;

  // Scanned / image-only / designer-flattened PDF: fall back to AI OCR.
  return ocrOrExplain(
    buffer,
    detected.mime,
    file.name || 'resume.pdf',
    'This PDF appears to be scanned or image-based and no text could be read from it. Export a text-based PDF and try again.',
  );
}
