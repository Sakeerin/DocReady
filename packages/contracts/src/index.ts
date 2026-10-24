import { z } from 'zod';

// ==========================================
// Tenant Scope & Membership Schemas
// ==========================================

export const OfficeRoleSchema = z.enum([
  'office_owner',
  'office_manager',
  'preparer',
  'read_only_reviewer',
]);
export type OfficeRole = z.infer<typeof OfficeRoleSchema>;

export const ClientRoleSchema = z.enum([
  'client_admin',
  'client_uploader',
]);
export type ClientRole = z.infer<typeof ClientRoleSchema>;

export const TenantScopeSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
});
export type TenantScope = z.infer<typeof TenantScopeSchema>;

// ==========================================
// Document Field & Role Schemas
// ==========================================

export const DocumentRoleSchema = z.enum([
  'invoice',
  'receipt',
  'tax_invoice',
  'payment_evidence',
  'other',
]);
export type DocumentRole = z.infer<typeof DocumentRoleSchema>;

export const FieldStatusSchema = z.enum([
  'missing',
  'proposed',
  'confirmed',
  'conflicting',
  'unreadable',
  'not_applicable',
]);
export type FieldStatus = z.infer<typeof FieldStatusSchema>;

export const QualityFlagSchema = z.enum([
  'blurred',
  'cropped',
  'missing_pages',
  'low_ocr',
  'ambiguous',
]);
export type QualityFlag = z.infer<typeof QualityFlagSchema>;

export const DocumentIdentifierSchema = z.string().min(1);

export const MonetaryAmountSchema = z.object({
  subtotal: z.string().nullable(),
  statedTax: z.string().nullable(),
  grandTotal: z.string(),
  amountPaid: z.string().nullable(),
  currency: z.string().default('THB'),
});
export type MonetaryAmount = z.infer<typeof MonetaryAmountSchema>;

export const ProvenanceEvidenceSchema = z.object({
  assetVersion: z.string(),
  page: z.number().int().positive(),
  ocrRunId: z.string(),
  spanIds: z.array(z.string()),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});
export type ProvenanceEvidence = z.infer<typeof ProvenanceEvidenceSchema>;

// ==========================================
// Phase S2 DTO Schemas
// ==========================================

export const CreateUploadSessionSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodId: z.string().uuid(),
  filename: z.string(),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  fileSize: z.number().max(20 * 1024 * 1024),
});
export type CreateUploadSessionDTO = z.infer<typeof CreateUploadSessionSchema>;

export const CompleteUploadSessionSchema = z.object({
  sessionId: z.string().uuid(),
  storageKey: z.string(),
  fileHash: z.string(),
});
export type CompleteUploadSessionDTO = z.infer<typeof CompleteUploadSessionSchema>;

export const LogicalPageGroupSchema = z.object({
  documentIndex: z.number().int().nonnegative(),
  pageNumbers: z.array(z.number().int().positive()).min(1),
  roles: z.array(DocumentRoleSchema).min(1),
});
export type LogicalPageGroup = z.infer<typeof LogicalPageGroupSchema>;

export const UpdatePageGroupingSchema = z.object({
  assetId: z.string().uuid(),
  groups: z.array(LogicalPageGroupSchema).min(1),
});
export type UpdatePageGroupingDTO = z.infer<typeof UpdatePageGroupingSchema>;

export const UpdateDocumentFieldsSchema = z.object({
  documentNumber: z.string().optional(),
  documentDate: z.string().optional(),
  sellerName: z.string().optional(),
  sellerTaxId: z.string().optional(),
  grandTotal: z.string().optional(),
  currency: z.string().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});
export type UpdateDocumentFieldsDTO = z.infer<typeof UpdateDocumentFieldsSchema>;

// ==========================================
// Phase S3 Multi-Provider OCR DTO Schemas
// ==========================================

export const OcrProviderTypeSchema = z.enum([
  'azure_read',
  'google_vision',
  'vision_llm',
  'mock',
]);
export type OcrProviderType = z.infer<typeof OcrProviderTypeSchema>;

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const OcrSpanSchema = z.object({
  id: z.string(),
  page: z.number().int().positive(),
  text: z.string(),
  confidence: z.number().min(0).max(1),
  boundingBox: BoundingBoxSchema,
});
export type OcrSpan = z.infer<typeof OcrSpanSchema>;

export const NormalizedOcrResultSchema = z.object({
  provider: OcrProviderTypeSchema,
  operationId: z.string(),
  spans: z.array(OcrSpanSchema),
  qualityFlags: z.array(QualityFlagSchema),
});
export type NormalizedOcrResult = z.infer<typeof NormalizedOcrResultSchema>;

export const ExtractedCandidateSchema = z.object({
  fieldName: z.enum([
    'document_number',
    'document_date',
    'seller_name',
    'seller_tax_id',
    'grand_total',
    'stated_tax',
    'subtotal',
  ]),
  rawText: z.string(),
  normalizedValue: z.string(),
  confidence: z.number(),
  spanIds: z.array(z.string()),
  boundingBox: BoundingBoxSchema.optional(),
});
export type ExtractedCandidate = z.infer<typeof ExtractedCandidateSchema>;

export const ReprocessOcrSchema = z.object({
  provider: OcrProviderTypeSchema.optional(),
});
export type ReprocessOcrDTO = z.infer<typeof ReprocessOcrSchema>;

// ==========================================
// Phase S4 Jev & Decision DTO Schemas
// ==========================================

export const DecisionProviderTypeSchema = z.enum([
  'jev_1.13.0',
  'rule_baseline',
  'mock',
]);
export type DecisionProviderType = z.infer<typeof DecisionProviderTypeSchema>;

export const DecisionRunResultSchema = z.object({
  decisionRunId: z.string(),
  modelVersion: z.string(),
  questionType: z.enum(['role_classification', 'candidate_selection', 'party_verification']),
  selectedCandidateId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  inputTokens: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
});
export type DecisionRunResult = z.infer<typeof DecisionRunResultSchema>;

export const EvaluateRulesRequestSchema = z.object({
  provider: DecisionProviderTypeSchema.optional(),
  clientCompanyTaxId: z.string().optional(),
});
export type EvaluateRulesRequestDTO = z.infer<typeof EvaluateRulesRequestSchema>;

// ==========================================
// Phase S5 Relations & Revision DTO Schemas
// ==========================================

export const RelationTypeSchema = z.enum([
  'duplicate_of',
  'supports',
  'replacement',
]);
export type RelationType = z.infer<typeof RelationTypeSchema>;

export const CreateRelationSchema = z.object({
  targetDocumentId: z.string().uuid(),
  relationType: RelationTypeSchema,
});
export type CreateRelationDTO = z.infer<typeof CreateRelationSchema>;

export const ConfirmReviewSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  action: z.enum(['confirm', 'reject', 'exclude']),
  reason: z.string().optional(),
});
export type ConfirmReviewDTO = z.infer<typeof ConfirmReviewSchema>;

// ==========================================
// Phase S6 Checklists & Missing Requests DTO Schemas
// ==========================================

export const ExpectedItemSourceSchema = z.enum([
  'template',
  'manual',
  'csv_import',
]);
export type ExpectedItemSource = z.infer<typeof ExpectedItemSourceSchema>;

export const ExpectedRequirementStatusSchema = z.enum([
  'required',
  'conditional',
  'not_applicable',
]);
export type ExpectedRequirementStatus = z.infer<typeof ExpectedRequirementStatusSchema>;

export const CoverageBasisSchema = z.enum([
  'complete_against_defined_list',
  'received_documents_with_exceptions',
  'received_only',
]);
export type CoverageBasis = z.infer<typeof CoverageBasisSchema>;

export const MissingRequestStatusSchema = z.enum([
  'draft',
  'published',
  'responded',
  'resolved',
]);
export type MissingRequestStatus = z.infer<typeof MissingRequestStatusSchema>;

export const CreateExpectedItemSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodId: z.string().uuid(),
  title: z.string().min(1),
  vendorName: z.string().optional(),
  expectedAmount: z.string().optional(),
  source: ExpectedItemSourceSchema.default('manual'),
  requirementStatus: ExpectedRequirementStatusSchema.default('required'),
});
export type CreateExpectedItemDTO = z.infer<typeof CreateExpectedItemSchema>;

export const ImportExpectedCsvSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodId: z.string().uuid(),
  csvContent: z.string().min(1),
});
export type ImportExpectedCsvDTO = z.infer<typeof ImportExpectedCsvSchema>;

export const MatchExpectedItemSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  documentId: z.string().min(1),
});
export type MatchExpectedItemDTO = z.infer<typeof MatchExpectedItemSchema>;

export const CreateMissingRequestSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodId: z.string().uuid(),
  expectedItemId: z.string().optional(),
  title: z.string().min(1),
  publicMessage: z.string().min(1),
  internalNote: z.string().optional(),
});
export type CreateMissingRequestDTO = z.infer<typeof CreateMissingRequestSchema>;

export const SubmitRequestResponseSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  responseType: z.enum(['upload_file', 'no_transaction_explanation']),
  explanationText: z.string().optional(),
  uploadedDocumentId: z.string().optional(),
});
export type SubmitRequestResponseDTO = z.infer<typeof SubmitRequestResponseSchema>;

export const ResolveMissingRequestSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  resolutionNote: z.string().min(1),
  markExpectedItemNotApplicable: z.boolean().optional(),
});
export type ResolveMissingRequestDTO = z.infer<typeof ResolveMissingRequestSchema>;

// ==========================================
// Phase S7 Package Snapshot, Export & Usage Ledger DTO Schemas
// ==========================================

export const PackageModeSchema = z.enum([
  'complete_against_defined_list',
  'received_documents_with_exceptions',
]);
export type PackageMode = z.infer<typeof PackageModeSchema>;

export const PackageStatusSchema = z.enum([
  'draft',
  'approved',
  'invalidated_by_change',
  'superseded',
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

export const CountingRoleSchema = z.enum([
  'primary_counting',
  'supporting_non_counting',
  'excluded_duplicate',
]);
export type CountingRole = z.infer<typeof CountingRoleSchema>;

export const StringIdentifierSchema = z.string().min(1);
export const DecimalStringSchema = z.string().regex(/^-?\d+(\.\d{1,4})?$/);

export const CurrencyTotalSummarySchema = z.object({
  currency: z.string().min(3).max(3),
  primaryDocumentCount: z.number().int().nonnegative(),
  supportingDocumentCount: z.number().int().nonnegative(),
  grandTotalSum: DecimalStringSchema,
  statedTaxSum: DecimalStringSchema,
});
export type CurrencyTotalSummary = z.infer<typeof CurrencyTotalSummarySchema>;

export const PackageItemSnapshotSchema = z.object({
  documentId: z.string().min(1),
  documentRevision: z.number().int().positive(),
  documentNumber: StringIdentifierSchema,
  documentDate: z.string().optional(),
  sellerName: z.string().optional(),
  sellerTaxId: StringIdentifierSchema.optional(),
  grandTotal: DecimalStringSchema.optional(),
  statedTax: DecimalStringSchema.optional(),
  currency: z.string().default('THB'),
  documentRoles: z.array(z.string()).min(1),
  countingRole: CountingRoleSchema,
  sourceAssetId: z.string().min(1),
  sourceHash: z.string().min(8),
  pageRange: z.string().regex(/^\d+-\d+$/),
  derivedStoragePath: z.string().min(1),
  derivedFileHash: z.string().min(8),
  hasMixedClientFlag: z.boolean().default(false),
});
export type PackageItemSnapshot = z.infer<typeof PackageItemSnapshotSchema>;

export const CreatePackageSnapshotSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodId: z.string().uuid(),
  packageMode: PackageModeSchema,
  exceptionsAcknowledged: z.boolean().default(false),
});
export type CreatePackageSnapshotDTO = z.infer<typeof CreatePackageSnapshotSchema>;

export const ApprovePackageSchema = z.object({
  officeId: z.string().uuid(),
  clientId: z.string().uuid(),
  approvalNote: z.string().optional(),
  exceptionsAcknowledged: z.boolean().default(false),
});
export type ApprovePackageDTO = z.infer<typeof ApprovePackageSchema>;

export const ExportStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);
export type ExportStatus = z.infer<typeof ExportStatusSchema>;

export const ExportManifestEntrySchema = z.object({
  documentId: z.string().min(1),
  documentRevision: z.number().int().positive(),
  sourceHash: z.string().min(8),
  pageRange: z.string().regex(/^\d+-\d+$/),
  derivedArchivePath: z.string().min(1),
  derivedFileHash: z.string().min(8),
  countingRole: CountingRoleSchema,
});
export type ExportManifestEntry = z.infer<typeof ExportManifestEntrySchema>;

export const ExportManifestSchema = z.object({
  packageId: z.string().min(1),
  packageRevision: z.number().int().positive(),
  officeId: z.string().min(1),
  clientId: z.string().min(1),
  periodId: z.string().min(1),
  packageMode: PackageModeSchema,
  coverageBasis: CoverageBasisSchema,
  generatedAt: z.string(),
  entries: z.array(ExportManifestEntrySchema),
});
export type ExportManifest = z.infer<typeof ExportManifestSchema>;

export const UsageMetricTypeSchema = z.enum([
  'ocr_pages',
  'jev_input_tokens',
  'jev_output_tokens',
  'storage_bytes',
  'export_runs',
]);
export type UsageMetricType = z.infer<typeof UsageMetricTypeSchema>;

export const UsageLedgerEntrySchema = z.object({
  id: z.string().min(1),
  officeId: z.string().min(1),
  clientId: z.string().min(1),
  periodId: z.string().optional(),
  metricType: UsageMetricTypeSchema,
  rawUnits: z.number().int().nonnegative(),
  billableUnits: z.number().int().nonnegative(),
  isSystemFaultReprocess: z.boolean().default(false),
  providerCostSatang: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(1),
  createdAt: z.string(),
});
export type UsageLedgerEntry = z.infer<typeof UsageLedgerEntrySchema>;


// ==========================================
// Phase S9 Pilot Tracking DTO Schemas (DR-901 to DR-906)
// Identifiers only: no tax IDs, names or document text are stored in pilot data.
// ==========================================

export const PilotModeSchema = z.enum(['baseline', 'assisted']);
export type PilotMode = z.infer<typeof PilotModeSchema>;

export const PilotStageSchema = z.enum(['stage1_1office_2clients', 'stage2_2offices_6clients']);
export type PilotStage = z.infer<typeof PilotStageSchema>;

export const PilotEventSchema = z.object({
  officeId: z.string().min(1),
  clientId: z.string().min(1),
  periodId: z.string().min(1).optional(),
  mode: PilotModeSchema,
  documents: z.number().int().positive(),
  activeSeconds: z.number().int().nonnegative(),
  supportSeconds: z.number().int().nonnegative().default(0),
  reviewRounds: z.number().int().nonnegative().default(0),
  reworkedDocuments: z.number().int().nonnegative().default(0),
  costSatang: z.number().int().nonnegative().default(0),
  onboardingMinutes: z.number().int().nonnegative().optional(),
  recordedAt: z.string(),
});
export type PilotEvent = z.infer<typeof PilotEventSchema>;

export const ReviewSampleGroupSchema = z.enum([
  'reviewer_accepted',
  'reviewer_corrected',
  'ai_abstained',
]);
export type ReviewSampleGroup = z.infer<typeof ReviewSampleGroupSchema>;

export const ReviewSampleResultSchema = z.object({
  documentId: z.string().min(1),
  group: ReviewSampleGroupSchema,
  category: z.string().min(1),
  outcome: z.enum(['correct', 'incorrect']),
});
export type ReviewSampleResult = z.infer<typeof ReviewSampleResultSchema>;

export const WillingnessToPaySurveySchema = z.object({
  respondentRole: z.enum(['accountant', 'office_owner', 'client_admin']),
  pricingModel: z.enum(['subscription_page_allowance', 'per_client_seat', 'per_page', 'other']),
  priceBand: z.enum(['none', 'low', 'mid', 'high']),
  wouldContinue: z.boolean(),
  reasonCode: z.string().max(64).optional(),
});
export type WillingnessToPaySurvey = z.infer<typeof WillingnessToPaySurveySchema>;

export const PilotMetricsRequestSchema = z.object({
  events: z.array(PilotEventSchema),
  minDocuments: z.number().int().positive().optional(),
});
export type PilotMetricsRequest = z.infer<typeof PilotMetricsRequestSchema>;

export const PilotDecisionRequestSchema = z.object({
  workingDays: z.number().int().nonnegative(),
  sampleSizeOk: z.boolean(),
  accountingCycleClosed: z.boolean(),
  timeReductionPercent: z.number().nullable(),
  reworkWorseThanBaseline: z.boolean().nullable(),
});
export type PilotDecisionRequest = z.infer<typeof PilotDecisionRequestSchema>;
