import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { PackageItemSnapshot } from '@docready/contracts';
import { TenantRepository } from '@docready/db';
import {
  buildPkZipBuffer,
  buildWorkbookSpecification,
  extractPkZipEntry,
  generateRealExportArchive,
  generateWorkbookBuffer,
  listPkZipEntries,
  readWorkbookBufferSummary,
} from '@docready/exports';
import {
  extractPdfPageRangeBuffer,
  inspectPdfHeader,
  validateFileMagicBytes,
} from '@docready/files';

describe('Real Binary XLSX, Split-Page PDF & PKZIP Export (DR-702, DR-703, T-10, T-12, T-17, T-25, T-26, T-27, T-28)', () => {
  const sampleItems: PackageItemSnapshot[] = [
    {
      documentId: 'doc_thb_01',
      documentRevision: 1,
      documentNumber: '00001234',
      documentDate: '2026-09-10',
      sellerName: '=CMD|\'/C calc\'!A0 บริษัท ทดสอบ จำกัด',
      sellerTaxId: '0105550009991',
      grandTotal: '1070.00',
      statedTax: '70.00',
      currency: 'THB',
      documentRoles: ['tax_invoice'],
      countingRole: 'primary_counting',
      sourceAssetId: 'asset_01',
      sourceHash: 'sha256_src_01',
      pageRange: '1-2',
      derivedStoragePath: 'derived/off_alpha/cli_alpha_1/doc_thb_01_p1-2_rev1.pdf',
      derivedFileHash: 'sha256_drv_01',
      hasMixedClientFlag: false,
    },
    {
      documentId: 'doc_thb_support_02',
      documentRevision: 1,
      documentNumber: '009988',
      documentDate: '2026-09-11',
      sellerName: 'บริษัท ทดสอบ จำกัด',
      sellerTaxId: '0105550009991',
      grandTotal: '1070.00',
      statedTax: '70.00',
      currency: 'THB',
      documentRoles: ['receipt'],
      countingRole: 'supporting_non_counting',
      sourceAssetId: 'asset_01',
      sourceHash: 'sha256_src_01',
      pageRange: '3-3',
      derivedStoragePath: 'derived/off_alpha/cli_alpha_1/doc_thb_support_02_p3-3_rev1.pdf',
      derivedFileHash: 'sha256_drv_02',
      hasMixedClientFlag: false,
    },
    {
      documentId: 'doc_usd_03',
      documentRevision: 2,
      documentNumber: 'INV-0077',
      documentDate: '2026-09-12',
      sellerName: 'Cloud Global Inc.',
      sellerTaxId: '0994000123456',
      grandTotal: '250.50',
      statedTax: '0.00',
      currency: 'USD',
      documentRoles: ['invoice'],
      countingRole: 'primary_counting',
      sourceAssetId: 'asset_02',
      sourceHash: 'sha256_src_02',
      pageRange: '1-3',
      derivedStoragePath: 'derived/off_alpha/cli_alpha_1/doc_usd_03_p1-3_rev2.pdf',
      derivedFileHash: 'sha256_drv_03',
      hasMixedClientFlag: false,
    },
  ];

  it('BIN-01 & BIN-02 (T-12, T-17, T-25, T-28): generates a real .xlsx binary with 5 sheets, leading zeroes preserved, formula cells escaped, and currency-segregated totals', async () => {
    const spec = buildWorkbookSpecification({
      packageId: 'pkg_bin_01',
      packageRevision: 1,
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1',
      periodId: '2026-09',
      packageMode: 'complete_against_defined_list',
      coverageBasis: 'complete_against_defined_list',
      items: sampleItems,
      evidenceRows: [
        {
          documentId: 'doc_thb_01',
          fieldKey: 'grand_total',
          confirmedValue: '1070.00',
          pageNumber: 1,
          spanIds: ['sp_10', 'sp_11'],
        },
      ],
      checklistRows: [
        {
          expectedItemId: 'exp_01',
          title: 'ค่าบริการรายเดือน',
          requirementStatus: 'satisfied',
          matchedDocumentId: 'doc_thb_01',
          resolutionNote: 'ครบถ้วน',
        },
      ],
      exceptionRows: [],
      generatedAt: '2026-10-24T12:00:00.000Z',
    });

    const xlsxBuffer = await generateWorkbookBuffer(spec);

    // OpenXML .xlsx is a ZIP container starting with PK\x03\x04
    expect(xlsxBuffer.length).toBeGreaterThan(1000);
    expect(xlsxBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Round-trip read with ExcelJS
    const summary = await readWorkbookBufferSummary(xlsxBuffer);
    expect(summary.sheetNames).toEqual([
      'Documents',
      'EvidenceIndex',
      'Checklist',
      'Exceptions',
      'PackageInfo',
    ]);

    expect(summary.documentsRows).toHaveLength(3);
    // T-12: Leading zeroes preserved in real Excel cell
    expect(summary.documentsRows[0].documentNumber).toBe('00001234');
    expect(summary.documentsRows[0].sellerTaxId).toBe('0105550009991');
    expect(summary.documentsRows[1].documentNumber).toBe('009988');

    // T-25: Formula injection prefixed with single quote
    expect(summary.documentsRows[0].sellerName.startsWith("'=")).toBe(true);

    // T-17 & T-28: THB supporting receipt (1070.00) is NOT double-counted into THB grandTotalSum, and USD is separate
    expect(summary.packageInfoMap.total_THB_grandTotal).toBe('1070.00');
    expect(summary.packageInfoMap.total_THB_primaryDocumentCount).toBe('1');
    expect(summary.packageInfoMap.total_THB_supportingDocumentCount).toBe('1');
    expect(summary.packageInfoMap.total_USD_grandTotal).toBe('250.50');
  });

  it('BIN-03 (DR-703): extracts a valid split-page PDF binary buffer for the approved pageRange with provenance metadata', () => {
    const pdfBuffer = extractPdfPageRangeBuffer({
      sourceAssetId: 'asset_99',
      sourceHash: 'sha256_original_99',
      pageRange: '2-4',
      documentId: 'doc_split_99',
      documentRevision: 3,
    });

    expect(validateFileMagicBytes(pdfBuffer, 'application/pdf')).toBe(true);
    const inspection = inspectPdfHeader(pdfBuffer);
    expect(inspection.isValidPdf).toBe(true);
    expect(inspection.isEncrypted).toBe(false);
    expect(inspection.pageCount).toBe(3); // pages 2, 3, 4

    const rawText = pdfBuffer.toString('utf8');
    expect(rawText).toContain(
      '%DocReady-Provenance: documentId=doc_split_99 rev=3 sourceAssetId=asset_99 sourceHash=sha256_original_99 pageRange=2-4'
    );
  });

  it('BIN-04 (T-10, T-25): generates a real PKZIP archive containing package.xlsx, manifest.json, and split derived PDFs, and blocks path traversal', async () => {
    const archive = await generateRealExportArchive({
      packageId: 'pkg_zip_01',
      packageRevision: 2,
      officeId: 'off_alpha',
      clientId: 'cli_alpha_1',
      periodId: '2026-09',
      packageMode: 'complete_against_defined_list',
      coverageBasis: 'complete_against_defined_list',
      items: sampleItems,
      generatedAt: '2026-10-24T12:00:00.000Z',
    });

    // Verify PKZIP magic bytes and SHA-256 checksum
    expect(archive.zipBuffer.readUInt32LE(0)).toBe(0x04034b50);
    const actualZipHash = createHash('sha256').update(archive.zipBuffer).digest('hex');
    expect(archive.sha256Checksum).toBe(actualZipHash);
    expect(archive.fileSizeBytes).toBe(archive.zipBuffer.length);

    // Inspect ZIP Central Directory
    const entries = listPkZipEntries(archive.zipBuffer);
    const entryNames = entries.map((e) => e.name);
    expect(entryNames).toContain('package.xlsx');
    expect(entryNames).toContain('manifest.json');
    expect(entryNames).toContain('documents/doc_thb_01_p1-2_rev1.pdf');
    expect(entryNames).toContain('documents/doc_thb_support_02_p3-3_rev1.pdf');
    expect(entryNames).toContain('documents/doc_usd_03_p1-3_rev2.pdf');

    // Extract package.xlsx from inside the ZIP and verify it is a valid Excel workbook
    const extractedXlsx = extractPkZipEntry(archive.zipBuffer, 'package.xlsx');
    const workbookSummary = await readWorkbookBufferSummary(extractedXlsx);
    expect(workbookSummary.documentsRows[0]?.documentNumber).toBe('00001234');

    // Extract manifest.json and verify hashes match the extracted PDF files inside the ZIP
    const extractedManifest = JSON.parse(
      extractPkZipEntry(archive.zipBuffer, 'manifest.json').toString('utf8')
    );
    for (const entry of extractedManifest.entries) {
      const pdfBytes = extractPkZipEntry(archive.zipBuffer, entry.derivedArchivePath);
      expect(validateFileMagicBytes(pdfBytes, 'application/pdf')).toBe(true);
      const pdfHash = createHash('sha256').update(pdfBytes).digest('hex');
      expect(pdfHash).toBe(entry.derivedFileHash);
    }

    // T-25: Reject path traversal attempts in buildPkZipBuffer
    expect(() =>
      buildPkZipBuffer([{ name: '../../etc/passwd', data: Buffer.from('bad') }])
    ).toThrow(/Unsafe ZIP entry path/);
  });

  it('BIN-05 (T-26, T-27): TenantRepository creates real binary exports and enforces tenant isolation on binary downloads', async () => {
    const scopeAlpha = { officeId: 'off_alpha', clientId: 'cli_alpha_1' };
    const repo = new TenantRepository([
      {
        id: 'doc_repo_bin_1',
        officeId: 'off_alpha',
        clientId: 'cli_alpha_1',
        periodId: '2026-10',
        documentNumber: '000555',
        documentDate: '2026-10-05',
        sellerName: 'บริษัท การค้าไทย จำกัด',
        sellerTaxId: '0105551234567',
        grandTotal: '5350.00',
        statedTax: '350.00',
        currency: 'THB',
        status: 'reviewed',
        pageRange: '1-2',
        revisionNumber: 1,
      },
    ]);

    const expItem = await repo.addExpectedItem(scopeAlpha, {
      periodId: '2026-10',
      title: 'ค่าบริการรายเดือน',
      source: 'template',
      requirementStatus: 'required',
      createdByUserId: 'user_staff_1',
    });
    await repo.matchDocumentToExpectedItem(
      scopeAlpha,
      expItem.id,
      'doc_repo_bin_1',
      'user_staff_1'
    );

    const pkg = await repo.createPackageSnapshot(scopeAlpha, {
      periodId: '2026-10',
      packageMode: 'complete_against_defined_list',
      createdByUserId: 'user_staff_1',
    });

    await repo.approvePackage(scopeAlpha, pkg.id, {
      approvedByUserId: 'user_partner_1',
      approvalNote: 'อนุมัติส่งออกไฟล์จริง',
    });

    const exportJob = await repo.createExportJob(scopeAlpha, pkg.id, 'user_staff_1');
    expect(exportJob.zipBuffer).toBeDefined();
    expect(exportJob.xlsxBuffer).toBeDefined();

    // Authorized ZIP binary download
    const zipDownload = await repo.downloadExportBinary({
      requesterScope: scopeAlpha,
      requesterUserId: 'user_staff_1',
      exportId: exportJob.id,
      format: 'zip',
    });
    expect(zipDownload.authorized).toBe(true);
    expect(zipDownload.httpStatus).toBe(200);
    expect(zipDownload.contentType).toBe('application/zip');
    expect(zipDownload.buffer?.readUInt32LE(0)).toBe(0x04034b50);

    // Authorized XLSX binary download
    const xlsxDownload = await repo.downloadExportBinary({
      requesterScope: scopeAlpha,
      requesterUserId: 'user_staff_1',
      exportId: exportJob.id,
      format: 'xlsx',
    });
    expect(xlsxDownload.authorized).toBe(true);
    expect(xlsxDownload.contentType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const wbSummary = await readWorkbookBufferSummary(xlsxDownload.buffer!);
    expect(wbSummary.documentsRows[0].documentNumber).toBe('000555');

    // T-27: Cross-tenant download attempt is blocked (403)
    const crossTenantAttempt = await repo.downloadExportBinary({
      requesterScope: { officeId: 'off_bravo', clientId: 'cli_bravo_1' },
      requesterUserId: 'user_bravo',
      exportId: exportJob.id,
      format: 'zip',
    });
    expect(crossTenantAttempt.authorized).toBe(false);
    expect(crossTenantAttempt.httpStatus).toBe(403);
    expect(crossTenantAttempt.buffer).toBeUndefined();
  });
});
