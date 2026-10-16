import { createHash } from 'crypto';
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
 * Escapes leading cell formula characters (=, +, -, @, \t, \r) to prevent Excel Formula Injection (T-25).
 */
export function escapeExcelFormulaCell(cellValue: string): string {
  if (typeof cellValue !== 'string') return cellValue;
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
