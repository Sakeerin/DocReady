import { OcrSpan, ExtractedCandidate } from '@docready/contracts';

export interface BoundedQuestion {
  questionType: 'role_classification' | 'candidate_selection' | 'party_verification';
  prompt: string;
  choices: Array<{ id: string; label: string }>;
  allowNone: boolean;
}

/**
 * Builds Noul/Choice bounded question for document role classification.
 */
export function buildRoleClassificationQuestion(spans: OcrSpan[]): BoundedQuestion {
  const textSummary = spans.map((s) => s.text).join(' ').substring(0, 500);

  return {
    questionType: 'role_classification',
    prompt: `Based on extracted text spans: "${textSummary}", select the primary document role.`,
    choices: [
      { id: 'tax_invoice', label: 'ใบกำกับภาษี (Tax Invoice)' },
      { id: 'invoice', label: 'ใบแจ้งหนี้ / ใบวางบิล (Invoice)' },
      { id: 'receipt', label: 'ใบเสร็จรับเงิน (Receipt)' },
      { id: 'payment_evidence', label: 'หลักฐานการชำระเงิน (Payment Slip)' },
      { id: 'other', label: 'เอกสารอื่น ๆ (Other)' },
    ],
    allowNone: true,
  };
}

/**
 * Builds Choice bounded question over extracted candidate span IDs for a specific target field.
 */
export function buildCandidateSelectionQuestion(
  fieldName: string,
  candidates: ExtractedCandidate[]
): BoundedQuestion {
  const fieldCandidates = candidates.filter((c) => c.fieldName === fieldName);

  const choices = fieldCandidates.map((c, index) => ({
    id: `cand_${index}_${c.spanIds.join('_')}`,
    label: `${c.normalizedValue} (Raw: "${c.rawText}")`,
  }));

  choices.push({ id: 'none_ambiguous', label: 'ไม่มีในตัวเลือก / ไม่ชัดเจน (None / Ambiguous)' });

  return {
    questionType: 'candidate_selection',
    prompt: `Select the span candidate that accurately represents the field "${fieldName}".`,
    choices,
    allowNone: true,
  };
}
