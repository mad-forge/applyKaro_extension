import { PDFParse } from 'pdf-parse';

export const MAX_RESUME_SIZE_BYTES = 8 * 1024 * 1024;

export async function extractPdfText(file: File) {
  if (file.size > MAX_RESUME_SIZE_BYTES) throw new Error('Resume PDF must be smaller than 8 MB');
  if (file.type && file.type !== 'application/pdf') throw new Error('Only PDF resumes are supported');

  const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
  try {
    const text = (await parser.getText()).text.trim();
    if (text.replace(/\s+/g, '').length < 100) {
      throw new Error('Could not extract enough text from the uploaded resume');
    }
    return text;
  } finally {
    await parser.destroy();
  }
}
