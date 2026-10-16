import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import { validatePageGroupingCompleteness, checkFileQuotaLimits } from '@docready/domain';
import { validateFileMagicBytes, inspectPdfHeader } from '@docready/files';

describe('Phase S2 Secure Upload & Manual Workflow Suite (DR-201 - DR-207)', () => {
  const officeId = '11111111-1111-1111-1111-111111111111';
  const clientId = 'a1111111-1111-1111-1111-111111111111';
  const periodId = 'p1111111-1111-1111-1111-111111111111';
  const tenantScope = { officeId, clientId };

  const repo = new TenantRepository();

  it('[DR-201 & DR-202] Upload session reservation and quota limit check', async () => {
    const quotaCheck = checkFileQuotaLimits(5 * 1024 * 1024, 10);
    expect(quotaCheck.valid).toBe(true);

    const oversizedCheck = checkFileQuotaLimits(25 * 1024 * 1024, 10);
    expect(oversizedCheck.valid).toBe(false);

    const overpageCheck = checkFileQuotaLimits(5 * 1024 * 1024, 35);
    expect(overpageCheck.valid).toBe(false);

    const session = await repo.createUploadSession({
      id: 'sess_1001',
      officeId,
      clientId,
      periodId,
      filename: 'test_invoice.pdf',
      fileSizeBytes: 5 * 1024 * 1024,
      mimeType: 'application/pdf',
      storageKey: `quarantine/${officeId}/${clientId}/test_invoice.pdf`,
      status: 'reserved',
    });

    expect(session.id).toBe('sess_1001');
    expect(session.status).toBe('reserved');
  });

  it('[DR-202] Rejects malformed and encrypted PDF files safely', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n/Type /Page\n');
    const encryptedPdfBuffer = Buffer.from('%PDF-1.4\n/Encrypt 12 0 R\n/Type /Page\n');
    const invalidBuffer = Buffer.from('NOT_A_PDF_CONTENT');

    expect(validateFileMagicBytes(validPdfBuffer, 'application/pdf')).toBe(true);
    expect(validateFileMagicBytes(invalidBuffer, 'application/pdf')).toBe(false);

    const validInfo = inspectPdfHeader(validPdfBuffer);
    expect(validInfo.isValidPdf).toBe(true);
    expect(validInfo.isEncrypted).toBe(false);

    const encryptedInfo = inspectPdfHeader(encryptedPdfBuffer);
    expect(encryptedInfo.isEncrypted).toBe(true);
  });

  it('[DR-204 Invariant] Page Grouping validation ensures all pages are mapped without missing/duplicate pages', () => {
    const totalPages = 5;

    // Valid complete grouping (Pages 1-3 -> Doc 1, Pages 4-5 -> Doc 2)
    const validGroups = [
      { documentIndex: 1, pageNumbers: [1, 2, 3], roles: ['tax_invoice' as const] },
      { documentIndex: 2, pageNumbers: [4, 5], roles: ['payment_evidence' as const] },
    ];
    const validResult = validatePageGroupingCompleteness(totalPages, validGroups);
    expect(validResult.valid).toBe(true);
    expect(validResult.missingPages).toHaveLength(0);

    // Incomplete grouping (Page 3 missing)
    const incompleteGroups = [
      { documentIndex: 1, pageNumbers: [1, 2], roles: ['tax_invoice' as const] },
      { documentIndex: 2, pageNumbers: [4, 5], roles: ['payment_evidence' as const] },
    ];
    const incompleteResult = validatePageGroupingCompleteness(totalPages, incompleteGroups);
    expect(incompleteResult.valid).toBe(false);
    expect(incompleteResult.missingPages).toEqual([3]);

    // Overlapping duplicate page grouping (Page 2 assigned twice)
    const duplicateGroups = [
      { documentIndex: 1, pageNumbers: [1, 2, 3], roles: ['tax_invoice' as const] },
      { documentIndex: 2, pageNumbers: [2, 4, 5], roles: ['payment_evidence' as const] },
    ];
    const duplicateResult = validatePageGroupingCompleteness(totalPages, duplicateGroups);
    expect(duplicateResult.valid).toBe(false);
    expect(duplicateResult.duplicatePages).toEqual([2]);
  });

  it('[DR-207] Manual workflow: Add document, edit fields, and confirm status without AI/OCR', async () => {
    const doc = await repo.addDocument(tenantScope, {
      id: 'doc_manual_101',
      periodId,
      documentNumber: 'INV-MANUAL-001',
      status: 'needs_review',
    });

    expect(doc.status).toBe('needs_review');

    const updated = await repo.updateDocumentFields(tenantScope, 'doc_manual_101', {
      sellerName: 'บริษัท สยาม จำกัด',
      grandTotal: '10700.00',
    });

    expect(updated.fieldStatusSummary).toBe('confirmed');
    expect(updated.sellerName).toBe('บริษัท สยาม จำกัด');
    expect(updated.grandTotal).toBe('10700.00');
  });

  it('[DR-206] Outbox pattern handles async scan events and completion status', async () => {
    const event = await repo.addOutboxEvent('scan_file', { assetId: 'asset_99' });
    expect(event.status).toBe('pending');

    const pending = await repo.getPendingOutboxEvents();
    expect(pending).toHaveLength(1);

    await repo.markOutboxEventCompleted(event.id);
    const pendingAfter = await repo.getPendingOutboxEvents();
    expect(pendingAfter).toHaveLength(0);
  });
});
