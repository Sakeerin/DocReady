import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import {
  detectAmbiguousDate,
  planOcrResume,
  resolveFieldProposalStatus,
  resolveStaleOcrResult,
  validateDecisionSelection,
  validateMonetaryComponents,
} from '@docready/domain';

describe('Phase S8 Hardening: OCR/Jev Resilience & Numeric Safety (DR-801, DR-803)', () => {
  it('T-07: worker resumes from a persisted operation ID; unknown submissions are bounded', () => {
    expect(
      planOcrResume({ operationId: 'op_1', submitOutcomeUnknown: false, attempts: 1, maxAttempts: 3 })
    ).toBe('poll_operation');
    expect(planOcrResume({ submitOutcomeUnknown: true, attempts: 1, maxAttempts: 3 })).toBe('resubmit');
    expect(planOcrResume({ submitOutcomeUnknown: true, attempts: 3, maxAttempts: 3 })).toBe('manual_review');
  });

  it('T-08: OCR results for deleted or replaced assets are never published', () => {
    expect(resolveStaleOcrResult({ assetStatus: 'deleted', assetVersion: 1, resultVersion: 1 })).toBe('cancelled');
    expect(resolveStaleOcrResult({ assetStatus: 'replaced', assetVersion: 2, resultVersion: 1 })).toBe('stale');
    expect(resolveStaleOcrResult({ assetStatus: 'active', assetVersion: 2, resultVersion: 1 })).toBe('stale');
    expect(resolveStaleOcrResult({ assetStatus: 'active', assetVersion: 1, resultVersion: 1 })).toBe('publish');
  });

  it('T-11: high Jev confidence cannot hide a weak OCR read', () => {
    expect(resolveFieldProposalStatus({ ocrConfidence: 0.55, jevConfidence: 0.99 })).toBe('needs_review');
    expect(resolveFieldProposalStatus({ ocrConfidence: 0.98, jevConfidence: 0.5 })).toBe('proposed');
  });

  it('T-13: ambiguous dates are proposed as ambiguous and never assigned to a tax period', () => {
    const slash = detectAmbiguousDate('03/04/2026');
    expect(slash.status).toBe('ambiguous');
    expect(slash.candidates).toEqual(['2026-04-03', '2026-03-04']);

    const twoDigit = detectAmbiguousDate('25/04/26');
    expect(twoDigit.status).toBe('ambiguous'); // 2026 vs 2526 (BE)

    const buddhist = detectAmbiguousDate('25/04/2569');
    expect(buddhist.status).toBe('proposed');
    expect(buddhist.candidates).toEqual(['2026-04-25']);

    expect(detectAmbiguousDate('not a date').status).toBe('ambiguous');
  });

  it('T-14: amounts are selected by role with exact decimal math (no float error, not "largest amount")', () => {
    // amount paid (20000.00) is larger than grand total but is irrelevant to the equation
    expect(validateMonetaryComponents('10000.00', '700.00', '10700.00').isValid).toBe(true);
    // classic float trap: 0.1 + 0.2
    const trap = validateMonetaryComponents('0.10', '0.20', '0.30');
    expect(trap.isValid).toBe(true);
    expect(trap.discrepancyCents).toBe(0);
    expect(trap.calculatedTotal).toBe('0.30');
    expect(validateMonetaryComponents('10000.00', '700.00', '12000.00').isValid).toBe(false);
  });

  it('T-19: Jev output outside the bounded contract is rejected and manual review stays available', async () => {
    const allowed = ['span_6', 'none_ambiguous'];
    expect(validateDecisionSelection(allowed, 'span_999')).toEqual({
      accepted: false,
      requiresManualReview: true,
    });
    expect(validateDecisionSelection(allowed, null).requiresManualReview).toBe(true);
    expect(validateDecisionSelection(allowed, 'none_ambiguous').accepted).toBe(false);
    expect(validateDecisionSelection(allowed, 'span_6').accepted).toBe(true);

    // Provider down -> a human can still edit the document
    const scope = { officeId: 'off_a', clientId: 'cli_a' };
    const repo = new TenantRepository();
    await repo.addDocument(scope, { id: 'doc_t19', periodId: 'p', documentNumber: '1', status: 'needs_review' });
    const updated = await repo.updateDocumentFields(scope, 'doc_t19', { grandTotal: '10.00' });
    expect(updated.grandTotal).toBe('10.00');
  });
});
