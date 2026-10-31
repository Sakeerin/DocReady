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
  PilotEvent,
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
 * Validates a 13-digit Thai Tax ID using the official Revenue Department Mod 11 checksum.
 */
export function isValidThaiTaxIdChecksum(taxId: string): boolean {
  if (!/^\d{13}$/.test(taxId)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(taxId[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === Number(taxId[12]);
}

/**
 * Validates that a Gregorian calendar date (year, month 1..12, day 1..31) is a real calendar date.
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return false;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1] ?? 0;
  return day <= maxDay;
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

  const toCents = (v: string): number => {
    const negative = v.startsWith('-');
    const [whole = '0', frac = ''] = (negative ? v.slice(1) : v).split('.');
    // Round half-up at 2 decimals using string digits only (no floating point)
    const frac3 = (frac + '000').slice(0, 3);
    let cents = Number(BigInt(whole) * 100n + BigInt(frac3.slice(0, 2)));
    if (Number(frac3[2]) >= 5) cents += 1;
    return negative ? -cents : cents;
  };

  const subtotalCents = toCents(subtotalStr);
  const taxCents = toCents(taxStr);
  const grandTotalCents = toCents(grandTotalStr);

  const calculatedCents = subtotalCents + taxCents;
  const discrepancyCents = Math.abs(calculatedCents - grandTotalCents);

  const isValid = discrepancyCents <= 5;
  const sign = calculatedCents < 0 ? '-' : '';
  const absCents = Math.abs(calculatedCents);
  const calculatedTotal = `${sign}${Math.floor(absCents / 100)}.${String(absCents % 100).padStart(2, '0')}`;

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


// ==========================================
// Phase S8 QA, Hardening & Pilot Readiness (DR-801 to DR-806)
// ==========================================

export interface FairQueueJob {
  id: string;
  officeId: string;
  clientId: string;
  pages: number;
}

export interface FairQueueConfig {
  maxConcurrentPagesPerClient: number;
  maxConcurrentJobsPerOffice: number;
  dailyPageBudgetPerOffice: number;
}

export interface FairQueueResult {
  started: FairQueueJob[];
  deferred: FairQueueJob[];
  rejectedBudget: FairQueueJob[];
}

/**
 * Fair Queue Scheduler (DR-802): round-robin across (officeId, clientId) so one client cannot
 * starve workers or provider budget of others. Pure function: caller supplies current usage.
 */
export function scheduleFairQueue(params: {
  pending: FairQueueJob[];
  config: FairQueueConfig;
  runningPagesByClient?: Record<string, number>;
  runningJobsByOffice?: Record<string, number>;
  usedPagesTodayByOffice?: Record<string, number>;
  totalWorkerSlots: number;
}): FairQueueResult {
  const { pending, config, totalWorkerSlots } = params;
  const runningPages = { ...(params.runningPagesByClient ?? {}) };
  const runningJobs = { ...(params.runningJobsByOffice ?? {}) };
  const usedToday = { ...(params.usedPagesTodayByOffice ?? {}) };

  const queues = new Map<string, FairQueueJob[]>();
  for (const job of pending) {
    const key = `${job.officeId}::${job.clientId}`;
    const q = queues.get(key) ?? [];
    q.push(job);
    queues.set(key, q);
  }

  const started: FairQueueJob[] = [];
  const deferred: FairQueueJob[] = [];
  const rejectedBudget: FairQueueJob[] = [];
  let slots = totalWorkerSlots;
  let progressed = true;

  while (progressed) {
    progressed = false;
    for (const [key, q] of queues) {
      const job = q[0];
      if (!job) continue;
      if (slots <= 0) {
        continue;
      }
      const officeUsed = usedToday[job.officeId] ?? 0;
      if (officeUsed + job.pages > config.dailyPageBudgetPerOffice) {
        q.shift();
        rejectedBudget.push(job);
        progressed = true;
        continue;
      }
      const clientPages = runningPages[key] ?? 0;
      const officeJobs = runningJobs[job.officeId] ?? 0;
      if (
        clientPages + job.pages > config.maxConcurrentPagesPerClient ||
        officeJobs >= config.maxConcurrentJobsPerOffice
      ) {
        continue;
      }
      q.shift();
      started.push(job);
      runningPages[key] = clientPages + job.pages;
      runningJobs[job.officeId] = officeJobs + 1;
      usedToday[job.officeId] = officeUsed + job.pages;
      slots -= 1;
      progressed = true;
    }
  }

  for (const q of queues.values()) deferred.push(...q);
  return { started, deferred, rejectedBudget };
}

export interface KillSwitchConfig {
  ocr?: boolean;
  jev?: boolean;
  autoClassification?: boolean;
  export?: boolean;
}

export interface KillSwitchState {
  ocrEnabled: boolean;
  jevEnabled: boolean;
  autoClassificationEnabled: boolean;
  exportEnabled: boolean;
  acceptUploads: true;
  intakeStatus: 'normal' | 'delayed_manual';
}

/**
 * Kill Switches (DR-806): `true` in config means the feature is KILLED. Uploads are always accepted
 * (subject to quota); when OCR or Jev is down, new files are marked delayed/manual.
 */
export function evaluateKillSwitches(config: KillSwitchConfig): KillSwitchState {
  const ocrEnabled = !config.ocr;
  const jevEnabled = !config.jev;
  return {
    ocrEnabled,
    jevEnabled,
    autoClassificationEnabled: !config.autoClassification,
    exportEnabled: !config.export,
    acceptUploads: true,
    intakeStatus: ocrEnabled && jevEnabled ? 'normal' : 'delayed_manual',
  };
}

export function readKillSwitchesFromEnv(env: Record<string, string | undefined>): KillSwitchConfig {
  const on = (v?: string) => v === '1' || v?.toLowerCase() === 'true';
  return {
    ocr: on(env.DOCREADY_KILL_OCR),
    jev: on(env.DOCREADY_KILL_JEV),
    autoClassification: on(env.DOCREADY_KILL_AUTOCLASS),
    export: on(env.DOCREADY_KILL_EXPORT),
  };
}

/**
 * Diagnostic Log Redaction (DR-804): only IDs/status/duration/error codes may be logged.
 * Redacts 13-digit tax IDs, bearer tokens, API keys and secret-like assignments.
 */
export function redactDiagnosticText(text: string): string {
  return text
    .replace(/\b\d{13}\b/g, '[REDACTED_TAX_ID]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /\b(api[_-]?key|secret|token|password|service[_-]?key)\b\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]'
    )
    .replace(/\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{5,}\b/g, '[REDACTED_JWT]');
}

export function containsSecretOrPii(text: string): boolean {
  return redactDiagnosticText(text) !== text;
}

export type OcrResultDisposition = 'publish' | 'stale' | 'cancelled';

/**
 * Stale OCR Result Guard (T-08): a result arriving after the asset was deleted/replaced
 * must never be published or resurrect data.
 */
export function resolveStaleOcrResult(params: {
  assetStatus: 'active' | 'deleted' | 'replaced';
  assetVersion: number;
  resultVersion: number;
}): OcrResultDisposition {
  if (params.assetStatus === 'deleted') return 'cancelled';
  if (params.assetStatus === 'replaced' || params.assetVersion !== params.resultVersion) {
    return 'stale';
  }
  return 'publish';
}

export type OcrResumeAction = 'poll_operation' | 'resubmit' | 'manual_review';

/**
 * OCR Resume Planner (T-07): resume from persisted operation ID; an unknown submission
 * is retried only within a bounded attempt count, then escalated to manual review.
 */
export function planOcrResume(params: {
  operationId?: string;
  submitOutcomeUnknown: boolean;
  attempts: number;
  maxAttempts: number;
}): OcrResumeAction {
  if (params.operationId) return 'poll_operation';
  if (params.submitOutcomeUnknown && params.attempts >= params.maxAttempts) {
    return 'manual_review';
  }
  if (params.attempts >= params.maxAttempts) return 'manual_review';
  return 'resubmit';
}

export type RetentionDecision = 'allow' | 'deny_tombstoned' | 'deny_legal_hold';

/**
 * Retention Guard (T-29): tombstoned assets can never be OCR'd, exported or restored;
 * legal holds block deletion.
 */
export function evaluateRetentionAction(params: {
  action: 'ocr' | 'export' | 'restore' | 'delete';
  tombstoned: boolean;
  legalHold: boolean;
}): RetentionDecision {
  if (params.action === 'delete') {
    return params.legalHold ? 'deny_legal_hold' : 'allow';
  }
  if (params.tombstoned) return 'deny_tombstoned';
  return 'allow';
}

export interface AmbiguousDateResult {
  status: 'proposed' | 'ambiguous';
  candidates: string[];
  reason?: string;
}

/**
 * Ambiguous Date Detector (T-13): dd/mm vs mm/dd and Buddhist (BE) vs Gregorian years.
 * Never picks a tax period automatically for ambiguous input.
 */
export function detectAmbiguousDate(raw: string): AmbiguousDateResult {
  const m = raw.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/);
  if (!m) return { status: 'ambiguous', candidates: [], reason: 'unparseable_date' };
  const a = Number(m[1]);
  const b = Number(m[2]);
  const yRaw = m[3]!;
  const reasons: string[] = [];
  const candidates: string[] = [];

  const yearOptions: number[] = [];
  if (yRaw.length === 2) {
    yearOptions.push(2000 + Number(yRaw));
    yearOptions.push(2500 + Number(yRaw));
    reasons.push('two_digit_year');
  } else {
    const y = Number(yRaw);
    if (y >= 2400) {
      yearOptions.push(y - 543);
      reasons.push('buddhist_era_converted');
    } else {
      yearOptions.push(y);
    }
  }

  const dayMonthPairs: Array<[number, number]> = [];
  if (a <= 12 && b <= 12 && a !== b) {
    dayMonthPairs.push([a, b], [b, a]);
    reasons.push('day_month_order');
  } else if (b <= 12) {
    dayMonthPairs.push([a, b]);
  } else if (a <= 12) {
    dayMonthPairs.push([b, a]);
  }

  for (const [d, mo] of dayMonthPairs) {
    for (const y of yearOptions) {
      const effectiveGregorianYear = y >= 2400 ? y - 543 : y;
      if (isValidCalendarDate(effectiveGregorianYear, mo, d)) {
        candidates.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      }
    }
  }

  const ambiguousReasons = reasons.filter((r) => r !== 'buddhist_era_converted');
  if (candidates.length === 0) return { status: 'ambiguous', candidates, reason: 'invalid_date' };
  if (candidates.length > 1 || ambiguousReasons.length > 0) {
    return { status: 'ambiguous', candidates, reason: reasons.join(',') };
  }
  return { status: 'proposed', candidates };
}

/**
 * Untrusted Text Guard (T-24): OCR text is data only. Detects instruction-like content so
 * the pipeline flags it; no tenant, approval or amount change is ever derived from text.
 */
export function flagInstructionLikeText(text: string): { flagged: boolean; matches: string[] } {
  const patterns = [
    /ignore (all )?(previous|prior) instructions/i,
    /switch (to )?(tenant|office|client)/i,
    /\bapprove\b.{0,30}\b(package|document|all)\b/i,
    /change (the )?(total|amount|grand total)/i,
    /office_id|client_id/i,
  ];
  const matches = patterns.filter((p) => p.test(text)).map((p) => p.source);
  return { flagged: matches.length > 0, matches };
}

export interface UatCaseResult {
  caseId: string;
  status: 'pass' | 'fail' | 'not_run';
}

/**
 * Pilot Readiness Gate (DR-806): auto-approval must stay disabled and no critical defect may be open.
 */
export function evaluatePilotReadiness(params: {
  criticalDefectsOpen: number;
  autoApprovalEnabled: boolean;
  killSwitchesAvailable: boolean;
  uatResults: UatCaseResult[];
  requiredUatCases: number;
}): { ready: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (params.criticalDefectsOpen > 0) blockers.push('มี critical defect ค้างอยู่');
  if (params.autoApprovalEnabled) blockers.push('auto-approval ต้องปิดสำหรับ pilot');
  if (!params.killSwitchesAvailable) blockers.push('ยังไม่มี kill switches');
  const passed = params.uatResults.filter((r) => r.status === 'pass').length;
  if (params.uatResults.some((r) => r.status === 'fail')) blockers.push('มี UAT case ที่ไม่ผ่าน');
  if (passed < params.requiredUatCases) {
    blockers.push(`UAT ผ่าน ${passed}/${params.requiredUatCases} เคส (ต้องรันกับผู้ใช้จริงให้ครบ)`);
  }
  return { ready: blockers.length === 0, blockers };
}

/**
 * Decision Contract Guard (T-19): a Jev/provider selection is accepted only if it is one of
 * the bounded candidate IDs offered in the question. Otherwise the proposal is rejected and
 * the document stays available for manual review.
 */
export function validateDecisionSelection(
  allowedChoiceIds: string[],
  selectedId: string | null | undefined
): { accepted: boolean; requiresManualReview: boolean } {
  if (selectedId && allowedChoiceIds.includes(selectedId) && selectedId !== 'none_ambiguous') {
    return { accepted: true, requiresManualReview: false };
  }
  return { accepted: false, requiresManualReview: true };
}

/**
 * Proposal Status Resolver (T-11): high Jev confidence must never mask a weak OCR read.
 */
export function resolveFieldProposalStatus(params: {
  ocrConfidence: number;
  jevConfidence?: number;
  ocrConfidenceThreshold?: number;
}): 'proposed' | 'needs_review' {
  const threshold = params.ocrConfidenceThreshold ?? 0.9;
  if (params.ocrConfidence < threshold) return 'needs_review';
  return 'proposed';
}

// ==========================================
// Phase S9 Pilot Evaluation Logic (DR-901 to DR-906)
// Pure functions only; they never invent data. Insufficient evidence => keep assist / continue pilot.
// ==========================================

/** Wilson score lower bound for a proportion (used to gate auto-routing, plan section 30). */
export function wilsonLowerBound(successes: number, total: number, z = 1.96): number {
  if (total <= 0) return 0;
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return Math.max(0, (centre - margin) / denom);
}

export interface CategoryDecisionStats {
  category: string;
  correct: number;
  total: number;
}

export interface AutoClassificationGateResult {
  autoRouteEnabled: boolean;
  /** Invariant: financial fields and packages are NEVER auto-approved in the MVP. */
  autoApproveFinancialFields: false;
  autoApprovePackage: false;
  totalDecisions: number;
  categories: Array<{
    category: string;
    total: number;
    correct: number;
    lowerBound: number;
    passed: boolean;
  }>;
  reason: string;
}

/**
 * Auto-classification gate (DR-904): needs >= minTotalDecisions overall and each category's
 * Wilson lower bound >= minLowerBound. Otherwise stay in assist mode.
 */
export function evaluateAutoClassificationGate(params: {
  perCategory: CategoryDecisionStats[];
  minTotalDecisions?: number;
  minLowerBound?: number;
}): AutoClassificationGateResult {
  const minTotal = params.minTotalDecisions ?? 300;
  const minLower = params.minLowerBound ?? 0.95;
  const totalDecisions = params.perCategory.reduce((acc, c) => acc + c.total, 0);

  const categories = params.perCategory.map((c) => {
    const lowerBound = wilsonLowerBound(c.correct, c.total);
    return {
      category: c.category,
      total: c.total,
      correct: c.correct,
      lowerBound,
      passed: totalDecisions >= minTotal && lowerBound >= minLower,
    };
  });

  const anyPassed = categories.some((c) => c.passed);
  return {
    autoRouteEnabled: anyPassed,
    autoApproveFinancialFields: false,
    autoApprovePackage: false,
    totalDecisions,
    categories,
    reason:
      totalDecisions < minTotal
        ? `ตัวอย่างไม่พอ (${totalDecisions}/${minTotal} decisions) — คงโหมด assist`
        : anyPassed
        ? 'บางหมวดผ่านเกณฑ์ Wilson lower bound — เปิด auto-route เฉพาะหมวดที่ผ่าน'
        : 'ไม่มีหมวดใดผ่าน Wilson lower bound — คงโหมด assist',
  };
}

/** Coverage report (DR-903): always reports error rate alongside coverage. */
export function computeCoverage(params: {
  eligible: number;
  autoClassified: number;
  errors: number;
}): { coverage: number | null; errorRate: number | null } {
  const coverage = params.eligible > 0 ? params.autoClassified / params.eligible : null;
  const errorRate = params.autoClassified > 0 ? params.errors / params.autoClassified : null;
  return { coverage, errorRate };
}

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stratified review sample (DR-903): draws from accepted, corrected AND AI-abstained groups so quality
 * is not measured only on easy cases the system chose to answer. Deterministic per seed.
 */
export function buildReviewSample(params: {
  items: Array<{ id: string; group: 'reviewer_accepted' | 'reviewer_corrected' | 'ai_abstained' }>;
  perGroup: number;
  seed: number;
}): { sampled: Array<{ id: string; group: string }>; groupsCovered: string[]; shortfalls: string[] } {
  const groups = ['reviewer_accepted', 'reviewer_corrected', 'ai_abstained'] as const;
  const rand = seededRandom(params.seed);
  const sampled: Array<{ id: string; group: string }> = [];
  const shortfalls: string[] = [];

  for (const group of groups) {
    const pool = params.items.filter((i) => i.group === group).map((i) => i.id);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    const picked = pool.slice(0, params.perGroup);
    if (picked.length < params.perGroup) shortfalls.push(group);
    for (const id of picked) sampled.push({ id, group });
  }

  return {
    sampled,
    groupsCovered: groups.filter((g) => sampled.some((s) => s.group === g)),
    shortfalls,
  };
}

export interface PilotMetricsResult {
  status: 'ok' | 'insufficient_sample';
  sampleSize: number;
  minDocuments: number;
  baseline?: PilotModeMetrics;
  assisted?: PilotModeMetrics;
  timeReductionPercent?: number | null;
  reworkWorseThanBaseline?: boolean | null;
}

export interface PilotModeMetrics {
  documents: number;
  secondsPer100Docs: number;
  reviewRoundsPerDoc: number;
  reworkRate: number;
  costSatangPer100Docs: number;
}

function summarizePilotMode(events: PilotEvent[]): PilotModeMetrics | undefined {
  const documents = events.reduce((a, e) => a + e.documents, 0);
  if (documents === 0) return undefined;
  const seconds = events.reduce((a, e) => a + e.activeSeconds + e.supportSeconds, 0);
  const rounds = events.reduce((a, e) => a + e.reviewRounds, 0);
  const rework = events.reduce((a, e) => a + e.reworkedDocuments, 0);
  const cost = events.reduce((a, e) => a + e.costSatang, 0);
  return {
    documents,
    secondsPer100Docs: (seconds / documents) * 100,
    reviewRoundsPerDoc: rounds / documents,
    reworkRate: rework / documents,
    costSatangPer100Docs: (cost / documents) * 100,
  };
}

/**
 * Pilot metrics (DR-905): returns insufficient_sample instead of numbers when either mode
 * has fewer than minDocuments documents. Compares assisted vs baseline only when both exist.
 */
export function computePilotMetrics(params: {
  events: PilotEvent[];
  minDocuments?: number;
}): PilotMetricsResult {
  const minDocuments = params.minDocuments ?? 100;
  const baseline = summarizePilotMode(params.events.filter((e) => e.mode === 'baseline'));
  const assisted = summarizePilotMode(params.events.filter((e) => e.mode === 'assisted'));
  const sampleSize = (baseline?.documents ?? 0) + (assisted?.documents ?? 0);

  if (!baseline || !assisted || baseline.documents < minDocuments || assisted.documents < minDocuments) {
    return { status: 'insufficient_sample', sampleSize, minDocuments };
  }

  const timeReductionPercent =
    baseline.secondsPer100Docs > 0
      ? ((baseline.secondsPer100Docs - assisted.secondsPer100Docs) / baseline.secondsPer100Docs) * 100
      : null;

  return {
    status: 'ok',
    sampleSize,
    minDocuments,
    baseline,
    assisted,
    timeReductionPercent,
    reworkWorseThanBaseline: assisted.reworkRate > baseline.reworkRate,
  };
}

/** Rollout gate (DR-901/DR-902): stage1 -> stage2 only without blocking defects and with S8 readiness. */
export function evaluatePilotRolloutStage(params: {
  blockingDefectsOpen: number;
  s8ReadinessPassed: boolean;
}): { canAdvance: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (params.blockingDefectsOpen > 0) blockers.push('ยังมี blocking defects ค้างอยู่');
  if (!params.s8ReadinessPassed) blockers.push('S8 pilot readiness ยังไม่ผ่าน (UAT/staging)');
  return { canAdvance: blockers.length === 0, blockers };
}

export type PilotDecision = 'expand' | 'keep_assist' | 'adjust_workflow' | 'continue_pilot';

/**
 * Pilot decision (DR-905/DR-906): short pilots, unfinished accounting cycles or thin samples
 * can never justify a conclusion; the pilot simply continues.
 */
export function evaluatePilotDecision(params: {
  workingDays: number;
  sampleSizeOk: boolean;
  accountingCycleClosed: boolean;
  timeReductionPercent: number | null;
  reworkWorseThanBaseline: boolean | null;
  minWorkingDays?: number;
  targetTimeReductionPercent?: number;
}): { decision: PilotDecision; reason: string } {
  const minDays = params.minWorkingDays ?? 7;
  const target = params.targetTimeReductionPercent ?? 30;

  if (params.workingDays < minDays) {
    return { decision: 'continue_pilot', reason: `pilot ยังไม่ครบ ${minDays} วันทำงาน` };
  }
  if (!params.accountingCycleClosed) {
    return { decision: 'continue_pilot', reason: 'งานบัญชียังไม่จบรอบจริง' };
  }
  if (!params.sampleSizeOk || params.timeReductionPercent === null || params.reworkWorseThanBaseline === null) {
    return { decision: 'continue_pilot', reason: 'จำนวนตัวอย่างไม่พอ' };
  }
  if (params.timeReductionPercent >= target && !params.reworkWorseThanBaseline) {
    return { decision: 'expand', reason: `ลดเวลา ≥${target}% และ rework ไม่แย่กว่า baseline` };
  }
  if (params.timeReductionPercent > 0 && !params.reworkWorseThanBaseline) {
    return { decision: 'keep_assist', reason: 'มีประโยชน์แต่ยังไม่ถึงเป้า — คงโหมด assist' };
  }
  return { decision: 'adjust_workflow', reason: 'ไม่ลดเวลาหรือ rework แย่กว่า baseline — ปรับ workflow/adapter' };
}
