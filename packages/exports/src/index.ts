import { createHash } from 'crypto';
import { deflateRawSync, inflateRawSync } from 'zlib';
import ExcelJS from 'exceljs';
import {
  CoverageBasis,
  CurrencyTotalSummary,
  ExportManifest,
  ExportManifestEntry,
  ExportStatus,
  PackageItemSnapshot,
  PackageMode,
  TenantScope,
} from '@docready/contracts';
import { aggregatePackageTotalsByCurrency, preserveStringIdentifier } from '@docready/domain';
import { extractPdfPageRangeBuffer } from '@docready/files';

/**
 * Sanitizes filenames for export ZIP packaging, strictly preventing path traversal attacks (T-25).
 */
export function sanitizeExportPath(filename: string): string {
  // Strip out null bytes, drive prefixes, any '..' path segments, and replace slashes with '_'
  return filename
    .replace(/\0/g, '')
    .replace(/^[a-zA-Z]:[/\\]*/, '')
    .replace(/(\.\.[/\\])+/g, '')
    .replace(/\.\./g, '')
    .replace(/^[/\\]+/, '')
    .replace(/[/\\]+/g, '_');
}

/**
 * Escapes leading cell formula characters (=, +, -, @, \t, \r) to prevent Excel Formula Injection (T-25),
 * while allowing strictly numeric negative decimal strings (e.g. "-100.00" for credit notes).
 */
export function escapeExcelFormulaCell(cellValue: string): string {
  if (typeof cellValue !== 'string') return cellValue;
  if (/^-\d+(\.\d{1,4})?$/.test(cellValue)) {
    return cellValue;
  }
  if (/^[=+\-@\t\r]/.test(cellValue)) {
    return `'${cellValue}`;
  }
  return cellValue;
}

export interface EvidenceIndexRow {
  documentId: string;
  fieldKey: string;
  confirmedValue: string;
  pageNumber: number;
  spanIds: string[];
}

export interface ChecklistExportRow {
  expectedItemId: string;
  title: string;
  requirementStatus: string;
  matchedDocumentId: string;
  resolutionNote: string;
}

export interface ExceptionExportRow {
  exceptionId: string;
  category: string;
  description: string;
  acknowledgedBy: string;
}

export interface WorkbookSpecification {
  sheets: {
    Documents: Array<{
      documentId: string;
      documentRevision: number;
      documentNumber: string;
      documentDate: string;
      sellerName: string;
      sellerTaxId: string;
      documentRoles: string;
      countingRole: string;
      currency: string;
      grandTotal: string;
      statedTax: string;
      derivedArchivePath: string;
    }>;
    EvidenceIndex: EvidenceIndexRow[];
    Checklist: ChecklistExportRow[];
    Exceptions: ExceptionExportRow[];
    PackageInfo: {
      packageId: string;
      packageRevision: number;
      officeId: string;
      clientId: string;
      periodId: string;
      packageMode: PackageMode;
      coverageBasis: CoverageBasis;
      completenessBanner: string;
      totalsByCurrency: CurrencyTotalSummary[];
      generatedAt: string;
    };
  };
}

/**
 * Builds the 5-sheet XLSX Workbook Specification (DR-702):
 * Sheets: Documents, EvidenceIndex, Checklist, Exceptions, PackageInfo.
 * Enforces T-12 (string identifiers with leading zeroes), T-17 (countingRole separation),
 * T-25 (formula injection escaping & path sanitization), and T-28 (currency-segregated totals).
 */
export function buildWorkbookSpecification(params: {
  packageId: string;
  packageRevision: number;
  officeId: string;
  clientId: string;
  periodId: string;
  packageMode: PackageMode;
  coverageBasis: CoverageBasis;
  items: PackageItemSnapshot[];
  evidenceRows?: EvidenceIndexRow[];
  checklistRows?: ChecklistExportRow[];
  exceptionRows?: ExceptionExportRow[];
  generatedAt?: string;
}): WorkbookSpecification {
  const {
    packageId,
    packageRevision,
    officeId,
    clientId,
    periodId,
    packageMode,
    coverageBasis,
    items,
    evidenceRows = [],
    checklistRows = [],
    exceptionRows = [],
    generatedAt = new Date().toISOString(),
  } = params;

  const totalsByCurrency = aggregatePackageTotalsByCurrency(items);

  // T-22 & DR-701: Never claim 100% Complete if coverageBasis is received_only or received_documents_with_exceptions
  const completenessBanner =
    coverageBasis === 'complete_against_defined_list'
      ? 'Complete Against Defined List (ครบถ้วนตามรายการที่คาดหวัง)'
      : coverageBasis === 'received_only'
      ? 'Received Documents Only — ไม่มีรายการคาดหวังอ้างอิง (ไม่ได้รับรองความครบถ้วน 100% ของรอบบัญชี)'
      : 'Received Documents with Exceptions — ส่งออกแบบมีข้อยกเว้นที่รับทราบแล้ว';

  const documentsSheet = items.map((item) => {
    const safeFileName = sanitizeExportPath(
      `${item.documentId}_p${item.pageRange}_rev${item.documentRevision}.pdf`
    );
    return {
      documentId: escapeExcelFormulaCell(item.documentId),
      documentRevision: item.documentRevision,
      // T-12: Preserve string formatting & leading zeroes for document numbers and tax IDs
      documentNumber: escapeExcelFormulaCell(preserveStringIdentifier(item.documentNumber)),
      documentDate: escapeExcelFormulaCell(item.documentDate ?? 'missing'),
      sellerName: escapeExcelFormulaCell(item.sellerName ?? 'missing'),
      sellerTaxId: item.sellerTaxId
        ? escapeExcelFormulaCell(preserveStringIdentifier(item.sellerTaxId))
        : 'missing',
      documentRoles: escapeExcelFormulaCell(item.documentRoles.join(', ')),
      countingRole: item.countingRole,
      currency: (item.currency || 'THB').toUpperCase(),
      // T-15: Missing amount is 'missing', never '0.00'
      grandTotal: item.grandTotal ?? 'missing',
      statedTax: item.statedTax ?? 'missing',
      derivedArchivePath: `documents/${safeFileName}`,
    };
  });

  const safeEvidence = evidenceRows.map((row) => ({
    ...row,
    confirmedValue: escapeExcelFormulaCell(row.confirmedValue),
  }));

  const safeChecklist = checklistRows.map((row) => ({
    ...row,
    title: escapeExcelFormulaCell(row.title),
    resolutionNote: escapeExcelFormulaCell(row.resolutionNote),
  }));

  const safeExceptions = exceptionRows.map((row) => ({
    ...row,
    description: escapeExcelFormulaCell(row.description),
    acknowledgedBy: escapeExcelFormulaCell(row.acknowledgedBy),
  }));

  return {
    sheets: {
      Documents: documentsSheet,
      EvidenceIndex: safeEvidence,
      Checklist: safeChecklist,
      Exceptions: safeExceptions,
      PackageInfo: {
        packageId,
        packageRevision,
        officeId,
        clientId,
        periodId,
        packageMode,
        coverageBasis,
        completenessBanner,
        totalsByCurrency,
        generatedAt,
      },
    },
  };
}

/**
 * Builds the Export Manifest (manifest.json) linking each document to its source_hash,
 * page_range, derived_file_hash, and document_revision (DR-702 & DR-703).
 */
export function buildExportManifest(params: {
  packageId: string;
  packageRevision: number;
  officeId: string;
  clientId: string;
  periodId: string;
  packageMode: PackageMode;
  coverageBasis: CoverageBasis;
  items: PackageItemSnapshot[];
  generatedAt?: string;
}): ExportManifest {
  const {
    packageId,
    packageRevision,
    officeId,
    clientId,
    periodId,
    packageMode,
    coverageBasis,
    items,
    generatedAt = new Date().toISOString(),
  } = params;

  const entries: ExportManifestEntry[] = items.map((item) => {
    const safeFileName = sanitizeExportPath(
      `${item.documentId}_p${item.pageRange}_rev${item.documentRevision}.pdf`
    );
    return {
      documentId: item.documentId,
      documentRevision: item.documentRevision,
      sourceHash: item.sourceHash,
      pageRange: item.pageRange,
      derivedArchivePath: `documents/${safeFileName}`,
      derivedFileHash: item.derivedFileHash,
      countingRole: item.countingRole,
    };
  });

  return {
    packageId,
    packageRevision,
    officeId,
    clientId,
    periodId,
    packageMode,
    coverageBasis,
    generatedAt,
    entries,
  };
}

export interface ExportArchiveBundle {
  storageBucket: 'exports';
  storagePath: string;
  workbook: WorkbookSpecification;
  manifest: ExportManifest;
  includedDerivedFiles: Array<{
    archivePath: string;
    derivedStoragePath: string;
    pageRange: string;
    derivedFileHash: string;
  }>;
  sha256Checksum: string;
  fileSizeBytes: number;
}

/**
 * Creates a complete Export Archive Bundle (XLSX + Split Derived PDFs + manifest.json) (DR-702 & DR-703).
 * Enforces T-10: Rejects any item flagged with mixed_client_batch or referencing raw unsplit multi-client files.
 */
export function createExportArchiveBundle(params: {
  packageId: string;
  packageRevision: number;
  officeId: string;
  clientId: string;
  periodId: string;
  packageMode: PackageMode;
  coverageBasis: CoverageBasis;
  items: PackageItemSnapshot[];
  evidenceRows?: EvidenceIndexRow[];
  checklistRows?: ChecklistExportRow[];
  exceptionRows?: ExceptionExportRow[];
  generatedAt?: string;
}): ExportArchiveBundle {
  const { items } = params;

  // T-10 Invariant: Never export mixed-client batch files or raw unsplit originals from quarantine/originals
  for (const item of items) {
    if (item.hasMixedClientFlag) {
      throw new Error(
        `Security violation (T-10): Document ${item.documentId} is flagged as mixed_client_batch and cannot be exported`
      );
    }
    if (
      item.derivedStoragePath.startsWith('quarantine/') ||
      item.derivedStoragePath.startsWith('originals/')
    ) {
      throw new Error(
        `Security violation (T-10): Export for document ${item.documentId} must use derived split file from 'derived/' bucket, not raw '${item.derivedStoragePath}'`
      );
    }
  }

  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const workbook = buildWorkbookSpecification({ ...params, generatedAt });
  const manifest = buildExportManifest({ ...params, generatedAt });

  const includedDerivedFiles = items.map((item) => {
    const safeFileName = sanitizeExportPath(
      `${item.documentId}_p${item.pageRange}_rev${item.documentRevision}.pdf`
    );
    return {
      archivePath: `documents/${safeFileName}`,
      derivedStoragePath: item.derivedStoragePath,
      pageRange: item.pageRange,
      derivedFileHash: item.derivedFileHash,
    };
  });

  const serializedPayload = JSON.stringify({
    workbook,
    manifest,
    includedDerivedFiles,
  });

  const sha256Checksum = createHash('sha256').update(serializedPayload, 'utf8').digest('hex');
  const fileSizeBytes = Buffer.byteLength(serializedPayload, 'utf8');
  const safePkgId = sanitizeExportPath(params.packageId);

  return {
    storageBucket: 'exports',
    storagePath: `exports/${params.officeId}/${params.clientId}/${safePkgId}_rev${params.packageRevision}.zip`,
    workbook,
    manifest,
    includedDerivedFiles,
    sha256Checksum,
    fileSizeBytes,
  };
}

/**
 * Authorizes an Export Download request (DR-704 / T-26 & T-27).
 * - Blocks incomplete/failed/cancelled export jobs (T-26).
 * - Re-verifies active tenant membership & client scope at download time (T-27).
 * - Verifies TTL expiration and SHA-256 checksum integrity.
 */
export function verifyExportDownloadAccess(params: {
  exportJob: {
    id: string;
    officeId: string;
    clientId: string;
    status: ExportStatus;
    storagePath?: string;
    sha256Checksum?: string;
    expiresAt: string;
  };
  requesterScope: TenantScope;
  isMembershipActive: boolean;
  expectedChecksum?: string;
  now?: Date;
}): {
  authorized: boolean;
  httpStatus: 200 | 403 | 409 | 410 | 422;
  reason?: string;
  shortLivedDownloadToken?: string;
} {
  const {
    exportJob,
    requesterScope,
    isMembershipActive,
    expectedChecksum,
    now = new Date(),
  } = params;

  // T-27: Re-verify active membership & tenant isolation at download time
  if (!isMembershipActive) {
    return {
      authorized: false,
      httpStatus: 403,
      reason: 'สิทธิ์การเข้าถึงของสมาชิกถูกเพิกถอนแล้ว (Membership revoked)',
    };
  }

  if (
    requesterScope.officeId !== exportJob.officeId ||
    (requesterScope.clientId && requesterScope.clientId !== exportJob.clientId)
  ) {
    return {
      authorized: false,
      httpStatus: 403,
      reason: 'ไม่มีสิทธิ์ดาวน์โหลดไฟล์ส่งออกข้ามสำนักงานหรือข้ามบริษัทลูกค้า (Tenant scope mismatch)',
    };
  }

  // T-26: Never allow downloading incomplete, failed, or cancelled export jobs
  if (exportJob.status !== 'completed' || !exportJob.storagePath || !exportJob.sha256Checksum) {
    return {
      authorized: false,
      httpStatus: 409,
      reason: `ไฟล์ส่งออกยังไม่พร้อมให้ดาวน์โหลด (สถานะปัจจุบัน: ${exportJob.status})`,
    };
  }

  // Check TTL expiry
  if (new Date(exportJob.expiresAt).getTime() <= now.getTime()) {
    return {
      authorized: false,
      httpStatus: 410,
      reason: 'ลิงก์และไฟล์ส่งออกหมดอายุแล้ว (TTL expired) กรุณาสั่งสร้างไฟล์ส่งออกใหม่',
    };
  }

  // Optional checksum verification
  if (expectedChecksum && expectedChecksum !== exportJob.sha256Checksum) {
    return {
      authorized: false,
      httpStatus: 422,
      reason: 'SHA-256 Checksum ไม่ตรงกับต้นฉบับที่สร้างไว้',
    };
  }

  const shortLivedDownloadToken = createHash('sha256')
    .update(`${exportJob.id}:${exportJob.sha256Checksum}:${now.getTime()}`)
    .digest('hex')
    .slice(0, 32);

  return {
    authorized: true,
    httpStatus: 200,
    shortLivedDownloadToken,
  };
}

/**
 * Generates a real OpenXML .xlsx binary buffer using ExcelJS from a WorkbookSpecification.
 * Enforces T-12 (string cell formatting numFmt = '@'), T-25 (formula escaping), and T-28 (currency totals).
 */
export async function generateWorkbookBuffer(spec: WorkbookSpecification): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DocReady Export Engine';
  workbook.created = new Date(spec.sheets.PackageInfo.generatedAt);

  // 1. Documents Sheet
  const docsSheet = workbook.addWorksheet('Documents');
  docsSheet.columns = [
    { header: 'documentId', key: 'documentId', width: 22, style: { numFmt: '@' } },
    { header: 'documentRevision', key: 'documentRevision', width: 16 },
    { header: 'documentNumber', key: 'documentNumber', width: 22, style: { numFmt: '@' } },
    { header: 'documentDate', key: 'documentDate', width: 16, style: { numFmt: '@' } },
    { header: 'sellerName', key: 'sellerName', width: 30, style: { numFmt: '@' } },
    { header: 'sellerTaxId', key: 'sellerTaxId', width: 20, style: { numFmt: '@' } },
    { header: 'documentRoles', key: 'documentRoles', width: 24, style: { numFmt: '@' } },
    { header: 'countingRole', key: 'countingRole', width: 18, style: { numFmt: '@' } },
    { header: 'currency', key: 'currency', width: 10, style: { numFmt: '@' } },
    { header: 'grandTotal', key: 'grandTotal', width: 18, style: { numFmt: '@' } },
    { header: 'statedTax', key: 'statedTax', width: 16, style: { numFmt: '@' } },
    { header: 'derivedArchivePath', key: 'derivedArchivePath', width: 36, style: { numFmt: '@' } },
  ];

  for (const row of spec.sheets.Documents) {
    const added = docsSheet.addRow({
      documentId: escapeExcelFormulaCell(String(row.documentId)),
      documentRevision: row.documentRevision,
      documentNumber: escapeExcelFormulaCell(preserveStringIdentifier(row.documentNumber)),
      documentDate: escapeExcelFormulaCell(String(row.documentDate)),
      sellerName: escapeExcelFormulaCell(String(row.sellerName)),
      sellerTaxId:
        row.sellerTaxId === 'missing'
          ? 'missing'
          : escapeExcelFormulaCell(preserveStringIdentifier(row.sellerTaxId)),
      documentRoles: escapeExcelFormulaCell(String(row.documentRoles)),
      countingRole: String(row.countingRole),
      currency: String(row.currency),
      grandTotal: String(row.grandTotal),
      statedTax: String(row.statedTax),
      derivedArchivePath: String(row.derivedArchivePath),
    });
    added.eachCell((cell) => {
      if (typeof cell.value === 'string') {
        cell.numFmt = '@';
      }
    });
  }

  // 2. EvidenceIndex Sheet
  const evidenceSheet = workbook.addWorksheet('EvidenceIndex');
  evidenceSheet.columns = [
    { header: 'documentId', key: 'documentId', width: 22, style: { numFmt: '@' } },
    { header: 'fieldKey', key: 'fieldKey', width: 20, style: { numFmt: '@' } },
    { header: 'confirmedValue', key: 'confirmedValue', width: 28, style: { numFmt: '@' } },
    { header: 'pageNumber', key: 'pageNumber', width: 14 },
    { header: 'spanIds', key: 'spanIds', width: 30, style: { numFmt: '@' } },
  ];
  for (const ev of spec.sheets.EvidenceIndex) {
    evidenceSheet.addRow({
      documentId: escapeExcelFormulaCell(ev.documentId),
      fieldKey: escapeExcelFormulaCell(ev.fieldKey),
      confirmedValue: escapeExcelFormulaCell(ev.confirmedValue),
      pageNumber: ev.pageNumber,
      spanIds: escapeExcelFormulaCell(ev.spanIds.join(', ')),
    });
  }

  // 3. Checklist Sheet
  const checklistSheet = workbook.addWorksheet('Checklist');
  checklistSheet.columns = [
    { header: 'expectedItemId', key: 'expectedItemId', width: 22, style: { numFmt: '@' } },
    { header: 'title', key: 'title', width: 32, style: { numFmt: '@' } },
    { header: 'requirementStatus', key: 'requirementStatus', width: 20, style: { numFmt: '@' } },
    { header: 'matchedDocumentId', key: 'matchedDocumentId', width: 22, style: { numFmt: '@' } },
    { header: 'resolutionNote', key: 'resolutionNote', width: 36, style: { numFmt: '@' } },
  ];
  for (const chk of spec.sheets.Checklist) {
    checklistSheet.addRow({
      expectedItemId: escapeExcelFormulaCell(chk.expectedItemId),
      title: escapeExcelFormulaCell(chk.title),
      requirementStatus: escapeExcelFormulaCell(chk.requirementStatus),
      matchedDocumentId: escapeExcelFormulaCell(chk.matchedDocumentId),
      resolutionNote: escapeExcelFormulaCell(chk.resolutionNote),
    });
  }

  // 4. Exceptions Sheet
  const exceptionsSheet = workbook.addWorksheet('Exceptions');
  exceptionsSheet.columns = [
    { header: 'exceptionId', key: 'exceptionId', width: 22, style: { numFmt: '@' } },
    { header: 'category', key: 'category', width: 22, style: { numFmt: '@' } },
    { header: 'description', key: 'description', width: 40, style: { numFmt: '@' } },
    { header: 'acknowledgedBy', key: 'acknowledgedBy', width: 22, style: { numFmt: '@' } },
  ];
  for (const exc of spec.sheets.Exceptions) {
    exceptionsSheet.addRow({
      exceptionId: escapeExcelFormulaCell(exc.exceptionId),
      category: escapeExcelFormulaCell(exc.category),
      description: escapeExcelFormulaCell(exc.description),
      acknowledgedBy: escapeExcelFormulaCell(exc.acknowledgedBy),
    });
  }

  // 5. PackageInfo Sheet
  const pkgSheet = workbook.addWorksheet('PackageInfo');
  pkgSheet.columns = [
    { header: 'key', key: 'key', width: 26, style: { numFmt: '@' } },
    { header: 'value', key: 'value', width: 64, style: { numFmt: '@' } },
  ];
  const info = spec.sheets.PackageInfo;
  const infoPairs: Array<{ key: string; value: string }> = [
    { key: 'packageId', value: info.packageId },
    { key: 'packageRevision', value: String(info.packageRevision) },
    { key: 'officeId', value: info.officeId },
    { key: 'clientId', value: info.clientId },
    { key: 'periodId', value: info.periodId },
    { key: 'packageMode', value: info.packageMode },
    { key: 'coverageBasis', value: info.coverageBasis },
    { key: 'completenessBanner', value: info.completenessBanner },
    { key: 'generatedAt', value: info.generatedAt },
  ];
  for (const total of info.totalsByCurrency) {
    infoPairs.push({
      key: `total_${total.currency}_grandTotal`,
      value: total.grandTotalSum,
    });
    infoPairs.push({
      key: `total_${total.currency}_statedTax`,
      value: total.statedTaxSum,
    });
    infoPairs.push({
      key: `total_${total.currency}_primaryDocumentCount`,
      value: String(total.primaryDocumentCount),
    });
    infoPairs.push({
      key: `total_${total.currency}_supportingDocumentCount`,
      value: String(total.supportingDocumentCount),
    });
  }
  for (const pair of infoPairs) {
    pkgSheet.addRow({
      key: pair.key,
      value: escapeExcelFormulaCell(pair.value),
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export interface WorkbookBufferSummary {
  sheetNames: string[];
  documentsRows: Array<Record<string, string>>;
  packageInfoMap: Record<string, string>;
}

/**
 * Reads back a binary .xlsx buffer using ExcelJS to verify sheet names, cell values,
 * leading zero preservation (T-12), and formula escaping (T-25).
 */
export async function readWorkbookBufferSummary(
  xlsxBuffer: Buffer
): Promise<WorkbookBufferSummary> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxBuffer as unknown as ExcelJS.Buffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const documentsRows: Array<Record<string, string>> = [];
  const docsSheet = workbook.getWorksheet('Documents');

  if (docsSheet) {
    const headers: string[] = [];
    const headerRow = docsSheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value ?? '');
    });

    docsSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, string> = {};
      headers.forEach((h, colNumber) => {
        if (!h) return;
        const val = row.getCell(colNumber).value;
        record[h] = val === null || val === undefined ? '' : String(val);
      });
      documentsRows.push(record);
    });
  }

  const packageInfoMap: Record<string, string> = {};
  const pkgSheet = workbook.getWorksheet('PackageInfo');
  if (pkgSheet) {
    pkgSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const k = String(row.getCell(1).value ?? '');
      const v = String(row.getCell(2).value ?? '');
      if (k) {
        packageInfoMap[k] = v;
      }
    });
  }

  return {
    sheetNames,
    documentsRows,
    packageInfoMap,
  };
}

// ==========================================
// Standard PKZIP Builder & Inspector (T-25 Safe)
// ==========================================

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    const byte = buf[i] ?? 0;
    const tableVal = CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = tableVal ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipInputEntry {
  name: string;
  data: Buffer;
}

export interface ZipDirectoryEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  compressionMethod: number;
  localHeaderOffset: number;
}

/**
 * Validates and normalizes an internal ZIP archive path, rejecting any '..' traversal or absolute paths (T-25).
 */
export function normalizeZipEntryPath(entryPath: string): string {
  const cleaned = entryPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!cleaned || cleaned.includes('\0') || cleaned.split('/').some((seg) => seg === '..' || seg === '.')) {
    throw new Error(`Security violation (T-25): Unsafe ZIP entry path '${entryPath}'`);
  }
  return cleaned;
}

/**
 * Builds a standard PKZIP binary archive (PK\x03\x04 local headers + deflate + PK\x01\x02 central directory + PK\x05\x06 EOCD).
 */
export function buildPkZipBuffer(entries: ZipInputEntry[]): Buffer {
  const localFileChunks: Buffer[] = [];
  const centralDirChunks: Buffer[] = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const safeName = normalizeZipEntryPath(entry.name);
    const nameBuf = Buffer.from(safeName, 'utf8');
    const uncompressedSize = entry.data.length;
    const crc = computeCrc32(entry.data);
    const compressedData = deflateRawSync(entry.data);
    const compressedSize = compressedData.length;
    const compressionMethod = 8; // Deflate

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    localHeader.writeUInt16LE(20, 4); // Version needed (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10); // Mod time
    localHeader.writeUInt16LE(0x5548, 12); // Mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // Extra field length

    localFileChunks.push(localHeader, nameBuf, compressedData);

    // Central directory header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
    centralHeader.writeUInt16LE(20, 4); // Version made by
    centralHeader.writeUInt16LE(20, 6); // Version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x5548, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // Extra length
    centralHeader.writeUInt16LE(0, 32); // Comment length
    centralHeader.writeUInt16LE(0, 34); // Disk number
    centralHeader.writeUInt16LE(0, 36); // Internal attrs
    centralHeader.writeUInt32LE(0, 38); // External attrs
    centralHeader.writeUInt32LE(currentOffset, 42); // Offset of local header

    centralDirChunks.push(centralHeader, nameBuf);
    currentOffset += localHeader.length + nameBuf.length + compressedSize;
  }

  const centralDirBuffer = Buffer.concat(centralDirChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4); // Number of this disk
  eocd.writeUInt16LE(0, 6); // Disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(currentOffset, 16);
  eocd.writeUInt16LE(0, 20); // Comment length

  return Buffer.concat([...localFileChunks, centralDirBuffer, eocd]);
}

/**
 * Parses the Central Directory of a PKZIP buffer to list all entries and metadata.
 */
export function listPkZipEntries(zipBuffer: Buffer): ZipDirectoryEntry[] {
  if (zipBuffer.length < 22 || zipBuffer.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Invalid PKZIP buffer: missing PK\\x03\\x04 header');
  }

  // Locate EOCD signature (0x06054b50) from the end
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= Math.max(0, zipBuffer.length - 65557); i -= 1) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Invalid PKZIP buffer: missing End of Central Directory record');
  }

  const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);

  const entries: ZipDirectoryEntry[] = [];
  let ptr = centralDirOffset;

  for (let i = 0; i < totalEntries; i += 1) {
    if (zipBuffer.readUInt32LE(ptr) !== 0x02014b50) {
      throw new Error('Corrupt Central Directory entry header');
    }
    const compressionMethod = zipBuffer.readUInt16LE(ptr + 10);
    const crc32 = zipBuffer.readUInt32LE(ptr + 16);
    const compressedSize = zipBuffer.readUInt32LE(ptr + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(ptr + 24);
    const nameLen = zipBuffer.readUInt16LE(ptr + 28);
    const extraLen = zipBuffer.readUInt16LE(ptr + 30);
    const commentLen = zipBuffer.readUInt16LE(ptr + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(ptr + 42);
    const name = zipBuffer.subarray(ptr + 46, ptr + 46 + nameLen).toString('utf8');

    entries.push({
      name,
      compressedSize,
      uncompressedSize,
      crc32,
      compressionMethod,
      localHeaderOffset,
    });

    ptr += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

/**
 * Extracts and decompresses a single file entry from a PKZIP buffer, verifying bounds, maxOutputLength (Zip Bomb guard), and CRC32.
 */
export function extractPkZipEntry(
  zipBuffer: Buffer,
  entryName: string,
  maxOutputLength = 50 * 1024 * 1024
): Buffer {
  const entries = listPkZipEntries(zipBuffer);
  const found = entries.find((e) => e.name === entryName);
  if (!found) {
    throw new Error(`ZIP entry not found: ${entryName}`);
  }

  const localOffset = found.localHeaderOffset;
  if (localOffset + 30 > zipBuffer.length || zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error(`Corrupt local file header at offset ${localOffset}`);
  }
  const nameLen = zipBuffer.readUInt16LE(localOffset + 26);
  const extraLen = zipBuffer.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLen + extraLen;
  if (dataStart + found.compressedSize > zipBuffer.length) {
    throw new Error(`Corrupt ZIP entry slice bounds for ${entryName}`);
  }
  const compressedSlice = zipBuffer.subarray(dataStart, dataStart + found.compressedSize);

  const uncompressed =
    found.compressionMethod === 8
      ? inflateRawSync(compressedSlice, { maxOutputLength })
      : Buffer.from(compressedSlice);

  const actualCrc = computeCrc32(uncompressed);
  if (actualCrc !== found.crc32) {
    throw new Error(`CRC32 mismatch for ZIP entry ${entryName}`);
  }

  return uncompressed;
}

export interface RealExportArchiveBundle extends ExportArchiveBundle {
  xlsxBuffer: Buffer;
  zipBuffer: Buffer;
  manifestJson: string;
  derivedPdfBuffers: Record<string, Buffer>;
}

/**
 * Generates a complete Real Binary Export Archive (.zip containing real package.xlsx, manifest.json,
 * and split-derived PDF files in documents/*.pdf) with verified SHA-256 checksums.
 */
export async function generateRealExportArchive(params: {
  packageId: string;
  packageRevision: number;
  officeId: string;
  clientId: string;
  periodId: string;
  packageMode: PackageMode;
  coverageBasis: CoverageBasis;
  items: PackageItemSnapshot[];
  evidenceRows?: EvidenceIndexRow[];
  checklistRows?: ChecklistExportRow[];
  exceptionRows?: ExceptionExportRow[];
  generatedAt?: string;
}): Promise<RealExportArchiveBundle> {
  // Reuse createExportArchiveBundle for T-10 validation and initial specification
  const baseBundle = createExportArchiveBundle(params);
  const generatedAt = baseBundle.manifest.generatedAt;

  // 1. Generate real OpenXML .xlsx binary
  const xlsxBuffer = await generateWorkbookBuffer(baseBundle.workbook);

  // 2. Generate split-derived PDF buffers for each approved item and compute real SHA-256 hashes
  const derivedPdfBuffers: Record<string, Buffer> = {};
  const updatedManifestEntries: ExportManifestEntry[] = [];
  const updatedIncludedFiles: RealExportArchiveBundle['includedDerivedFiles'] = [];

  for (const item of params.items) {
    const safeFileName = sanitizeExportPath(
      `${item.documentId}_p${item.pageRange}_rev${item.documentRevision}.pdf`
    );
    const archivePath = `documents/${safeFileName}`;
    const pdfBuffer = extractPdfPageRangeBuffer({
      sourceAssetId: item.sourceAssetId,
      sourceHash: item.sourceHash,
      pageRange: item.pageRange,
      documentId: item.documentId,
      documentRevision: item.documentRevision,
    });
    const realDerivedHash = createHash('sha256').update(pdfBuffer).digest('hex');

    derivedPdfBuffers[archivePath] = pdfBuffer;
    updatedManifestEntries.push({
      documentId: item.documentId,
      documentRevision: item.documentRevision,
      sourceHash: item.sourceHash,
      pageRange: item.pageRange,
      derivedArchivePath: archivePath,
      derivedFileHash: realDerivedHash,
      countingRole: item.countingRole,
    });
    updatedIncludedFiles.push({
      archivePath,
      derivedStoragePath: item.derivedStoragePath,
      pageRange: item.pageRange,
      derivedFileHash: realDerivedHash,
    });
  }

  const manifest: ExportManifest = {
    ...baseBundle.manifest,
    generatedAt,
    entries: updatedManifestEntries,
  };
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBuffer = Buffer.from(manifestJson, 'utf8');

  // 3. Build real PKZIP archive containing package.xlsx, manifest.json, and documents/*.pdf
  const zipEntries: ZipInputEntry[] = [
    { name: 'package.xlsx', data: xlsxBuffer },
    { name: 'manifest.json', data: manifestBuffer },
    ...Object.entries(derivedPdfBuffers).map(([name, data]) => ({ name, data })),
  ];

  const zipBuffer = buildPkZipBuffer(zipEntries);
  const sha256Checksum = createHash('sha256').update(zipBuffer).digest('hex');
  const fileSizeBytes = zipBuffer.length;

  return {
    storageBucket: 'exports',
    storagePath: baseBundle.storagePath,
    workbook: baseBundle.workbook,
    manifest,
    includedDerivedFiles: updatedIncludedFiles,
    sha256Checksum,
    fileSizeBytes,
    xlsxBuffer,
    zipBuffer,
    manifestJson,
    derivedPdfBuffers,
  };
}

