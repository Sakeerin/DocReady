import { describe, it, expect } from 'vitest';
import { extractFieldCandidates, getOCRProvider } from '@docready/ocr';
import { OcrSpan } from '@docready/contracts';
import { TenantRepository } from '@docready/db';

describe('Phase S3 Multi-Provider OCR & Candidate Extraction Suite (DR-301 - DR-306)', () => {
  const sampleSpans: OcrSpan[] = [
    {
      id: 'span_1',
      page: 1,
      text: 'ใบกำกับภาษี / ใบเสร็จรับเงิน',
      confidence: 0.99,
      boundingBox: { x: 0.35, y: 0.05, width: 0.3, height: 0.04 },
    },
    {
      id: 'span_2',
      page: 1,
      text: 'INV-2026-0001',
      confidence: 0.98,
      boundingBox: { x: 0.72, y: 0.08, width: 0.22, height: 0.03 },
    },
    {
      id: 'span_3',
      page: 1,
      text: 'วันที่ 01/10/2569',
      confidence: 0.97,
      boundingBox: { x: 0.72, y: 0.11, width: 0.18, height: 0.03 },
    },
    {
      id: 'span_4',
      page: 1,
      text: 'บริษัท สยาม ไอที เซอร์วิส จำกัด (เลขประจำตัวผู้เสียภาษี 0105558001111)',
      confidence: 0.99,
      boundingBox: { x: 0.08, y: 0.05, width: 0.4, height: 0.04 },
    },
    {
      id: 'span_5',
      page: 1,
      text: 'จำนวนเงินรวมทั้งสิ้น 10,700.00 บาท',
      confidence: 0.99,
      boundingBox: { x: 0.7, y: 0.82, width: 0.22, height: 0.04 },
    },
  ];

  it('[DR-301 & DR-302] Provider Factory resolves correct OCR adapters based on provider selection', () => {
    const mockProvider = getOCRProvider('mock');
    expect(mockProvider.constructor.name).toBe('MockOCRProvider');

    const azureProvider = getOCRProvider('azure_read');
    expect(azureProvider.constructor.name).toBe('AzureDocIntelReadAdapter');

    const gcvProvider = getOCRProvider('google_vision');
    expect(gcvProvider.constructor.name).toBe('GoogleCloudVisionOcrAdapter');

    const visionLlmProvider = getOCRProvider('vision_llm');
    expect(visionLlmProvider.constructor.name).toBe('VisionLlmOcrAdapter');
  });

  it('[DR-305] Candidate Extractor correctly identifies Document Number, Tax ID, Amount, and B.E. Date', () => {
    const candidates = extractFieldCandidates(sampleSpans);

    expect(candidates.length).toBeGreaterThanOrEqual(4);

    // Document Number Candidate
    const docNumCand = candidates.find((c) => c.fieldName === 'document_number');
    expect(docNumCand).toBeDefined();
    expect(docNumCand?.normalizedValue).toBe('INV-2026-0001');

    // Tax ID Candidate
    const taxIdCand = candidates.find((c) => c.fieldName === 'seller_tax_id');
    expect(taxIdCand).toBeDefined();
    expect(taxIdCand?.normalizedValue).toBe('0105558001111');

    // Buddhist Era Date Conversion (2569 B.E. -> 2026 C.E.)
    const dateCand = candidates.find((c) => c.fieldName === 'document_date');
    expect(dateCand).toBeDefined();
    expect(dateCand?.normalizedValue).toBe('2026-10-01');

    // Grand Total Candidate
    const totalCand = candidates.find((c) => c.fieldName === 'grand_total');
    expect(totalCand).toBeDefined();
    expect(totalCand?.normalizedValue).toBe('10700.00');
  });

  it('[DR-302 Checkpoint] Persists operation_id in repository for resumable async polling', async () => {
    const repo = new TenantRepository();
    const run = await repo.createOcrRun({
      id: 'ocr_run_100',
      officeId: '11111111-1111-1111-1111-111111111111',
      clientId: 'a1111111-1111-1111-1111-111111111111',
      documentId: 'doc_101',
      provider: 'azure_read',
      operationId: 'az_op_resume_9912',
      status: 'running',
    });

    expect(run.operationId).toBe('az_op_resume_9912');

    const fetched = await repo.getOcrRunByOperationId('az_op_resume_9912');
    expect(fetched).not.toBeNull();
    expect(fetched?.documentId).toBe('doc_101');
  });
});
