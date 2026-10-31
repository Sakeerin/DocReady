import { OcrSpan, ExtractedCandidate } from '@docready/contracts';

/**
 * Candidate Field Extractor
 * Parses text spans from OCR to extract potential candidate values with explicit span references.
 */
export function extractFieldCandidates(spans: OcrSpan[]): ExtractedCandidate[] {
  const candidates: ExtractedCandidate[] = [];

  for (const span of spans) {
    const text = span.text.trim();

    // 1. Thai 13-digit Tax ID Extractor
    const taxIdMatch = text.match(/\b\d{13}\b/);
    if (taxIdMatch && taxIdMatch[0]) {
      candidates.push({
        fieldName: 'seller_tax_id',
        rawText: taxIdMatch[0],
        normalizedValue: taxIdMatch[0],
        confidence: span.confidence,
        spanIds: [span.id],
        boundingBox: span.boundingBox,
      });
    }

    // 2. Date Extractor (DD/MM/YYYY or DD/MM/25XX for Buddhist Era)
    const dateMatch = text.match(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/);
    if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
      const dayNum = parseInt(dateMatch[1], 10);
      const monthNum = parseInt(dateMatch[2], 10);
      let year = parseInt(dateMatch[3], 10);

      // Buddhist Era (B.E. พ.ศ.) conversion if year >= 2400
      if (year >= 2400) {
        year -= 543;
      }

      const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
      const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const maxDay = monthNum >= 1 && monthNum <= 12 ? (daysInMonth[monthNum - 1] ?? 0) : 0;

      if (dayNum >= 1 && dayNum <= maxDay) {
        const day = String(dayNum).padStart(2, '0');
        const month = String(monthNum).padStart(2, '0');
        const normalizedIso = `${year}-${month}-${day}`;

        candidates.push({
          fieldName: 'document_date',
          rawText: text,
          normalizedValue: normalizedIso,
          confidence: span.confidence,
          spanIds: [span.id],
          boundingBox: span.boundingBox,
        });
      }
    }

    // 3. Document Number Extractor (e.g. INV-2026-0001, REC-9941, or leading zero numbers)
    const docNumMatch = text.match(/\b([A-Z]{2,5}-[\w-]+|\d{6})\b/i);
    if (docNumMatch && docNumMatch[0]) {
      candidates.push({
        fieldName: 'document_number',
        rawText: docNumMatch[0],
        normalizedValue: docNumMatch[0],
        confidence: span.confidence,
        spanIds: [span.id],
        boundingBox: span.boundingBox,
      });
    }

    // 4. Monetary Amount Extractor (e.g. 10,700.00, 1,250.00)
    const amountMatch = text.match(/\b\d{1,3}(,\d{3})*(\.\d{2})\b/);
    if (amountMatch && amountMatch[0]) {
      const cleanDecimal = amountMatch[0].replace(/,/g, '');
      candidates.push({
        fieldName: 'grand_total',
        rawText: amountMatch[0],
        normalizedValue: cleanDecimal,
        confidence: span.confidence,
        spanIds: [span.id],
        boundingBox: span.boundingBox,
      });
    }
  }

  return candidates;
}
