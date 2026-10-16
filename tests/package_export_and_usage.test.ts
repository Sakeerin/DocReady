import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import {
  buildWorkbookSpecification,
  createExportArchiveBundle,
  escapeExcelFormulaCell,
  sanitizeExportPath,
} from '@docready/exports';

describe('Phase S7: Package Snapshot, Export Security & Usage Ledger (DR-701 to DR-706)', () => {
  const scopeAlpha1 = { officeId: 'off_alpha', clientId: 'cli_alpha_1' };
  const scopeBeta1 = { officeId: 'off_beta', clientId: 'cli_beta_1' };
  const periodId = 'period_2026_10';

  it('T-21: Modifying a document or checklist after package approval invalidates un-exported approvals while preserving the immutable snapshot', async () => {
    const repo = new TenantRepository([
      {
        id: 'DOC-701',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: '00098123',
        documentDate: '2026-10-05',
        sellerName: 'บริษัท ไทยซัพพลาย จำกัด',
        sellerTaxId: '0105559998887',
        grandTotal: '5350.00',
        statedTax: '350.00',
        currency: 'THB',
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    const exp = await repo.addExpectedItem(scopeAlpha1, {
      periodId,
      title: 'ค่าวัสดุสำนักงาน',
      source: 'template',
      requirementStatus: 'required',
      createdByUserId: 'staff_1',
    });
    await repo.matchDocumentToExpectedItem(scopeAlpha1, exp.id, 'DOC-701', 'staff_1');

    // Create and approve Package Snapshot (rev 1)
    const pkg = await repo.createPackageSnapshot(scopeAlpha1, {
      periodId,
      packageMode: 'complete_against_defined_list',
      createdByUserId: 'staff_1',
    });
    const { packageRecord: approvedPkg } = await repo.approvePackage(scopeAlpha1, pkg.id, {
      approvedByUserId: 'reviewer_1',
      approvalNote: 'ตรวจสอบครบถ้วนแล้ว',
    });

    expect(approvedPkg.status).toBe('approved');
    expect(approvedPkg.items[0]?.grandTotal).toBe('5350.00');
    expect(approvedPkg.items[0]?.documentRevision).toBe(1);

    // Mutate the live document after approval
    await repo.updateDocumentFields(
      scopeAlpha1,
      'DOC-701',
      { grandTotal: '6420.00', statedTax: '420.00' },
      1,
      'reviewer_1'
    );

    // 1. Package status must now be invalidated_by_change
    const recheckedPkg = await repo.getPackageById(scopeAlpha1, pkg.id);
    expect(recheckedPkg?.status).toBe('invalidated_by_change');

    // 2. Historical snapshot items inside the invalidated package MUST remain immutable (still '5350.00' and rev 1)
    expect(recheckedPkg?.items[0]?.grandTotal).toBe('5350.00');
    expect(recheckedPkg?.items[0]?.documentRevision).toBe(1);

    // 3. Attempting to trigger a new export on the invalidated package MUST be rejected
    await expect(
      repo.createExportJob(scopeAlpha1, pkg.id, 'reviewer_1')
    ).rejects.toThrow(/invalidated_by_change/);
  });

  it('T-17 & T-28: Separates supporting documents (supports relation) from primary counting role and segregates totals by currency', async () => {
    const repo = new TenantRepository([
      {
        id: 'DOC-INV-THB',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: '0001001',
        sellerTaxId: '0105560001112',
        grandTotal: '10700.00',
        statedTax: '700.00',
        currency: 'THB',
        documentRoles: ['invoice'],
        status: 'reviewed',
        revisionNumber: 1,
      },
      {
        id: 'DOC-RCPT-THB',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: 'RC-0001001',
        sellerTaxId: '0105560001112',
        grandTotal: '10700.00',
        statedTax: '700.00',
        currency: 'THB',
        documentRoles: ['receipt'],
        status: 'reviewed',
        revisionNumber: 1,
      },
      {
        id: 'DOC-INV-USD',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: 'USD-0099',
        sellerTaxId: '9988776655443',
        grandTotal: '300.00',
        statedTax: '0.00',
        currency: 'USD',
        documentRoles: ['invoice'],
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    // Link Receipt as supporting the Invoice (T-17)
    await repo.createDocumentRelation(
      scopeAlpha1,
      'DOC-RCPT-THB',
      'DOC-INV-THB',
      'supports',
      'reviewer_1'
    );

    const pkg = await repo.createPackageSnapshot(scopeAlpha1, {
      periodId,
      packageMode: 'received_documents_with_exceptions',
      exceptionsAcknowledged: true,
    });

    // Both THB Invoice and THB Receipt appear in the snapshot items
    expect(pkg.items).toHaveLength(3);
    const invItem = pkg.items.find((i) => i.documentId === 'DOC-INV-THB');
    const rcptItem = pkg.items.find((i) => i.documentId === 'DOC-RCPT-THB');
    expect(invItem?.countingRole).toBe('primary_counting');
    expect(rcptItem?.countingRole).toBe('supporting_non_counting');

    // T-17 & T-28: THB total is 10700.00 (NOT double-counted as 21400.00), and USD is kept in a separate currency bucket
    const thbSummary = pkg.totalsByCurrency.find((t) => t.currency === 'THB');
    const usdSummary = pkg.totalsByCurrency.find((t) => t.currency === 'USD');

    expect(thbSummary?.primaryDocumentCount).toBe(1);
    expect(thbSummary?.supportingDocumentCount).toBe(1);
    expect(thbSummary?.grandTotalSum).toBe('10700.00');
    expect(thbSummary?.statedTaxSum).toBe('700.00');

    expect(usdSummary?.primaryDocumentCount).toBe(1);
    expect(usdSummary?.grandTotalSum).toBe('300.00');
  });

  it('T-12 & T-25: Workbook specification preserves leading zeroes as strings, escapes formula injection, and prevents ZIP path traversal', () => {
    expect(sanitizeExportPath('../../etc/passwd')).toBe('etc_passwd');
    expect(sanitizeExportPath('C:\\Windows\\System32\\cmd.exe')).toBe('Windows_System32_cmd.exe');
    expect(escapeExcelFormulaCell('=cmd|\' /C calc\'!A0')).toBe('\'=cmd|\' /C calc\'!A0');
    expect(escapeExcelFormulaCell('@SUM(A1:A10)')).toBe('\'@SUM(A1:A10)');

    const workbook = buildWorkbookSpecification({
      packageId: 'pkg_test_01',
      packageRevision: 1,
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1',
      periodId,
      packageMode: 'received_documents_with_exceptions',
      coverageBasis: 'received_only',
      items: [
        {
          documentId: '../../DOC-TRAVERSAL',
          documentRevision: 1,
          documentNumber: '00001234',
          documentDate: '2026-10-10',
          sellerName: '=HYPERLINK("http://evil.example","Click")',
          sellerTaxId: '0105550009991',
          grandTotal: '1500.00',
          statedTax: undefined,
          currency: 'THB',
          documentRoles: ['tax_invoice'],
          countingRole: 'primary_counting',
          sourceAssetId: 'asset_x',
          sourceHash: 'sha256_src_x',
          pageRange: '1-2',
          derivedStoragePath: 'derived/off_alpha/cli_alpha_1/doc_x_p1-2.pdf',
          derivedFileHash: 'sha256_drv_x',
          hasMixedClientFlag: false,
        },
      ],
    });

    // All 5 required sheets exist
    expect(Object.keys(workbook.sheets)).toEqual([
      'Documents',
      'EvidenceIndex',
      'Checklist',
      'Exceptions',
      'PackageInfo',
    ]);

    const row = workbook.sheets.Documents[0]!;
    // T-12: Leading zeroes preserved as string
    expect(row.documentNumber).toBe('00001234');
    expect(row.sellerTaxId).toBe('0105550009991');
    // T-15: Missing statedTax is 'missing', never '0.00'
    expect(row.statedTax).toBe('missing');
    // T-25: Formula injection escaped and archive path sanitized
    expect(row.sellerName.startsWith("'=HYPERLINK")).toBe(true);
    expect(row.derivedArchivePath).not.toContain('..');
    // T-22: received_only banner never claims 100% completeness
    expect(workbook.sheets.PackageInfo.completenessBanner).toContain('ไม่ได้รับรองความครบถ้วน 100%');
  });

  it('T-10: Split-derived export bundle includes page-range provenance in manifest.json and blocks mixed-client batch files', () => {
    expect(() =>
      createExportArchiveBundle({
        packageId: 'pkg_mixed',
        packageRevision: 1,
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        packageMode: 'received_documents_with_exceptions',
        coverageBasis: 'received_documents_with_exceptions',
        items: [
          {
            documentId: 'DOC-MIXED-01',
            documentRevision: 1,
            documentNumber: '0099',
            currency: 'THB',
            documentRoles: ['invoice'],
            countingRole: 'primary_counting',
            sourceAssetId: 'asset_mixed',
            sourceHash: 'sha256_src_mixed',
            pageRange: '3-4',
            derivedStoragePath: 'derived/off_alpha/cli_alpha_1/DOC-MIXED-01_p3-4.pdf',
            derivedFileHash: 'sha256_drv_mixed',
            hasMixedClientFlag: true,
          },
        ],
      })
    ).toThrow(/T-10/);
  });

  it('T-26 & T-27: Blocks downloading incomplete/failed exports and blocks revoked or cross-tenant members at download time', async () => {
    const repo = new TenantRepository([
      {
        id: 'DOC-DL-1',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: '000555',
        grandTotal: '2140.00',
        statedTax: '140.00',
        currency: 'THB',
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    const pkg = await repo.createPackageSnapshot(scopeAlpha1, {
      periodId,
      packageMode: 'received_documents_with_exceptions',
      exceptionsAcknowledged: true,
    });
    await repo.approvePackage(scopeAlpha1, pkg.id, {
      approvedByUserId: 'reviewer_1',
      exceptionsAcknowledged: true,
    });

    // T-26: Simulate an export job that is still processing or failed
    const processingJob = await repo.createExportJob(scopeAlpha1, pkg.id, 'reviewer_1', {
      simulateStatus: 'processing',
    });
    const processingDownload = await repo.requestExportDownload({
      requesterScope: scopeAlpha1,
      requesterUserId: 'reviewer_1',
      exportId: processingJob.id,
    });
    expect(processingDownload.authorized).toBe(false);
    expect(processingDownload.httpStatus).toBe(409);

    // Create a completed export job
    const completedJob = await repo.createExportJob(scopeAlpha1, pkg.id, 'reviewer_1');
    expect(completedJob.status).toBe('completed');
    expect(completedJob.sha256Checksum).toHaveLength(64);

    // Authorized active member can download
    const validDownload = await repo.requestExportDownload({
      requesterScope: scopeAlpha1,
      requesterUserId: 'reviewer_1',
      exportId: completedJob.id,
    });
    expect(validDownload.authorized).toBe(true);
    expect(validDownload.httpStatus).toBe(200);
    expect(validDownload.shortLivedDownloadToken).toBeDefined();

    // T-27: Cross-tenant user is denied (403)
    const crossTenantDownload = await repo.requestExportDownload({
      requesterScope: scopeBeta1,
      requesterUserId: 'user_beta',
      exportId: completedJob.id,
    });
    expect(crossTenantDownload.authorized).toBe(false);
    expect(crossTenantDownload.httpStatus).toBe(403);

    // T-27: Revoke reviewer_1's membership -> immediate download denial (403)
    repo.setMembershipStatus('off_alpha', 'reviewer_1', false);
    const revokedDownload = await repo.requestExportDownload({
      requesterScope: scopeAlpha1,
      requesterUserId: 'reviewer_1',
      exportId: completedJob.id,
    });
    expect(revokedDownload.authorized).toBe(false);
    expect(revokedDownload.httpStatus).toBe(403);
  });

  it('DR-705 & DR-706: Separates system-fault reprocess units from billable client quota and computes operational metrics with sampleSize', async () => {
    const repo = new TenantRepository([
      {
        id: 'DOC-OP-1',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: '001',
        status: 'reviewed',
        revisionNumber: 1,
        prepDurationSeconds: 60,
        hasException: false,
      },
      {
        id: 'DOC-OP-2',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId,
        documentNumber: '002',
        status: 'reviewed',
        revisionNumber: 1,
        prepDurationSeconds: 120,
        hasException: true,
      },
    ]);

    // Normal OCR usage (billable)
    await repo.recordUsageLedgerEntry(scopeAlpha1, {
      periodId,
      metricType: 'ocr_pages',
      rawUnits: 25,
      providerCostSatang: 1250,
      idempotencyKey: 'ocr_norm_1',
    });

    // System-fault OCR retry (NOT billable to client, but tracked in provider cost)
    await repo.recordUsageLedgerEntry(scopeAlpha1, {
      periodId,
      metricType: 'ocr_pages',
      rawUnits: 6,
      isSystemFaultReprocess: true,
      providerCostSatang: 300,
      idempotencyKey: 'ocr_sysfault_1',
    });

    const report = await repo.getOperationalMetricsReport(scopeAlpha1);
    expect(report.operations.sampleSize).toBe(2);
    expect(report.operations.averagePrepTimeSeconds).toBe(90);
    expect(report.operations.exceptionRatePercent).toBe(50);

    const clientUsage = report.usageByClient[0]!;
    expect(clientUsage.metrics.ocr_pages.rawUnits).toBe(31);
    expect(clientUsage.metrics.ocr_pages.systemFaultReprocessUnits).toBe(6);
    expect(clientUsage.metrics.ocr_pages.billableUnits).toBe(25);
    expect(clientUsage.totalProviderCostSatang).toBe(1550);
  });
});
