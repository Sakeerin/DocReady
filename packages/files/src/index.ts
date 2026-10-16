/**
 * Validates file magic bytes to prevent malformed or extension-spoofed uploads.
 */
export function validateFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  if (mimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }

  return false;
}

export interface PdfInspectionResult {
  isEncrypted: boolean;
  pageCount: number;
  isValidPdf: boolean;
}

/**
 * Inspects PDF header structure to detect password encryption & page count safely.
 */
export function inspectPdfHeader(buffer: Buffer): PdfInspectionResult {
  if (!validateFileMagicBytes(buffer, 'application/pdf')) {
    return { isEncrypted: false, pageCount: 0, isValidPdf: false };
  }

  const pdfText = buffer.toString('binary', 0, Math.min(buffer.length, 1024 * 1024));
  const isEncrypted = pdfText.includes('/Encrypt');

  // Count /Page occurrences in catalog structure
  const pageMatches = pdfText.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? Math.max(1, pageMatches.length) : 1;

  return {
    isEncrypted,
    pageCount,
    isValidPdf: true,
  };
}

/**
 * Generates safe preview metadata structure for a page without executing scripts.
 */
export function generateSafePagePreviewStub(
  assetId: string,
  pageNumber: number
): { previewKey: string; dimensions: { width: number; height: number } } {
  return {
    previewKey: `previews/${assetId}/page_${pageNumber}.png`,
    dimensions: { width: 1240, height: 1754 }, // Standard A4 portrait aspect
  };
}
