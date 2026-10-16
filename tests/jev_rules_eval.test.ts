import { describe, it, expect } from 'vitest';
import { validateMonetaryComponents, detectClientCompanyMismatch, isStaleAiResolution } from '@docready/domain';
import { getDecisionProvider, buildCandidateSelectionQuestion, buildRoleClassificationQuestion } from '@docready/ai';
import { TenantRepository } from '@docready/db';
import { OcrSpan, ExtractedCandidate } from '@docready/contracts';

describe('Phase S4 Jev & Field Rules Engine Suite (DR-401 - DR-407)', () => {
  const sampleSpans: OcrSpan[] = [
    {
      id: 'span_1',
      page: 1,
      text: 'ใบกำกับภาษี / ใบเสร็จรับเงิน',
      confidence: 0.99,
      boundingBox: { x: 0.35, y: 0.05, width: 0.3, height: 0.04 },
    },
  ];

  const sampleCandidates: ExtractedCandidate[] = [
    {
      fieldName: 'grand_total',
      rawText: '10,700.00',
      normalizedValue: '10700.00',
      confidence: 0.99,
      spanIds: ['span_6'],
    },
  ];

  it('[DR-401 & DR-405] Jev Decision Provider (jev-1.13.0) calculates token usage and input cost correctly', async () => {
    const jevEngine = getDecisionProvider('jev_1.13.0');
    expect(jevEngine.modelVersion).toBe('jev-1.13.0');

    const question = buildCandidateSelectionQuestion('grand_total', sampleCandidates);
    const result = await jevEngine.evaluateQuestion(question);

    expect(result.modelVersion).toBe('jev-1.13.0');
    expect(result.inputTokens).toBeGreaterThan(0);
    expect(result.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.selectedCandidateId).not.toBeNull();
  });

  it('[DR-402 & DR-403] Bounded questions generate Choice options with none/ambiguous fallback', () => {
    const roleQ = buildRoleClassificationQuestion(sampleSpans);
    expect(roleQ.questionType).toBe('role_classification');
    expect(roleQ.choices.some((c) => c.id === 'tax_invoice')).toBe(true);

    const candQ = buildCandidateSelectionQuestion('grand_total', sampleCandidates);
    expect(candQ.choices.some((c) => c.id === 'none_ambiguous')).toBe(true);
  });

  it('[DR-404 Invariant] Decimal monetary arithmetic validates Subtotal + StatedTax = GrandTotal correctly', () => {
    // Valid equation: 10,000 + 700 = 10,700
    const validCheck = validateMonetaryComponents('10000.00', '700.00', '10700.00');
    expect(validCheck.isValid).toBe(true);

    // Mismatched equation: 10,000 + 700 != 12,000
    const invalidCheck = validateMonetaryComponents('10000.00', '700.00', '12000.00');
    expect(invalidCheck.isValid).toBe(false);
  });

  it('[DR-404 Invariant] Detects seller tax ID mismatch when matching client company tax ID', () => {
    const sameTaxId = '0105558001111';
    const mismatch = detectClientCompanyMismatch(sameTaxId, sameTaxId);
    expect(mismatch.isMismatch).toBe(true);
    expect(mismatch.warning).toContain('ตรงกับเลขผู้เสียภาษีของบริษัทลูกค้า');

    const diffTaxId = '0105559009999';
    const noMismatch = detectClientCompanyMismatch(sameTaxId, diffTaxId);
    expect(noMismatch.isMismatch).toBe(false);
  });

  it('[DR-405 Invariant] Stale resolution guard prevents AI from overwriting human-confirmed fields', () => {
    expect(isStaleAiResolution('confirmed')).toBe(true);
    expect(isStaleAiResolution('proposed')).toBe(false);
    expect(isStaleAiResolution('missing')).toBe(false);
  });

  it('[DR-405 Ledger] Records token usage ledger entry for client billing', async () => {
    const repo = new TenantRepository();
    const scope = { officeId: 'off_1', clientId: 'cli_1' };

    await repo.addTokenLedgerRecord({
      id: 'ledger_1',
      officeId: scope.officeId,
      clientId: scope.clientId,
      documentId: 'doc_1',
      provider: 'jev',
      modelVersion: 'jev-1.13.0',
      inputTokens: 3000,
      estimatedCostUsd: 0.000126,
    });

    const records = await repo.getTokenLedgerRecords(scope);
    expect(records).toHaveLength(1);
    expect(records[0]?.inputTokens).toBe(3000);
  });
});
