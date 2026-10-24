import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import { getOCRProvider, extractFieldCandidates } from '@docready/ocr';

describe('Phase S8 E2E Flow T-30: portal -> scan -> OCR -> review -> checklist -> approve -> export', () => {
  const scope = { officeId: 'off_e2e', clientId: 'cli_e2e' };
  const periodId = 'per_2026_10';

  it('produces an export where every row traces back to its source asset', async () => {
    const repo = new TenantRepository();

    // 1. Portal upload (2-step): reserve -> complete
    await repo.createUploadSession({
      id: 'sess_e2e',
      officeId: scope.officeId,
      clientId: scope.clientId,
      periodId,
      filename: 'invoice.pdf',
      fileSizeBytes: 2048,
      mimeType: 'application/pdf',
      storageKey: `quarantine/${scope.officeId}/${scope.clientId}/invoice.pdf`,
      status: 'reserved',
    });
    const { asset } = await repo.completeUploadSession(scope, 'sess_e2e', {
      fileHash: 'sha256_e2e_source_hash',
    });
    await repo.assertAssetUsable(scope, asset.id, 'ocr'); // scan passed -> usable

    // 2. OCR (mock provider) -> candidate fields with evidence spans
    const ocr = getOCRProvider('mock');
    const operation = await ocr.submit({
      assetId: asset.id,
      fileBuffer: Buffer.from('%PDF-1.4\n/Type /Page\n'),
      mimeType: 'application/pdf',
    });
    const result = await ocr.poll(operation);
    const candidates = extractFieldCandidates(result.spans);
    expect(result.spans.length).toBeGreaterThan(0);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.spanIds.length > 0)).toBe(true);

    // 3. Human review confirms fields (strings keep leading zeroes)
    await repo.addDocument(scope, {
      id: 'doc_e2e',
      periodId,
      documentNumber: '00001234',
      sellerTaxId: '0105558001111',
      grandTotal: '10700.00',
      statedTax: '700.00',
      currency: 'THB',
      sourceAssetId: asset.id,
      sourceHash: asset.fileHash,
      status: 'needs_review',
    });
    await repo.updateDocumentFields(scope, 'doc_e2e', { status: 'reviewed' }, 1, 'reviewer_1');

    // 4. Checklist: expected item matched to the reviewed document
    const expected = await repo.addExpectedItem(scope, {
      periodId,
      title: 'ค่าบริการประจำเดือน',
      source: 'manual',
      requirementStatus: 'required',
      createdByUserId: 'staff_1',
    });
    await repo.matchDocumentToExpectedItem(scope, expected.id, 'doc_e2e', 'reviewer_1');
    const readiness = await repo.getPeriodReadiness(scope, periodId);
    expect(readiness.isCompleteAgainstDefinedList).toBe(true);

    // 5. Package approval -> export
    const pkg = await repo.createPackageSnapshot(scope, {
      periodId,
      packageMode: 'complete_against_defined_list',
    });
    await repo.approvePackage(scope, pkg.id, { approvedByUserId: 'reviewer_1' });
    const job = await repo.createExportJob(scope, pkg.id, 'reviewer_1');
    expect(job.status).toBe('completed');

    // 6. Download is authorized for the active member
    const download = await repo.requestExportDownload({
      requesterScope: scope,
      requesterUserId: 'reviewer_1',
      exportId: job.id,
    });
    expect(download.authorized).toBe(true);

    // 7. Every manifest/workbook row traces to a real document and its source asset
    const manifest = job.manifest!;
    expect(manifest.entries.length).toBeGreaterThan(0);
    for (const entry of manifest.entries) {
      const doc = await repo.getDocumentById(scope, entry.documentId);
      expect(doc).not.toBeNull();
      expect(entry.sourceHash).toBe(asset.fileHash);
      expect(doc?.sourceAssetId).toBe(asset.id);
    }
    const docsSheet = job.archiveBundle!.workbook.sheets.Documents;
    expect(docsSheet[0]?.documentNumber).toBe('00001234');
    expect(docsSheet[0]?.sellerTaxId).toBe('0105558001111');
    expect(job.archiveBundle!.workbook.sheets.PackageInfo.coverageBasis).toBe('complete_against_defined_list');
  });
});
