import {
  FieldStatus,
  LogicalPageGroup,
  DocumentRole,
  RelationType,
  ExpectedRequirementStatus,
  CoverageBasis,
  MissingRequestStatus,
  PackageMode,
  PackageStatus,
  CountingRole,
  CurrencyTotalSummary,
  PackageItemSnapshot,
  UsageLedgerEntry,
  UsageMetricType,
} from '@docready/contracts';

/**
 * Custom Error for Optimistic Concurrency Control Conflicts
 */
export class RevisionConflictError extends Error {
  constructor(public currentRevision: number, public expectedRevision: number) {
    super(`Revision conflict: document is at revision ${currentRevision}, but payload expected revision ${expectedRevision}`);
    this.name = 'RevisionConflictError';
  }
}

/**
 * Optimistic Concurrency Control Check:
 * Throws RevisionConflictError (409) if the expected revision does not match the document's current revision.
 */
export function validateDocumentRevision(currentRevision: number, expectedRevision: number): boolean {
  if (currentRevision !== expectedRevision) {
    throw new RevisionConflictError(currentRevision, expectedRevision);
  }
  return true;
}

/**
 * Validates allowed state transitions for document field statuses.
 */
export function canTransitionFieldStatus(
  currentStatus: FieldStatus,
  targetStatus: FieldStatus,
  actor: 'human' | 'system_ai'
): boolean {
  if (currentStatus === 'confirmed' && actor === 'system_ai') {
    return false;
  }
  return true;
}

/**
 * Stale Job Resolution Guard: Returns true if human has already confirmed field.
 */
export function isStaleAiResolution(currentStatus: FieldStatus): boolean {
  return currentStatus === 'confirmed';
}

/**
 * Sanitizes and maintains strict string representation of document identifiers & tax IDs.
 */
export function preserveStringIdentifier(rawInput: string): string {
  if (typeof rawInput !== 'string') {
    throw new TypeError('Document identifiers and tax IDs must strictly be string types');
  }
  return rawInput.trim();
}

/**
 * Validates decimal monetary strings using strict regex.
 */
export function isValidDecimalString(val: string): boolean {
  return /^-?\d+(\.\d{1,4})?$/.test(val);
}

/**
 * Page Grouping Invariant: Validates that EVERY page of an uploaded multi-page document
 * is assigned to a logical document group with no missing or overlapping pages.
 */
export function validatePageGroupingCompleteness(
  totalPages: number,
  groups: LogicalPageGroup[]
): { valid: boolean; missingPages: number[]; duplicatePages: number[] } {
  const seenPages = new Map<number, number>();
  const duplicatePages: number[] = [];

  for (const group of groups) {
    for (const pageNum of group.pageNumbers) {
      if (seenPages.has(pageNum)) {
        duplicatePages.push(pageNum);
      } else {
        seenPages.set(pageNum, 1);
      }
    }
  }

  const missingPages: number[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (!seenPages.has(p)) {
      missingPages.push(p);
    }
  }

  const valid = missingPages.length === 0 && duplicatePages.length === 0;

  return { valid, missingPages, duplicatePages };
}

/**
 * Quota and Security Limits Validator:
 * Enforces max 20 MB per file, max 30 pages per PDF document.
 */
export function checkFileQuotaLimits(
  fileSizeBytes: number,
  pageCount: number
): { valid: boolean; errorReason?: string } {
  const MAX_SIZE_BYTES = 20 * 1024 * 1024;
  const MAX_PAGES = 30;

  if (fileSizeBytes > MAX_SIZE_BYTES) {
    return { valid: false, errorReason: 'ขนาดไฟล์เกินเพดานสูงสุด 20 MB' };
  }

  if (pageCount > MAX_PAGES) {
    return { valid: false, errorReason: 'จำนวนหน้าเกินเพดานสูงสุด 30 หน้า/ไฟล์' };
  }

  return { valid: true };
}

/**
 * Decimal Monetary Component Arithmetic Validator.
 */
export function validateMonetaryComponents(
  subtotalStr?: string | null,
  taxStr?: string | null,
  grandTotalStr?: string | null
): { isValid: boolean; calculatedTotal?: string; discrepancyCents?: number } {
  if (!grandTotalStr || !isValidDecimalString(grandTotalStr)) {
    return { isValid: false };
  }

  if (!subtotalStr || !taxStr || !isValidDecimalString(subtotalStr) || !isValidDecimalString(taxStr)) {
    return { isValid: true };
  }

  const subtotalCents = Math.round(parseFloat(subtotalStr) * 100);
  const taxCents = Math.round(parseFloat(taxStr) * 100);
  const grandTotalCents = Math.round(parseFloat(grandTotalStr) * 100);

  const calculatedCents = subtotalCents + taxCents;
  const discrepancyCents = Math.abs(calculatedCents - grandTotalCents);

  const isValid = discrepancyCents <= 5;
  const calculatedTotal = (calculatedCents / 100).toFixed(2);

  return { isValid, calculatedTotal, discrepancyCents };
}

/**
 * Client Identity Mismatch Detector.
 */
export function detectClientCompanyMismatch(
  sellerTaxId?: string,
  clientTaxId?: string
): { isMismatch: boolean; warning?: string } {
  if (!sellerTaxId || !clientTaxId) {
    return { isMismatch: false };
  }

  const cleanSeller = sellerTaxId.replace(/\D/g, '');
  const cleanClient = clientTaxId.replace(/\D/g, '');

  if (cleanSeller === cleanClient && cleanClient.length > 0) {
    return {
      isMismatch: true,
      warning: 'เลขผู้เสียภาษีของผู้ขายตรงกับเลขผู้เสียภาษีของบริษัทลูกค้า (โปรดตรวจสอบทิศทางเอกสาร)',
    };
  }

  return { isMismatch: false };
}

export interface CandidateDocumentSummary {
  id: string;
  documentNumber?: string;
  sellerTaxId?: string;
  documentDate?: string;
  grandTotal?: string;
  currency?: string;
}

/**
 * Semantic Duplicate Match Detector:
 * Matches candidate pair based on issuer tax ID, document number, date, amount, and currency.
 * System ONLY flags candidates for human review; NEVER auto-deletes or merges.
 */
export function detectSemanticDuplicates(
  target: CandidateDocumentSummary,
  candidates: CandidateDocumentSummary[]
): Array<{ candidate: CandidateDocumentSummary; score: number; matchReasons: string[] }> {
  const matches: Array<{ candidate: CandidateDocumentSummary; score: number; matchReasons: string[] }> = [];

  for (const cand of candidates) {
    if (cand.id === target.id) continue;

    let score = 0;
    const matchReasons: string[] = [];

    if (
      target.documentNumber &&
      cand.documentNumber &&
      target.documentNumber.trim().toLowerCase() === cand.documentNumber.trim().toLowerCase()
    ) {
      score += 0.5;
      matchReasons.push('เลขที่เอกสารตรงกัน (Document Number Match)');
    }

    if (target.sellerTaxId && cand.sellerTaxId && target.sellerTaxId === cand.sellerTaxId) {
      score += 0.2;
      matchReasons.push('เลขประจำตัวผู้เสียภาษีผู้ขายตรงกัน (Seller Tax ID Match)');
    }

    if (
      target.grandTotal &&
      cand.grandTotal &&
      target.grandTotal === cand.grandTotal &&
      target.currency === cand.currency
    ) {
      score += 0.2;
      matchReasons.push('ยอดเงินรวมและสกุลเงินตรงกัน (Amount & Currency Match)');
    }

    if (target.documentDate && cand.documentDate && target.documentDate === cand.documentDate) {
      score += 0.1;
      matchReasons.push('วันที่เอกสารตรงกัน (Document Date Match)');
    }

    if (score >= 0.5) {
      matches.push({ candidate: cand, score, matchReasons });
    }
  }

  return matches;
}

/**
 * Relation Type Rule Validator:
 * Ensures Invoice + Receipt for the same transaction is suggested as 'supports' instead of 'duplicate_of'.
 */
export function validateRelationType(
  roleA: DocumentRole,
  roleB: DocumentRole,
  proposedRelation: RelationType
): RelationType {
  if (
    (roleA === 'invoice' && (roleB === 'receipt' || roleB === 'payment_evidence')) ||
    (roleB === 'invoice' && (roleA === 'receipt' || roleA === 'payment_evidence'))
  ) {
    if (proposedRelation === 'duplicate_of') {
      return 'supports';
    }
  }
  return proposedRelation;
}

// ==========================================
// Phase S6 Checklists, Expected Items & Readiness Engine
// ==========================================

export interface ExpectedItemSummary {
  id: string;
  title: string;
  vendorName?: string;
  expectedAmount?: string;
  requirementStatus: ExpectedRequirementStatus;
}

export interface ExpectedMatchSummary {
  expectedItemId: string;
  documentId: string;
}

export interface PeriodReadinessResult {
  coverageBasis: CoverageBasis;
  isCompleteAgainstDefinedList: boolean;
  canApproveWithExceptions: boolean;
  totalExpected: number;
  requiredCount: number;
  matchedRequiredCount: number;
  missingRequiredIds: string[];
  reviewedDocCount: number;
  bannerMessage: string;
}

/**
 * Period Readiness & Coverage Basis Engine (DR-606 / T-22):
 * Strictly prevents false completeness claims when no expected list is defined.
 */
export function computePeriodReadiness(
  expectedItems: ExpectedItemSummary[],
  matches: ExpectedMatchSummary[],
  reviewedDocCount: number,
  exceptionsAcknowledged = false
): PeriodReadinessResult {
  // Rule T-22: If there is NO expected list defined, coverage_basis MUST be 'received_only'
  if (expectedItems.length === 0) {
    return {
      coverageBasis: 'received_only',
      isCompleteAgainstDefinedList: false,
      canApproveWithExceptions: reviewedDocCount > 0,
      totalExpected: 0,
      requiredCount: 0,
      matchedRequiredCount: 0,
      missingRequiredIds: [],
      reviewedDocCount,
      bannerMessage:
        'จัดชุดจากเอกสารที่ได้รับแล้วเท่านั้น (Received Only) — ยังไม่มีการกำหนดรายการที่คาดหวังสำหรับรอบงานนี้ จึงไม่สามารถยืนยันความครบถ้วนของทั้งกิจการได้',
    };
  }

  const matchedItemIds = new Set(matches.map((m) => m.expectedItemId));
  const requiredItems = expectedItems.filter((item) => item.requirementStatus === 'required');
  const missingRequiredIds = requiredItems
    .filter((item) => !matchedItemIds.has(item.id))
    .map((item) => item.id);

  const matchedRequiredCount = requiredItems.length - missingRequiredIds.length;

  if (missingRequiredIds.length === 0) {
    return {
      coverageBasis: 'complete_against_defined_list',
      isCompleteAgainstDefinedList: true,
      canApproveWithExceptions: true,
      totalExpected: expectedItems.length,
      requiredCount: requiredItems.length,
      matchedRequiredCount,
      missingRequiredIds: [],
      reviewedDocCount,
      bannerMessage: 'เอกสารครบถ้วนตามรายการที่คาดหวังที่กำหนดสำหรับรอบงานนี้ (Complete Against Defined List)',
    };
  }

  return {
    coverageBasis: 'received_documents_with_exceptions',
    isCompleteAgainstDefinedList: false,
    canApproveWithExceptions: exceptionsAcknowledged,
    totalExpected: expectedItems.length,
    requiredCount: requiredItems.length,
    matchedRequiredCount,
    missingRequiredIds,
    reviewedDocCount,
    bannerMessage: `ขาดเอกสารบังคับอีก ${missingRequiredIds.length} รายการ — ต้องติดตามเพิ่มหรือให้ Reviewer ยืนยันอนุมัติแบบมีข้อยกเว้น (Received Documents with Exceptions)`,
  };
}

export interface ParsedCsvExpectedRow {
  title: string;
  vendorName?: string;
  expectedAmount?: string;
  requirementStatus: ExpectedRequirementStatus;
}

/**
 * Expected Register CSV Parser (DR-602):
 * Parses CSV lines without assuming every item requires a tax invoice; preserves leading zeroes & decimal strings.
 */
export function parseExpectedItemsCsv(csvContent: string): ParsedCsvExpectedRow[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const rows: ParsedCsvExpectedRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip header row if detected
    if (i === 0 && line.toLowerCase().startsWith('title,')) {
      continue;
    }

    const parts = line.split(',').map((p) => p.trim());
    const rawTitle = parts[0] || '';
    if (!rawTitle) continue;

    // Sanitize formula prefix
    const safeTitle = rawTitle.replace(/^[=+\-@]+/, '');
    const vendorName = parts[1] ? parts[1].replace(/^[=+\-@]+/, '') : undefined;
    const expectedAmount = parts[2] && isValidDecimalString(parts[2]) ? parts[2] : undefined;

    const rawReq = (parts[3] || 'conditional').toLowerCase();
    const requirementStatus: ExpectedRequirementStatus =
      rawReq === 'required' || rawReq === 'not_applicable' ? rawReq : 'conditional';

    rows.push({
      title: safeTitle,
      vendorName,
      expectedAmount,
      requirementStatus,
    });
  }

  return rows;
}

/**
 * Missing Document Request State Machine (DR-604 & DR-605 / T-23):
 * Client responses NEVER transition directly to 'resolved'. Only staff can resolve a request.
 */
export function transitionMissingRequestStatus(
  currentStatus: MissingRequestStatus,
  action: 'publish' | 'client_respond' | 'staff_resolve',
  actorType: 'office_staff' | 'client_user'
): MissingRequestStatus {
  if (action === 'publish') {
    if (actorType !== 'office_staff') {
      throw new Error('Only accounting office staff can publish missing document requests');
    }
    return 'published';
  }

  if (action === 'client_respond') {
    if (currentStatus !== 'published' && currentStatus !== 'responded') {
      throw new Error('Cannot respond to a request that is not published');
    }
    // T-23 Invariant: Client response sets status to 'responded', NEVER 'resolved'
    return 'responded';
  }

  if (action === 'staff_resolve') {
    if (actorType !== 'office_staff') {
      throw new Error('Client users cannot mark a missing document request as resolved');
    }
    return 'resolved';
  }

  return currentStatus;
}

// ==========================================
// Phase S7 Package Snapshot, Approval Invalidation & Usage Ledger (DR-701 to DR-706)
// ==========================================

/**
 * Exact Decimal String Addition using scaled BigInt (scale = 4 decimal places)
 * Prevents IEEE-754 float64 rounding errors (T-14).
 */
export function addDecimalStringsExact(a = '0.00', b = '0.00'): string {
  const toScaled = (val: string): bigint => {
    const trimmed = val.trim();
    if (!isValidDecimalString(trimmed)) {
      throw new Error(`Invalid decimal string: ${val}`);
    }
    const negative = trimmed.startsWith('-');
    const unsigned = negative ? trimmed.slice(1) : trimmed;
    const [wholePart = '0', fracPart = ''] = unsigned.split('.');
    const paddedFrac = (fracPart + '0000').slice(0, 4);
    const scaled = BigInt(wholePart) * 10000n + BigInt(paddedFrac);
    return negative ? -scaled : scaled;
  };

  const sumScaled = toScaled(a) + toScaled(b);
  const isNeg = sumScaled < 0n;
  const absScaled = isNeg ? -sumScaled : sumScaled;
  const whole = absScaled / 10000n;
  const frac4 = (absScaled % 10000n).toString().padStart(4, '0');
  // Trim trailing zeroes down to 2 decimal places if possible
  const fracFormatted = frac4.endsWith('00') ? frac4.slice(0, 2) : frac4;
  return `${isNeg ? '-' : ''}${whole.toString()}.${fracFormatted}`;
}

/**
 * Determines the counting role for a document inside a package snapshot (DR-702 / T-17).
 * - If a document is marked 'duplicate_of' another document or status is 'excluded', it is 'excluded_duplicate'.
 * - If a document 'supports' another primary document (e.g. Receipt supporting an Invoice), it is 'supporting_non_counting'
 *   so that both appear in the Documents sheet without double-counting their monetary amounts.
 */
export function determineCountingRole(
  documentStatus: string,
  outgoingRelations: Array<{ relationType: RelationType }>
): CountingRole {
  if (
    documentStatus === 'excluded' ||
    outgoingRelations.some((r) => r.relationType === 'duplicate_of')
  ) {
    return 'excluded_duplicate';
  }

  if (outgoingRelations.some((r) => r.relationType === 'supports')) {
    return 'supporting_non_counting';
  }

  return 'primary_counting';
}

/**
 * Aggregates package monetary totals strictly separated by currency (T-17 & T-28).
 * Never sums amounts across different currencies (e.g. THB vs USD) and never double-counts supporting documents.
 */
export function aggregatePackageTotalsByCurrency(
  items: PackageItemSnapshot[]
): CurrencyTotalSummary[] {
  const byCurrency = new Map<
    string,
    {
      primaryDocumentCount: number;
      supportingDocumentCount: number;
      grandTotalSum: string;
      statedTaxSum: string;
    }
  >();

  for (const item of items) {
    if (item.countingRole === 'excluded_duplicate') {
      continue;
    }

    const currency = (item.currency || 'THB').toUpperCase();
    const existing = byCurrency.get(currency) ?? {
      primaryDocumentCount: 0,
      supportingDocumentCount: 0,
      grandTotalSum: '0.00',
      statedTaxSum: '0.00',
    };

    if (item.countingRole === 'primary_counting') {
      existing.primaryDocumentCount += 1;
      if (item.grandTotal && isValidDecimalString(item.grandTotal)) {
        existing.grandTotalSum = addDecimalStringsExact(existing.grandTotalSum, item.grandTotal);
      }
      if (item.statedTax && isValidDecimalString(item.statedTax)) {
        existing.statedTaxSum = addDecimalStringsExact(existing.statedTaxSum, item.statedTax);
      }
    } else if (item.countingRole === 'supporting_non_counting') {
      existing.supportingDocumentCount += 1;
    }

    byCurrency.set(currency, existing);
  }

  return Array.from(byCurrency.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, summary]) => ({
      currency,
      ...summary,
    }));
}

/**
 * Validates whether a Package Snapshot can be created/approved under the requested PackageMode (DR-701, DR-703 / T-10, T-22).
 */
export function validatePackageSnapshotEligibility(params: {
  packageMode: PackageMode;
  readiness: PeriodReadinessResult;
  items: PackageItemSnapshot[];
  exceptionsAcknowledged: boolean;
}): { eligible: boolean; reasons: string[] } {
  const { packageMode, readiness, items, exceptionsAcknowledged } = params;
  const reasons: string[] = [];

  if (items.length === 0) {
    reasons.push('ไม่สามารถสร้างหรืออนุมัติแพ็กเกจที่ไม่มีเอกสารได้');
  }

  // T-10 Guard: Never allow mixed-client batch source files in a package export
  const mixedClientDocs = items.filter((i) => i.hasMixedClientFlag);
  if (mixedClientDocs.length > 0) {
    reasons.push(
      `พบเอกสารที่ติดธงปะปนข้ามบริษัทลูกค้า (mixed_client_batch) จำนวน ${mixedClientDocs.length} รายการ ต้องแยกไฟล์ก่อนอนุมัติส่งออก`
    );
  }

  if (packageMode === 'complete_against_defined_list') {
    if (readiness.coverageBasis === 'received_only') {
      reasons.push(
        'ไม่สามารถใช้โหมด complete_against_defined_list ได้เนื่องจากยังไม่มีรายการเอกสารที่คาดหวัง (received_only ห้ามระบุว่าครบ 100%)'
      );
    } else if (!readiness.isCompleteAgainstDefinedList) {
      reasons.push(
        `ไม่สามารถอนุมัติโหมด complete_against_defined_list ได้เนื่องจากยังขาดเอกสารบังคับอีก ${readiness.missingRequiredIds.length} รายการ`
      );
    }
  } else if (packageMode === 'received_documents_with_exceptions') {
    if (readiness.missingRequiredIds.length > 0 && !exceptionsAcknowledged) {
      reasons.push(
        'โหมด received_documents_with_exceptions ที่มีเอกสารบังคับขาดหาย ต้องให้ Reviewer ยืนยันรับทราบข้อยกเว้น (exceptionsAcknowledged)'
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Evaluates whether an approved Package Snapshot is still valid for generating a new export,
 * or if subsequent edits to documents/checklists have invalidated the approval (DR-701 / T-21).
 * Note: The historical snapshot items inside the package remain immutable for audit.
 */
export function evaluatePackageApprovalValidity(params: {
  currentPackageStatus: PackageStatus;
  snapshotItems: PackageItemSnapshot[];
  currentDocuments: Array<{ id: string; revisionNumber: number; status: string }>;
  checklistRevisionSnapshot: number;
  currentChecklistRevision: number;
}): { isValidForExport: boolean; effectiveStatus: PackageStatus; invalidationReason?: string } {
  const {
    currentPackageStatus,
    snapshotItems,
    currentDocuments,
    checklistRevisionSnapshot,
    currentChecklistRevision,
  } = params;

  if (currentPackageStatus !== 'approved') {
    return {
      isValidForExport: false,
      effectiveStatus: currentPackageStatus,
      invalidationReason:
        currentPackageStatus === 'invalidated_by_change'
          ? 'การอนุมัติเดิมถูกยกเลิกเนื่องจากมีการแก้ไขข้อมูลหลังอนุมัติ'
          : 'แพ็กเกจยังไม่ได้รับการอนุมัติ',
    };
  }

  if (currentChecklistRevision !== checklistRevisionSnapshot) {
    return {
      isValidForExport: false,
      effectiveStatus: 'invalidated_by_change',
      invalidationReason: `รายการ Checklist/Expected Items ถูกแก้ไขหลังอนุมัติ (snapshot rev ${checklistRevisionSnapshot} -> current rev ${currentChecklistRevision})`,
    };
  }

  const currentDocMap = new Map(currentDocuments.map((d) => [d.id, d]));

  for (const item of snapshotItems) {
    const liveDoc = currentDocMap.get(item.documentId);
    if (!liveDoc) {
      return {
        isValidForExport: false,
        effectiveStatus: 'invalidated_by_change',
        invalidationReason: `เอกสาร ${item.documentId} ถูกลบหรือเปลี่ยนขอบเขตหลังอนุมัติ`,
      };
    }
    if (liveDoc.revisionNumber !== item.documentRevision) {
      return {
        isValidForExport: false,
        effectiveStatus: 'invalidated_by_change',
        invalidationReason: `เอกสาร ${item.documentId} ถูกแก้ไขหลังอนุมัติ (snapshot rev ${item.documentRevision} -> current rev ${liveDoc.revisionNumber})`,
      };
    }
  }

  // Check if new reviewed/approved documents were added to the period after snapshot
  const snapshotDocIds = new Set(snapshotItems.map((i) => i.documentId));
  for (const liveDoc of currentDocuments) {
    if (
      (liveDoc.status === 'reviewed' || liveDoc.status === 'approved') &&
      !snapshotDocIds.has(liveDoc.id)
    ) {
      return {
        isValidForExport: false,
        effectiveStatus: 'invalidated_by_change',
        invalidationReason: `มีเอกสารใหม่ (${liveDoc.id}) เพิ่มเข้ามาในงวดหลังจากอนุมัติแพ็กเกจแล้ว`,
      };
    }
  }

  return {
    isValidForExport: true,
    effectiveStatus: 'approved',
  };
}

export interface ClientUsageSummary {
  officeId: string;
  clientId: string;
  metrics: Record<
    UsageMetricType,
    {
      rawUnits: number;
      billableUnits: number;
      systemFaultReprocessUnits: number;
      providerCostSatang: number;
    }
  >;
  totalProviderCostSatang: number;
}

/**
 * Summarizes Usage & Cost Ledger per (officeId, clientId) (DR-705).
 * Separates provider cost from billable units (system-fault reprocesses are excluded from billableUnits).
 */
export function summarizeUsageLedger(entries: UsageLedgerEntry[]): ClientUsageSummary[] {
  const byClient = new Map<string, ClientUsageSummary>();
  const allMetrics: UsageMetricType[] = [
    'ocr_pages',
    'jev_input_tokens',
    'jev_output_tokens',
    'storage_bytes',
    'export_runs',
  ];

  for (const entry of entries) {
    const key = `${entry.officeId}::${entry.clientId}`;
    let summary = byClient.get(key);
    if (!summary) {
      const emptyMetrics = {} as ClientUsageSummary['metrics'];
      for (const m of allMetrics) {
        emptyMetrics[m] = {
          rawUnits: 0,
          billableUnits: 0,
          systemFaultReprocessUnits: 0,
          providerCostSatang: 0,
        };
      }
      summary = {
        officeId: entry.officeId,
        clientId: entry.clientId,
        metrics: emptyMetrics,
        totalProviderCostSatang: 0,
      };
      byClient.set(key, summary);
    }

    const bucket = summary.metrics[entry.metricType];
    bucket.rawUnits += entry.rawUnits;
    if (entry.isSystemFaultReprocess) {
      bucket.systemFaultReprocessUnits += entry.rawUnits;
    } else {
      bucket.billableUnits += entry.billableUnits;
    }
    bucket.providerCostSatang += entry.providerCostSatang;
    summary.totalProviderCostSatang += entry.providerCostSatang;
  }

  return Array.from(byClient.values());
}

export interface OperationalMetricsSummary {
  officeId: string;
  sampleSize: number;
  totalDocumentsCount: number;
  reviewedDocumentsCount: number;
  backlogDocumentsCount: number;
  exceptionRatePercent: number;
  averagePrepTimeSeconds: number;
  openMissingRequestsCount: number;
  resolvedMissingRequestsCount: number;
  approvedPackagesCount: number;
  invalidatedPackagesCount: number;
}

/**
 * Computes Operational Dashboard Metrics with explicit sampleSize (DR-706).
 */
export function computeOperationalMetrics(params: {
  officeId: string;
  documents: Array<{ status: string; prepDurationSeconds?: number; hasException?: boolean }>;
  missingRequests: Array<{ status: MissingRequestStatus }>;
  packages: Array<{ status: PackageStatus }>;
}): OperationalMetricsSummary {
  const { officeId, documents, missingRequests, packages } = params;
  const sampleSize = documents.length;
  const reviewedDocs = documents.filter(
    (d) => d.status === 'reviewed' || d.status === 'approved'
  );
  const backlogDocs = documents.filter(
    (d) => d.status !== 'reviewed' && d.status !== 'approved' && d.status !== 'excluded'
  );
  const exceptionDocs = documents.filter((d) => d.hasException);

  const durations = reviewedDocs
    .map((d) => d.prepDurationSeconds)
    .filter((v): v is number => typeof v === 'number' && v >= 0);

  const averagePrepTimeSeconds =
    durations.length > 0
      ? Math.round(durations.reduce((acc, v) => acc + v, 0) / durations.length)
      : 0;

  const exceptionRatePercent =
    sampleSize > 0 ? Number(((exceptionDocs.length / sampleSize) * 100).toFixed(2)) : 0;

  return {
    officeId,
    sampleSize,
    totalDocumentsCount: sampleSize,
    reviewedDocumentsCount: reviewedDocs.length,
    backlogDocumentsCount: backlogDocs.length,
    exceptionRatePercent,
    averagePrepTimeSeconds,
    openMissingRequestsCount: missingRequests.filter((r) => r.status !== 'resolved').length,
    resolvedMissingRequestsCount: missingRequests.filter((r) => r.status === 'resolved').length,
    approvedPackagesCount: packages.filter((p) => p.status === 'approved').length,
    invalidatedPackagesCount: packages.filter((p) => p.status === 'invalidated_by_change').length,
  };
}

