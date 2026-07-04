import { chatCompletion } from '@/lib/ai/openrouter';

const OCR_TIMEOUT_MS = 90_000;
const OCR_MAX_TOKENS = 8_000;

const OCR_PROMPT = `Transcribe every piece of text in this resume document exactly as written.
- Preserve the original wording, spelling, numbers, and dates precisely. Do not summarize, correct, or omit anything.
- For multi-column layouts, transcribe one column/section at a time in logical reading order (header first, then left column top-to-bottom, then right column).
- Keep section headings on their own lines and each bullet point on its own line.
- Output plain text only. No commentary, no markdown.`;

export async function ocrResumeFile(buffer: Buffer, mime: string, filename: string): Promise<string> {
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const isPdf = mime === 'application/pdf';

  const text = await chatCompletion({
    responseFormat: 'text',
    timeoutMs: OCR_TIMEOUT_MS,
    maxTokens: OCR_MAX_TOKENS,
    temperature: 0,
    // "native" lets the multimodal model read the PDF pages itself, which
    // handles scanned/image-only PDFs.
    plugins: isPdf ? [{ id: 'file-parser', pdf: { engine: 'native' } }] : undefined,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: OCR_PROMPT },
        isPdf
          ? { type: 'file', file: { filename, file_data: dataUrl } }
          : { type: 'image_url', image_url: { url: dataUrl } },
      ],
    }],
  });

  return text.trim();
}
