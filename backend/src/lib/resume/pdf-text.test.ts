import { describe, expect, it } from 'vitest';
import { detectResumeFileKind } from './pdf-text';

describe('detectResumeFileKind', () => {
  it('detects PDFs by magic bytes regardless of filename', () => {
    const buffer = Buffer.from('%PDF-1.7 rest of file');
    expect(detectResumeFileKind(buffer, 'whatever.bin')?.kind).toBe('pdf');
  });

  it('detects DOCX only when the zip container has a .docx name', () => {
    const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(detectResumeFileKind(zip, 'resume.docx')?.kind).toBe('docx');
    expect(detectResumeFileKind(zip, 'archive.zip')).toBeNull();
  });

  it('detects PNG, JPEG, and WEBP images', () => {
    const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n')]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

    expect(detectResumeFileKind(png, 'shot.png')?.mime).toBe('image/png');
    expect(detectResumeFileKind(jpeg, 'photo.jpg')?.mime).toBe('image/jpeg');
    expect(detectResumeFileKind(webp, 'pic.webp')?.mime).toBe('image/webp');
  });

  it('rejects unknown file contents even with a .pdf name', () => {
    const text = Buffer.from('just some plain text pretending to be a pdf');
    expect(detectResumeFileKind(text, 'resume.pdf')).toBeNull();
  });
});
