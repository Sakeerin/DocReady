import {
  TenantScope,
  LogicalPageGroup,
  ExtractedCandidate,
  OcrSpan,
  OcrProviderType,
  DecisionRunResult,
  RelationType,
  ExpectedItemSource,
  ExpectedRequirementStatus,
  MissingRequestStatus,
  PackageMode,
  PackageStatus,
  CoverageBasis,
  CurrencyTotalSummary,
  PackageItemSnapshot,
  ExportStatus,
  ExportManifest,
  UsageLedgerEntry,
  UsageMetricType,
  PilotEvent,
  ReviewSampleResult,
  WillingnessToPaySurvey,
} from '@docready/contracts';
import {
  validateDocumentRevision,
  detectSemanticDuplicates,
  CandidateDocumentSummary,
  computePeriodReadiness,
  PeriodReadinessResult,
  transitionMissingRequestStatus,
  determineCountingRole,
  aggregatePackageTotalsByCurrency,
  validatePackageSnapshotEligibility,
  evaluatePackageApprovalValidity,
  summarizeUsageLedger,
  ClientUsageSummary,
  computeOperationalMetrics,
  OperationalMetricsSummary,
  evaluateRetentionAction,
  computePilotMetrics,
  PilotMetricsResult,
  evaluateAutoClassificationGate,
  AutoClassificationGateResult,
} from '@docready/domain';
import {
  createExportArchiveBundle,
  ExportArchiveBundle,
  generateRealExportArchive,
  RealExportArchiveBundle,
  verifyExportDownloadAccess,
} from '@docready/exports';

export interface AssetRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  storageKey: string;
  fileHash: string;
  sessionId: string;
  version: number;
}

export interface DocumentRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  documentNumber: string;
  documentDate?: string;
  sellerName?: string;
  sellerTaxId?: string;
  grandTotal?: string;
  statedTax?: string;
  currency?: string;
  fileHash?: string;
  status: string;
  revisionNumber: number;
  fieldStatusSummary?: string;
  documentRoles?: string[];
  sourceAssetId?: string;
  sourceHash?: string;
  pageRange?: string;
  derivedStoragePath?: string;
  derivedFileHash?: string;
  hasMixedClientFlag?: boolean;
  prepDurationSeconds?: number;
  hasException?: boolean;
}

export interface UploadSessionRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  filename: string;
  fileSizeBytes: number;
  mimeType: string;
  storageKey: string;
  status: 'reserved' | 'completed' | 'expired';
}

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface OcrRunRecord {
  id: string;
  officeId: string;
  clientId: string;
  documentId: string;
  provider: OcrProviderType;
  operationId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
}

export interface TokenLedgerRecord {
  id: string;
  officeId: string;
  clientId: string;
  documentId: string;
  provider: string;
  modelVersion: string;
  inputTokens: number;
  estimatedCostUsd: number;
}

export interface DocumentRevisionRecord {
  id: string;
  officeId: string;
  clientId: string;
  documentId: string;
  revisionNumber: number;
  actorUserId: string;
  changesJson: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface DocumentRelationRecord {
  id: string;
  officeId: string;
  clientId: string;
  documentId: string;
  targetDocumentId: string;
  relationType: RelationType;
  confirmedByUserId: string;
  createdAt: string;
}

export interface ExpectedItemRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  title: string;
  vendorName?: string;
  expectedAmount?: string;
  source: ExpectedItemSource;
  requirementStatus: ExpectedRequirementStatus;
  resolutionNote?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface ExpectedMatchRecord {
  id: string;
  officeId: string;
  clientId: string;
  expectedItemId: string;
  documentId: string;
  confirmedByUserId: string;
  createdAt: string;
}

export interface MissingRequestRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  expectedItemId?: string;
  title: string;
  publicMessage: string;
  internalNote?: string;
  status: MissingRequestStatus;
  resolutionNote?: string;
  resolvedByUserId?: string;
  createdAt: string;
}

export interface RequestResponseRecord {
  id: string;
  officeId: string;
  clientId: string;
  requestId: string;
  responderUserId: string;
  responseType: 'upload_file' | 'no_transaction_explanation';
  explanationText?: string;
  uploadedDocumentId?: string;
  createdAt: string;
}

export interface PackageRecord {
  id: string;
  officeId: string;
  clientId: string;
  periodId: string;
  packageRevision: number;
  packageMode: PackageMode;
  coverageBasis: CoverageBasis;
  status: PackageStatus;
  checklistRevisionSnapshot: number;
  items: PackageItemSnapshot[];
  totalsByCurrency: CurrencyTotalSummary[];
  exceptionsAcknowledged: boolean;
  invalidationReason?: string;
  createdByUserId: string;
  createdAt: string;
}

export interface ApprovalRecord {
  id: string;
  officeId: string;
  clientId: string;
  packageId: string;
  approvedByUserId: string;
  approvalNote?: string;
  exceptionsAcknowledged: boolean;
  status: 'active' | 'invalidated';
  invalidatedReason?: string;
  approvedAt: string;
  invalidatedAt?: string;
}

export interface ExportJobRecord {
  id: string;
  officeId: string;
  clientId: string;
  packageId: string;
  requestedByUserId: string;
  status: ExportStatus;
  storageBucket: 'exports';
  storagePath?: string;
  sha256Checksum?: string;
  fileSizeBytes?: number;
  manifest?: ExportManifest;
  archiveBundle?: ExportArchiveBundle | RealExportArchiveBundle;
  xlsxBuffer?: Buffer;
  zipBuffer?: Buffer;
  errorMessage?: string;
  expiresAt: string;
  createdAt: string;
  completedAt?: string;
}

export class TenantRepository {
  private documents: DocumentRecord[] = [];
  private sessions: UploadSessionRecord[] = [];
  private outbox: OutboxEventRecord[] = [];
  private ocrRuns: OcrRunRecord[] = [];
  private decisionRuns: DecisionRunResult[] = [];
  private tokenLedger: TokenLedgerRecord[] = [];
  private revisions: DocumentRevisionRecord[] = [];
  private relations: DocumentRelationRecord[] = [];
  private expectedItems: ExpectedItemRecord[] = [];
  private expectedMatches: ExpectedMatchRecord[] = [];
  private missingRequests: MissingRequestRecord[] = [];
  private requestResponses: RequestResponseRecord[] = [];
  private packages: PackageRecord[] = [];
  private approvals: ApprovalRecord[] = [];
  private exportJobs: ExportJobRecord[] = [];
  private usageLedger: UsageLedgerEntry[] = [];
  private checklistRevisions = new Map<string, number>();
  private revokedMemberships = new Set<string>();
  private ocrSpansMap = new Map<string, OcrSpan[]>();
  private candidatesMap = new Map<string, ExtractedCandidate[]>();
  private pageGroupings = new Map<string, LogicalPageGroup[]>();

  constructor(initialDocs: DocumentRecord[] = []) {
    this.documents = initialDocs.map((d) => ({
      ...d,
      revisionNumber: d.revisionNumber ?? 1,
    }));
  }

  private getChecklistRevision(officeId: string, clientId: string, periodId: string): number {
    return this.checklistRevisions.get(`${officeId}::${clientId}::${periodId}`) ?? 1;
  }

  private bumpChecklistRevision(officeId: string, clientId: string, periodId: string, reason: string): void {
    const key = `${officeId}::${clientId}::${periodId}`;
    const next = (this.checklistRevisions.get(key) ?? 1) + 1;
    this.checklistRevisions.set(key, next);
    this.invalidateApprovedPackagesForPeriod(officeId, clientId, periodId, reason);
  }

  /**
   * T-21 Invariant: Any mutation to documents, checklist items, or expected items in a period
   * invalidates active package approvals for new exports, while preserving the immutable snapshot items.
   */
  private invalidateApprovedPackagesForPeriod(
    officeId: string,
    clientId: string,
    periodId: string,
    reason: string
  ): void {
    const nowIso = new Date().toISOString();
    for (const pkg of this.packages) {
      if (
        pkg.officeId === officeId &&
        pkg.clientId === clientId &&
        pkg.periodId === periodId &&
        pkg.status === 'approved'
      ) {
        pkg.status = 'invalidated_by_change';
        pkg.invalidationReason = reason;

        for (const app of this.approvals) {
          if (app.packageId === pkg.id && app.status === 'active') {
            app.status = 'invalidated';
            app.invalidatedReason = reason;
            app.invalidatedAt = nowIso;
          }
        }
      }
    }
  }

  // Document Operations
  public async getDocuments(scope: TenantScope): Promise<DocumentRecord[]> {
    return this.documents.filter((doc) => {
      if (doc.officeId !== scope.officeId) return false;
      if (scope.clientId && doc.clientId !== scope.clientId) return false;
      return true;
    });
  }

  public async getDocumentById(
    scope: TenantScope,
    documentId: string
  ): Promise<DocumentRecord | null> {
    const docs = await this.getDocuments(scope);
    return docs.find((d) => d.id === documentId) ?? null;
  }

  public async addDocument(
    scope: TenantScope,
    doc: Omit<DocumentRecord, 'officeId' | 'clientId' | 'revisionNumber'> & { revisionNumber?: number }
  ): Promise<DocumentRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to create a document');
    }
    const newDoc: DocumentRecord = {
      ...doc,
      officeId: scope.officeId,
      clientId: scope.clientId,
      revisionNumber: doc.revisionNumber ?? 1,
      fieldStatusSummary: doc.fieldStatusSummary || 'proposed',
    };
    this.documents.push(newDoc);
    this.invalidateApprovedPackagesForPeriod(
      scope.officeId,
      scope.clientId,
      newDoc.periodId,
      `มีเอกสารใหม่ (${newDoc.id}) เพิ่มเข้ามาในงวดหลังการอนุมัติ`
    );
    return newDoc;
  }

  public async updateDocumentFields(
    scope: TenantScope,
    documentId: string,
    fields: Partial<DocumentRecord>,
    expectedRevision?: number,
    actorUserId = 'user_reviewer'
  ): Promise<DocumentRecord> {
    const doc = await this.getDocumentById(scope, documentId);
    if (!doc) {
      throw new Error('Document not found or access denied');
    }

    if (expectedRevision !== undefined) {
      validateDocumentRevision(doc.revisionNumber, expectedRevision);
    }

    const nextRevision = doc.revisionNumber + 1;
    // T-24: tenant scope, identity and revision are never writable through field updates
    const {
      id: _id,
      officeId: _officeId,
      clientId: _clientId,
      revisionNumber: _revisionNumber,
      ...safeFields
    } = fields;
    Object.assign(doc, safeFields, {
      revisionNumber: nextRevision,
      fieldStatusSummary: 'confirmed',
    });

    this.revisions.push({
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: doc.clientId,
      documentId: doc.id,
      revisionNumber: nextRevision,
      actorUserId,
      changesJson: fields,
      createdAt: new Date().toISOString(),
    });

    this.invalidateApprovedPackagesForPeriod(
      doc.officeId,
      doc.clientId,
      doc.periodId,
      `เอกสาร ${doc.id} ถูกแก้ไขเป็น revision ${nextRevision} หลังการอนุมัติ`
    );

    return doc;
  }

  // Relations & Duplicate Candidates
  public async getDocumentRelations(scope: TenantScope, documentId: string): Promise<DocumentRelationRecord[]> {
    return this.relations.filter(
      (r) =>
        r.officeId === scope.officeId &&
        (!scope.clientId || r.clientId === scope.clientId) &&
        (r.documentId === documentId || r.targetDocumentId === documentId)
    );
  }

  public async createDocumentRelation(
    scope: TenantScope,
    documentId: string,
    targetDocumentId: string,
    relationType: RelationType,
    confirmedByUserId = 'user_reviewer'
  ): Promise<DocumentRelationRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope is required to create document relations');
    }
    const record: DocumentRelationRecord = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      documentId,
      targetDocumentId,
      relationType,
      confirmedByUserId,
      createdAt: new Date().toISOString(),
    };
    this.relations.push(record);
    return record;
  }

  public async findHashDuplicates(scope: TenantScope, fileHash: string): Promise<DocumentRecord[]> {
    const docs = await this.getDocuments(scope);
    return docs.filter((d) => d.fileHash === fileHash);
  }

  public async findSemanticDuplicateCandidates(
    scope: TenantScope,
    documentId: string
  ): Promise<Array<{ candidate: CandidateDocumentSummary; score: number; matchReasons: string[] }>> {
    const docs = await this.getDocuments(scope);
    const targetDoc = docs.find((d) => d.id === documentId);
    if (!targetDoc) return [];

    const summaries: CandidateDocumentSummary[] = docs.map((d) => ({
      id: d.id,
      documentNumber: d.documentNumber,
      sellerTaxId: d.sellerTaxId,
      documentDate: d.documentDate,
      grandTotal: d.grandTotal,
      currency: d.currency,
    }));

    return detectSemanticDuplicates(targetDoc, summaries);
  }

  // ==========================================
  // Phase S6 Expected Items, Matches & Missing Requests
  // ==========================================

  public async addExpectedItem(
    scope: TenantScope,
    item: Omit<ExpectedItemRecord, 'id' | 'officeId' | 'clientId' | 'createdAt'>
  ): Promise<ExpectedItemRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to create an expected item');
    }
    const record: ExpectedItemRecord = {
      ...item,
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      createdAt: new Date().toISOString(),
    };
    this.expectedItems.push(record);
    this.bumpChecklistRevision(
      scope.officeId,
      scope.clientId,
      record.periodId,
      `เพิ่มรายการคาดหวังใหม่ (${record.title}) หลังการอนุมัติแพ็กเกจ`
    );
    return record;
  }

  public async getExpectedItems(scope: TenantScope, periodId: string): Promise<ExpectedItemRecord[]> {
    return this.expectedItems.filter(
      (e) =>
        e.officeId === scope.officeId &&
        (!scope.clientId || e.clientId === scope.clientId) &&
        e.periodId === periodId
    );
  }

  public async matchDocumentToExpectedItem(
    scope: TenantScope,
    expectedItemId: string,
    documentId: string,
    confirmedByUserId = 'user_reviewer'
  ): Promise<ExpectedMatchRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope is required for expected item matching');
    }

    const item = this.expectedItems.find(
      (e) => e.id === expectedItemId && e.officeId === scope.officeId && e.clientId === scope.clientId
    );
    if (!item) {
      throw new Error('Expected item not found in this tenant scope');
    }

    const doc = await this.getDocumentById(scope, documentId);
    if (!doc) {
      throw new Error('Target document not found in this tenant scope');
    }

    const match: ExpectedMatchRecord = {
      id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      expectedItemId,
      documentId,
      confirmedByUserId,
      createdAt: new Date().toISOString(),
    };
    this.expectedMatches.push(match);
    this.bumpChecklistRevision(
      scope.officeId,
      scope.clientId,
      item.periodId,
      `ผูกเอกสาร ${documentId} เข้ากับรายการคาดหวัง ${expectedItemId} หลังการอนุมัติแพ็กเกจ`
    );
    return match;
  }

  public async getExpectedMatches(scope: TenantScope, periodId: string): Promise<ExpectedMatchRecord[]> {
    const items = await this.getExpectedItems(scope, periodId);
    const itemIds = new Set(items.map((i) => i.id));
    return this.expectedMatches.filter((m) => itemIds.has(m.expectedItemId));
  }

  public async getPeriodReadiness(
    scope: TenantScope,
    periodId: string,
    exceptionsAcknowledged = false
  ): Promise<PeriodReadinessResult> {
    const items = await this.getExpectedItems(scope, periodId);
    const matches = await this.getExpectedMatches(scope, periodId);
    const docs = await this.getDocuments(scope);
    const reviewedDocCount = docs.filter(
      (d) => d.periodId === periodId && (d.status === 'reviewed' || d.status === 'approved')
    ).length;

    return computePeriodReadiness(items, matches, reviewedDocCount, exceptionsAcknowledged);
  }

  public async createMissingRequest(
    scope: TenantScope,
    req: Omit<MissingRequestRecord, 'id' | 'officeId' | 'clientId' | 'status' | 'createdAt'>
  ): Promise<MissingRequestRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope is required to create a missing document request');
    }
    const record: MissingRequestRecord = {
      ...req,
      id: `mreq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      status: 'draft',
      createdAt: new Date().toISOString(),
    };
    this.missingRequests.push(record);
    return record;
  }

  /**
   * Lists missing requests.
   * Invariant DR-604: If actorType === 'client_user', hides 'draft' requests and strips 'internalNote'.
   */
  public async getMissingRequests(
    scope: TenantScope,
    periodId?: string,
    actorType: 'office_staff' | 'client_user' = 'office_staff'
  ): Promise<MissingRequestRecord[]> {
    const filtered = this.missingRequests.filter((r) => {
      if (r.officeId !== scope.officeId) return false;
      if (scope.clientId && r.clientId !== scope.clientId) return false;
      if (periodId && r.periodId !== periodId) return false;
      if (actorType === 'client_user' && r.status === 'draft') return false;
      return true;
    });

    if (actorType === 'client_user') {
      return filtered.map(({ internalNote, ...rest }) => rest);
    }

    return filtered;
  }

  public async publishMissingRequest(
    scope: TenantScope,
    requestId: string
  ): Promise<MissingRequestRecord> {
    const req = this.missingRequests.find(
      (r) => r.id === requestId && r.officeId === scope.officeId && (!scope.clientId || r.clientId === scope.clientId)
    );
    if (!req) {
      throw new Error('Missing request not found or access denied');
    }
    req.status = transitionMissingRequestStatus(req.status, 'publish', 'office_staff');
    return req;
  }

  public async submitClientResponse(
    scope: TenantScope,
    requestId: string,
    payload: {
      responderUserId: string;
      responseType: 'upload_file' | 'no_transaction_explanation';
      explanationText?: string;
      uploadedDocumentId?: string;
    }
  ): Promise<{ request: MissingRequestRecord; response: RequestResponseRecord }> {
    const req = this.missingRequests.find(
      (r) => r.id === requestId && r.officeId === scope.officeId && r.clientId === scope.clientId
    );
    if (!req) {
      throw new Error('Missing request not found in client scope');
    }

    // T-23 Invariant: Client response transitions to 'responded', NEVER 'resolved'
    req.status = transitionMissingRequestStatus(req.status, 'client_respond', 'client_user');

    const response: RequestResponseRecord = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: req.officeId,
      clientId: req.clientId,
      requestId: req.id,
      responderUserId: payload.responderUserId,
      responseType: payload.responseType,
      explanationText: payload.explanationText,
      uploadedDocumentId: payload.uploadedDocumentId,
      createdAt: new Date().toISOString(),
    };
    this.requestResponses.push(response);

    return { request: req, response };
  }

  public async resolveMissingRequestByStaff(
    scope: TenantScope,
    requestId: string,
    staffUserId: string,
    resolutionNote: string,
    markExpectedItemNotApplicable = false
  ): Promise<MissingRequestRecord> {
    const req = this.missingRequests.find(
      (r) => r.id === requestId && r.officeId === scope.officeId && (!scope.clientId || r.clientId === scope.clientId)
    );
    if (!req) {
      throw new Error('Missing request not found or access denied');
    }

    req.status = transitionMissingRequestStatus(req.status, 'staff_resolve', 'office_staff');
    req.resolutionNote = resolutionNote;
    req.resolvedByUserId = staffUserId;

    if (markExpectedItemNotApplicable && req.expectedItemId) {
      const expItem = this.expectedItems.find((e) => e.id === req.expectedItemId);
      if (expItem) {
        expItem.requirementStatus = 'not_applicable';
        expItem.resolutionNote = resolutionNote;
      }
    }

    this.bumpChecklistRevision(
      req.officeId,
      req.clientId,
      req.periodId,
      `เจ้าหน้าที่ปิดรายการขอเอกสารเพิ่ม (${req.id}) หลังการอนุมัติแพ็กเกจ`
    );

    return req;
  }

  // ==========================================
  // Phase S7 Package Snapshots, Approvals, Exports & Usage Ledger (DR-701 to DR-706)
  // ==========================================

  private buildSnapshotItemsForPeriod(
    officeId: string,
    clientId: string,
    periodId: string
  ): PackageItemSnapshot[] {
    const periodDocs = this.documents.filter(
      (d) =>
        d.officeId === officeId &&
        d.clientId === clientId &&
        d.periodId === periodId &&
        (d.status === 'reviewed' || d.status === 'approved' || d.status === 'excluded')
    );

    return periodDocs.map((doc) => {
      const outgoingRelations = this.relations.filter(
        (r) =>
          r.officeId === officeId &&
          r.clientId === clientId &&
          r.documentId === doc.id
      );
      const countingRole = determineCountingRole(doc.status, outgoingRelations);
      const pageRange = doc.pageRange ?? '1-1';
      const sourceHash = doc.sourceHash ?? doc.fileHash ?? `sha256_src_${doc.id}`;
      const derivedStoragePath =
        doc.derivedStoragePath ??
        `derived/${officeId}/${clientId}/${doc.id}_p${pageRange}_rev${doc.revisionNumber}.pdf`;
      const derivedFileHash = doc.derivedFileHash ?? `sha256_drv_${doc.id}_r${doc.revisionNumber}`;

      // Deep-clone fields so the snapshot is strictly immutable even if the live DocumentRecord is mutated later (T-21)
      return {
        documentId: String(doc.id),
        documentRevision: Number(doc.revisionNumber),
        documentNumber: String(doc.documentNumber),
        documentDate: doc.documentDate ? String(doc.documentDate) : undefined,
        sellerName: doc.sellerName ? String(doc.sellerName) : undefined,
        sellerTaxId: doc.sellerTaxId ? String(doc.sellerTaxId) : undefined,
        grandTotal: doc.grandTotal ? String(doc.grandTotal) : undefined,
        statedTax: doc.statedTax ? String(doc.statedTax) : undefined,
        currency: String(doc.currency ?? 'THB'),
        documentRoles: doc.documentRoles ? [...doc.documentRoles] : ['tax_invoice'],
        countingRole,
        sourceAssetId: doc.sourceAssetId ?? `asset_${doc.id}`,
        sourceHash,
        pageRange,
        derivedStoragePath,
        derivedFileHash,
        hasMixedClientFlag: Boolean(doc.hasMixedClientFlag),
      };
    });
  }

  public async createPackageSnapshot(
    scope: TenantScope,
    params: {
      periodId: string;
      packageMode: PackageMode;
      exceptionsAcknowledged?: boolean;
      createdByUserId?: string;
    }
  ): Promise<PackageRecord> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to create a package snapshot');
    }

    const exceptionsAcknowledged = Boolean(params.exceptionsAcknowledged);
    const readiness = await this.getPeriodReadiness(
      scope,
      params.periodId,
      exceptionsAcknowledged
    );
    const items = this.buildSnapshotItemsForPeriod(
      scope.officeId,
      scope.clientId,
      params.periodId
    );

    const eligibility = validatePackageSnapshotEligibility({
      packageMode: params.packageMode,
      readiness,
      items,
      exceptionsAcknowledged,
    });

    if (!eligibility.eligible) {
      throw new Error(`Package snapshot validation failed: ${eligibility.reasons.join('; ')}`);
    }

    const existingForPeriod = this.packages.filter(
      (p) =>
        p.officeId === scope.officeId &&
        p.clientId === scope.clientId &&
        p.periodId === params.periodId
    );
    const nextPackageRevision =
      existingForPeriod.reduce((max, p) => Math.max(max, p.packageRevision), 0) + 1;

    // Mark previous draft/approved packages in this period as superseded when a newer revision is created
    for (const prev of existingForPeriod) {
      if (prev.status === 'draft') {
        prev.status = 'superseded';
      }
    }

    const pkg: PackageRecord = {
      id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      periodId: params.periodId,
      packageRevision: nextPackageRevision,
      packageMode: params.packageMode,
      coverageBasis: readiness.coverageBasis,
      status: 'draft',
      checklistRevisionSnapshot: this.getChecklistRevision(
        scope.officeId,
        scope.clientId,
        params.periodId
      ),
      items,
      totalsByCurrency: aggregatePackageTotalsByCurrency(items),
      exceptionsAcknowledged,
      createdByUserId: params.createdByUserId ?? 'user_reviewer',
      createdAt: new Date().toISOString(),
    };

    this.packages.push(pkg);
    return pkg;
  }

  public async approvePackage(
    scope: TenantScope,
    packageId: string,
    params: {
      approvedByUserId: string;
      approvalNote?: string;
      exceptionsAcknowledged?: boolean;
    }
  ): Promise<{ packageRecord: PackageRecord; approval: ApprovalRecord }> {
    const pkg = await this.getPackageById(scope, packageId);
    if (!pkg) {
      throw new Error('Package not found or access denied');
    }

    if (pkg.status === 'invalidated_by_change') {
      throw new Error(
        `ไม่สามารถอนุมัติแพ็กเกจที่ข้อมูลต้นทางเปลี่ยนไปแล้วได้ (${pkg.invalidationReason ?? 'invalidated'}) กรุณาสร้าง Package Revision ใหม่`
      );
    }

    const exceptionsAcknowledged =
      params.exceptionsAcknowledged ?? pkg.exceptionsAcknowledged;
    const readiness = await this.getPeriodReadiness(
      { officeId: pkg.officeId, clientId: pkg.clientId },
      pkg.periodId,
      exceptionsAcknowledged
    );

    const eligibility = validatePackageSnapshotEligibility({
      packageMode: pkg.packageMode,
      readiness,
      items: pkg.items,
      exceptionsAcknowledged,
    });

    if (!eligibility.eligible) {
      throw new Error(`Package approval rejected: ${eligibility.reasons.join('; ')}`);
    }

    pkg.status = 'approved';
    pkg.exceptionsAcknowledged = exceptionsAcknowledged;

    const approval: ApprovalRecord = {
      id: `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: pkg.officeId,
      clientId: pkg.clientId,
      packageId: pkg.id,
      approvedByUserId: params.approvedByUserId,
      approvalNote: params.approvalNote,
      exceptionsAcknowledged,
      status: 'active',
      approvedAt: new Date().toISOString(),
    };

    this.approvals.push(approval);
    return { packageRecord: pkg, approval };
  }

  public async getPackageById(
    scope: TenantScope,
    packageId: string
  ): Promise<PackageRecord | null> {
    const pkg = this.packages.find(
      (p) =>
        p.id === packageId &&
        p.officeId === scope.officeId &&
        (!scope.clientId || p.clientId === scope.clientId)
    );
    if (!pkg) return null;

    // Re-verify live validity against T-21 invariant
    if (pkg.status === 'approved') {
      const periodDocs = this.documents.filter(
        (d) =>
          d.officeId === pkg.officeId &&
          d.clientId === pkg.clientId &&
          d.periodId === pkg.periodId
      );
      const validity = evaluatePackageApprovalValidity({
        currentPackageStatus: pkg.status,
        snapshotItems: pkg.items,
        currentDocuments: periodDocs,
        checklistRevisionSnapshot: pkg.checklistRevisionSnapshot,
        currentChecklistRevision: this.getChecklistRevision(
          pkg.officeId,
          pkg.clientId,
          pkg.periodId
        ),
      });

      if (!validity.isValidForExport && validity.effectiveStatus === 'invalidated_by_change') {
        this.invalidateApprovedPackagesForPeriod(
          pkg.officeId,
          pkg.clientId,
          pkg.periodId,
          validity.invalidationReason ?? 'ข้อมูลถูกแก้ไขหลังอนุมัติ'
        );
      }
    }

    return pkg;
  }

  public async getPackagesByPeriod(
    scope: TenantScope,
    periodId: string
  ): Promise<PackageRecord[]> {
    const matching = this.packages.filter(
      (p) =>
        p.officeId === scope.officeId &&
        (!scope.clientId || p.clientId === scope.clientId) &&
        p.periodId === periodId
    );
    const results: PackageRecord[] = [];
    for (const p of matching) {
      const checked = await this.getPackageById(scope, p.id);
      if (checked) results.push(checked);
    }
    return results;
  }

  public async getPackageApprovals(
    scope: TenantScope,
    packageId: string
  ): Promise<ApprovalRecord[]> {
    return this.approvals.filter(
      (a) =>
        a.packageId === packageId &&
        a.officeId === scope.officeId &&
        (!scope.clientId || a.clientId === scope.clientId)
    );
  }

  public async createExportJob(
    scope: TenantScope,
    packageId: string,
    requestedByUserId: string,
    options?: {
      simulateStatus?: ExportStatus;
      ttlSeconds?: number;
    }
  ): Promise<ExportJobRecord> {
    const pkg = await this.getPackageById(scope, packageId);
    if (!pkg) {
      throw new Error('Package not found or access denied');
    }

    // T-21 Guard: Cannot create a new export from an unapproved or invalidated package
    if (pkg.status !== 'approved') {
      throw new Error(
        `ไม่สามารถสั่ง Export แพ็กเกจที่มีสถานะ '${pkg.status}' ได้ (${pkg.invalidationReason ?? 'ต้องได้รับการอนุมัติก่อน'})`
      );
    }

    for (const item of pkg.items) {
      if (this.tombstonedAssets.has(item.sourceAssetId)) {
        throw new Error(
          `Export blocked: source asset ${item.sourceAssetId} was deleted (tombstoned)`
        );
      }
    }

    const ttlSeconds = options?.ttlSeconds ?? 3600;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const targetStatus: ExportStatus = options?.simulateStatus ?? 'completed';

    if (targetStatus !== 'completed') {
      const incompleteJob: ExportJobRecord = {
        id: `expjob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        officeId: pkg.officeId,
        clientId: pkg.clientId,
        packageId: pkg.id,
        requestedByUserId,
        status: targetStatus,
        storageBucket: 'exports',
        errorMessage:
          targetStatus === 'failed' ? 'Simulated export worker failure' : undefined,
        expiresAt,
        createdAt: now.toISOString(),
      };
      this.exportJobs.push(incompleteJob);
      return incompleteJob;
    }

    const bundle = await generateRealExportArchive({
      packageId: pkg.id,
      packageRevision: pkg.packageRevision,
      officeId: pkg.officeId,
      clientId: pkg.clientId,
      periodId: pkg.periodId,
      packageMode: pkg.packageMode,
      coverageBasis: pkg.coverageBasis,
      items: pkg.items,
      generatedAt: now.toISOString(),
    });

    const job: ExportJobRecord = {
      id: `expjob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: pkg.officeId,
      clientId: pkg.clientId,
      packageId: pkg.id,
      requestedByUserId,
      status: 'completed',
      storageBucket: 'exports',
      storagePath: bundle.storagePath,
      sha256Checksum: bundle.sha256Checksum,
      fileSizeBytes: bundle.fileSizeBytes,
      manifest: bundle.manifest,
      archiveBundle: bundle,
      xlsxBuffer: bundle.xlsxBuffer,
      zipBuffer: bundle.zipBuffer,
      expiresAt,
      createdAt: now.toISOString(),
      completedAt: now.toISOString(),
    };

    this.exportJobs.push(job);

    await this.recordUsageLedgerEntry(
      { officeId: pkg.officeId, clientId: pkg.clientId },
      {
        periodId: pkg.periodId,
        metricType: 'export_runs',
        rawUnits: 1,
        billableUnits: 1,
        isSystemFaultReprocess: false,
        providerCostSatang: 0,
        idempotencyKey: `export_run_${job.id}`,
      }
    );

    return job;
  }

  public async getExportJobById(
    scope: TenantScope,
    exportId: string
  ): Promise<ExportJobRecord | null> {
    return (
      this.exportJobs.find(
        (j) =>
          j.id === exportId &&
          j.officeId === scope.officeId &&
          (!scope.clientId || j.clientId === scope.clientId)
      ) ?? null
    );
  }

  public setMembershipStatus(officeId: string, userId: string, isActive: boolean): void {
    const key = `${officeId}::${userId}`;
    if (isActive) {
      this.revokedMemberships.delete(key);
    } else {
      this.revokedMemberships.add(key);
    }
  }

  public isMembershipActive(officeId: string, userId: string): boolean {
    return !this.revokedMemberships.has(`${officeId}::${userId}`);
  }

  public async requestExportDownload(params: {
    requesterScope: TenantScope;
    requesterUserId: string;
    exportId: string;
    expectedChecksum?: string;
    now?: Date;
  }): Promise<{
    authorized: boolean;
    httpStatus: 200 | 403 | 404 | 409 | 410 | 422;
    reason?: string;
    shortLivedDownloadToken?: string;
    exportJob?: ExportJobRecord;
  }> {
    const job = this.exportJobs.find((j) => j.id === params.exportId);
    if (!job) {
      return {
        authorized: false,
        httpStatus: 404,
        reason: 'ไม่พบรายการส่งออกที่ระบุ',
      };
    }

    const activeMember = this.isMembershipActive(
      params.requesterScope.officeId,
      params.requesterUserId
    );

    const verification = verifyExportDownloadAccess({
      exportJob: job,
      requesterScope: params.requesterScope,
      isMembershipActive: activeMember,
      expectedChecksum: params.expectedChecksum,
      now: params.now,
    });

    if (!verification.authorized) {
      return verification;
    }

    return {
      ...verification,
      exportJob: job,
    };
  }

  public async downloadExportBinary(params: {
    requesterScope: TenantScope;
    requesterUserId: string;
    exportId: string;
    format: 'zip' | 'xlsx';
    expectedChecksum?: string;
    now?: Date;
  }): Promise<{
    authorized: boolean;
    httpStatus: 200 | 403 | 404 | 409 | 410 | 422;
    reason?: string;
    buffer?: Buffer;
    contentType?: string;
    filename?: string;
    sha256Checksum?: string;
  }> {
    const authResult = await this.requestExportDownload(params);
    if (!authResult.authorized || !authResult.exportJob) {
      return {
        authorized: false,
        httpStatus: authResult.httpStatus,
        reason: authResult.reason,
      };
    }

    const job = authResult.exportJob;
    if (params.format === 'xlsx') {
      if (!job.xlsxBuffer) {
        return {
          authorized: false,
          httpStatus: 409,
          reason: 'XLSX buffer is not available for this export job',
        };
      }
      return {
        authorized: true,
        httpStatus: 200,
        buffer: job.xlsxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `docready_${job.packageId}.xlsx`,
        sha256Checksum: job.sha256Checksum,
      };
    }

    if (!job.zipBuffer) {
      return {
        authorized: false,
        httpStatus: 409,
        reason: 'ZIP buffer is not available for this export job',
      };
    }

    return {
      authorized: true,
      httpStatus: 200,
      buffer: job.zipBuffer,
      contentType: 'application/zip',
      filename: `docready_${job.packageId}.zip`,
      sha256Checksum: job.sha256Checksum,
    };
  }

  public async recordUsageLedgerEntry(
    scope: TenantScope,
    entry: {
      periodId?: string;
      metricType: UsageMetricType;
      rawUnits: number;
      billableUnits?: number;
      isSystemFaultReprocess?: boolean;
      providerCostSatang: number;
      idempotencyKey: string;
    }
  ): Promise<UsageLedgerEntry> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to record usage ledger entry');
    }

    const existing = this.usageLedger.find(
      (u) => u.officeId === scope.officeId && u.idempotencyKey === entry.idempotencyKey
    );
    if (existing) {
      return existing;
    }

    const isSystemFault = Boolean(entry.isSystemFaultReprocess);
    const record: UsageLedgerEntry = {
      id: `usage_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      officeId: scope.officeId,
      clientId: scope.clientId,
      periodId: entry.periodId,
      metricType: entry.metricType,
      rawUnits: entry.rawUnits,
      // DR-705 Invariant: System-fault reprocesses never bill the client's quota
      billableUnits: isSystemFault ? 0 : (entry.billableUnits ?? entry.rawUnits),
      isSystemFaultReprocess: isSystemFault,
      providerCostSatang: entry.providerCostSatang,
      idempotencyKey: entry.idempotencyKey,
      createdAt: new Date().toISOString(),
    };

    this.usageLedger.push(record);
    return record;
  }

  public async getUsageSummary(scope: TenantScope): Promise<ClientUsageSummary[]> {
    const filtered = this.usageLedger.filter(
      (u) =>
        u.officeId === scope.officeId &&
        (!scope.clientId || u.clientId === scope.clientId)
    );
    return summarizeUsageLedger(filtered);
  }

  public async getOperationalMetricsReport(
    scope: TenantScope
  ): Promise<{
    operations: OperationalMetricsSummary;
    usageByClient: ClientUsageSummary[];
  }> {
    const docs = await this.getDocuments(scope);
    const requests = await this.getMissingRequests(scope, undefined, 'office_staff');
    const pkgs = this.packages.filter(
      (p) =>
        p.officeId === scope.officeId &&
        (!scope.clientId || p.clientId === scope.clientId)
    );
    const usageByClient = await this.getUsageSummary(scope);

    return {
      operations: computeOperationalMetrics({
        officeId: scope.officeId,
        documents: docs,
        missingRequests: requests,
        packages: pkgs,
      }),
      usageByClient,
    };
  }

  // ==========================================
  // Phase S8 Hardening: idempotent upload completion, tombstones & retention (DR-803)
  // ==========================================

  private assets = new Map<string, AssetRecord>();
  private tombstonedAssets = new Set<string>();
  private legalHoldAssets = new Set<string>();

  /**
   * T-03 & T-06: Completes an upload using ONLY the server-reserved session scope/storage key.
   * Client-supplied clientId/periodId/storageKey are ignored. Repeated calls (e.g. retry after a
   * DB failure) return the same asset instead of creating a duplicate.
   */
  public async completeUploadSession(
    scope: TenantScope,
    sessionId: string,
    claimed: { fileHash: string; clientId?: string; periodId?: string; storageKey?: string }
  ): Promise<{ asset: AssetRecord; alreadyCompleted: boolean }> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (
      !session ||
      session.officeId !== scope.officeId ||
      (scope.clientId && session.clientId !== scope.clientId)
    ) {
      throw new Error('Upload session not found or access denied');
    }

    const existing = this.assets.get(`asset_${session.id}`);
    if (existing) {
      return { asset: existing, alreadyCompleted: true };
    }

    const asset: AssetRecord = {
      id: `asset_${session.id}`,
      officeId: session.officeId,
      clientId: session.clientId,
      periodId: session.periodId,
      storageKey: session.storageKey,
      fileHash: claimed.fileHash,
      sessionId: session.id,
      version: 1,
    };
    this.assets.set(asset.id, asset);
    session.status = 'completed';
    return { asset, alreadyCompleted: false };
  }

  public async getAsset(scope: TenantScope, assetId: string): Promise<AssetRecord | null> {
    const asset = this.assets.get(assetId);
    if (!asset || asset.officeId !== scope.officeId) return null;
    if (scope.clientId && asset.clientId !== scope.clientId) return null;
    return asset;
  }

  public async setLegalHold(scope: TenantScope, assetId: string, hold: boolean): Promise<void> {
    const asset = await this.getAsset(scope, assetId);
    if (!asset) throw new Error('Asset not found or access denied');
    if (hold) this.legalHoldAssets.add(assetId);
    else this.legalHoldAssets.delete(assetId);
  }

  /** Deletes an asset by tombstoning it. Legal hold blocks deletion. */
  public async deleteAsset(scope: TenantScope, assetId: string): Promise<void> {
    const asset = await this.getAsset(scope, assetId);
    if (!asset) throw new Error('Asset not found or access denied');
    const decision = evaluateRetentionAction({
      action: 'delete',
      tombstoned: this.tombstonedAssets.has(assetId),
      legalHold: this.legalHoldAssets.has(assetId),
    });
    if (decision !== 'allow') {
      throw new Error(`Asset deletion blocked: ${decision}`);
    }
    this.tombstonedAssets.add(assetId);
    // Drop queued work referencing the deleted asset so it cannot replay later
    for (const ev of this.outbox) {
      if (ev.status === 'pending' && ev.payload.assetId === assetId) {
        ev.status = 'failed';
      }
    }
  }

  /** T-29: Guard used before OCR submit, export, or restore of an asset. */
  public async assertAssetUsable(
    scope: TenantScope,
    assetId: string,
    action: 'ocr' | 'export' | 'restore'
  ): Promise<void> {
    const asset = await this.getAsset(scope, assetId);
    if (!asset) throw new Error('Asset not found or access denied');
    const decision = evaluateRetentionAction({
      action,
      tombstoned: this.tombstonedAssets.has(assetId),
      legalHold: this.legalHoldAssets.has(assetId),
    });
    if (decision !== 'allow') {
      throw new Error(`Asset action '${action}' blocked: ${decision}`);
    }
  }

  // ==========================================
  // Phase S9 Pilot tracking (DR-901 to DR-906): tenant-scoped, identifiers only
  // ==========================================

  private pilotEvents: PilotEvent[] = [];
  private reviewSampleResults: Array<ReviewSampleResult & { officeId: string; clientId: string }> = [];
  private wtpResponses: Array<WillingnessToPaySurvey & { officeId: string; clientId?: string }> = [];

  public async recordPilotEvent(scope: TenantScope, event: PilotEvent): Promise<PilotEvent> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to record a pilot event');
    }
    // Server scope wins over any scope inside the payload
    const record: PilotEvent = { ...event, officeId: scope.officeId, clientId: scope.clientId };
    this.pilotEvents.push(record);
    return record;
  }

  public async getPilotMetrics(scope: TenantScope, minDocuments = 100): Promise<PilotMetricsResult> {
    const events = this.pilotEvents.filter(
      (e) => e.officeId === scope.officeId && (!scope.clientId || e.clientId === scope.clientId)
    );
    return computePilotMetrics({ events, minDocuments });
  }

  public async recordReviewSampleResult(
    scope: TenantScope,
    result: ReviewSampleResult
  ): Promise<void> {
    if (!scope.clientId) {
      throw new Error('Client Scope (clientId) is required to record a review sample result');
    }
    this.reviewSampleResults.push({ ...result, officeId: scope.officeId, clientId: scope.clientId });
  }

  /** Evaluates the auto-classification gate from recorded review-sample outcomes (DR-903/DR-904). */
  public async evaluateAutoClassificationGateForScope(
    scope: TenantScope
  ): Promise<AutoClassificationGateResult> {
    const mine = this.reviewSampleResults.filter(
      (r) => r.officeId === scope.officeId && (!scope.clientId || r.clientId === scope.clientId)
    );
    const byCategory = new Map<string, { correct: number; total: number }>();
    for (const r of mine) {
      const s = byCategory.get(r.category) ?? { correct: 0, total: 0 };
      s.total += 1;
      if (r.outcome === 'correct') s.correct += 1;
      byCategory.set(r.category, s);
    }
    return evaluateAutoClassificationGate({
      perCategory: Array.from(byCategory.entries()).map(([category, s]) => ({ category, ...s })),
    });
  }

  public async recordWtpResponse(scope: TenantScope, response: WillingnessToPaySurvey): Promise<void> {
    this.wtpResponses.push({ ...response, officeId: scope.officeId, clientId: scope.clientId });
  }

  public async getWtpResponses(scope: TenantScope): Promise<WillingnessToPaySurvey[]> {
    return this.wtpResponses
      .filter((r) => r.officeId === scope.officeId && (!scope.clientId || r.clientId === scope.clientId))
      .map(({ officeId: _o, clientId: _c, ...rest }) => rest);
  }

  // Upload Sessions
  public async createUploadSession(
    session: UploadSessionRecord
  ): Promise<UploadSessionRecord> {
    this.sessions.push(session);
    return session;
  }

  public async getUploadSession(sessionId: string): Promise<UploadSessionRecord | null> {
    return this.sessions.find((s) => s.id === sessionId) ?? null;
  }

  // Page Groupings
  public async updatePageGrouping(
    assetId: string,
    groups: LogicalPageGroup[]
  ): Promise<LogicalPageGroup[]> {
    this.pageGroupings.set(assetId, groups);
    return groups;
  }

  public async getPageGrouping(assetId: string): Promise<LogicalPageGroup[] | null> {
    return this.pageGroupings.get(assetId) ?? null;
  }

  // OCR Runs & Candidates Operations
  public async createOcrRun(run: OcrRunRecord): Promise<OcrRunRecord> {
    this.ocrRuns.push(run);
    return run;
  }

  public async getOcrRunByOperationId(operationId: string): Promise<OcrRunRecord | null> {
    return this.ocrRuns.find((r) => r.operationId === operationId) ?? null;
  }

  public async saveOcrSpans(ocrRunId: string, spans: OcrSpan[]): Promise<void> {
    this.ocrSpansMap.set(ocrRunId, spans);
  }

  public async getOcrSpans(ocrRunId: string): Promise<OcrSpan[]> {
    return this.ocrSpansMap.get(ocrRunId) ?? [];
  }

  public async saveCandidates(documentId: string, candidates: ExtractedCandidate[]): Promise<void> {
    this.candidatesMap.set(documentId, candidates);
  }

  public async getCandidates(documentId: string): Promise<ExtractedCandidate[]> {
    return this.candidatesMap.get(documentId) ?? [];
  }

  // Decision Runs & Token Ledger Operations
  public async createDecisionRun(run: DecisionRunResult): Promise<DecisionRunResult> {
    this.decisionRuns.push(run);
    return run;
  }

  public async addTokenLedgerRecord(record: TokenLedgerRecord): Promise<TokenLedgerRecord> {
    this.tokenLedger.push(record);
    return record;
  }

  public async getTokenLedgerRecords(scope: TenantScope): Promise<TokenLedgerRecord[]> {
    return this.tokenLedger.filter((t) => t.officeId === scope.officeId && (!scope.clientId || t.clientId === scope.clientId));
  }

  // Outbox Events
  public async addOutboxEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<OutboxEventRecord> {
    const event: OutboxEventRecord = {
      id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType,
      payload,
      status: 'pending',
    };
    this.outbox.push(event);
    return event;
  }

  public async getPendingOutboxEvents(): Promise<OutboxEventRecord[]> {
    return this.outbox.filter((e) => e.status === 'pending');
  }

  public async markOutboxEventCompleted(id: string): Promise<void> {
    const event = this.outbox.find((e) => e.id === id);
    if (event) {
      event.status = 'completed';
    }
  }
}
