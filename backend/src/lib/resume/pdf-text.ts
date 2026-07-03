import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export const MAX_RESUME_SIZE_BYTES = 8 * 1024 * 1024;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function assertEnoughText(text: string) {
  if (text.replace(/\s+/g, '').length < 100) {
    throw new Error('Could not extract enough text from the uploaded resume');
  }
  return text;
}

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text.trim();
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractResumeText(file: File) {
  if (file.size > MAX_RESUME_SIZE_BYTES) throw new Error('Resume file must be smaller than 8 MB');

  const isDocx = file.type === DOCX_MIME || /\.docx$/i.test(file.name);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isDocx && !isPdf && file.type) {
    throw new Error('Only PDF and DOCX resumes are supported');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = isDocx ? await extractDocx(buffer) : await extractPdf(buffer);
  return assertEnoughText(text);
}
