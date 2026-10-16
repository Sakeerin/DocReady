import { NormalizedOcrResult, OcrSpan } from '@docready/contracts';
import { OCRInput, OCROperation } from './azure';

export class MockOCRProvider {
  public async submit(input: OCRInput): Promise<OCROperation> {
    return {
      operationId: `mock_op_${input.assetId}_${Date.now()}`,
      submittedAt: new Date().toISOString(),
      provider: 'mock',
    };
  }

  public async poll(operation: OCROperation): Promise<NormalizedOcrResult> {
    const spans: OcrSpan[] = [
      {
        id: 'mock_span_1',
        page: 1,
        text: 'ใบกำกับภาษี / ใบเสร็จรับเงิน',
        confidence: 0.99,
        boundingBox: { x: 0.35, y: 0.05, width: 0.3, height: 0.04 },
      },
      {
        id: 'mock_span_2',
        page: 1,
        text: 'INV-2026-0001',
        confidence: 0.98,
        boundingBox: { x: 0.72, y: 0.08, width: 0.22, height: 0.03 },
      },
      {
        id: 'mock_span_3',
        page: 1,
        text: '05/10/2026',
        confidence: 0.97,
        boundingBox: { x: 0.72, y: 0.11, width: 0.18, height: 0.03 },
      },
      {
        id: 'mock_span_4',
        page: 1,
        text: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
        confidence: 0.99,
        boundingBox: { x: 0.08, y: 0.05, width: 0.4, height: 0.04 },
      },
      {
        id: 'mock_span_5',
        page: 1,
        text: '0105558001111',
        confidence: 0.99,
        boundingBox: { x: 0.08, y: 0.1, width: 0.25, height: 0.03 },
      },
      {
        id: 'mock_span_6',
        page: 1,
        text: '10,700.00',
        confidence: 0.97,
        boundingBox: { x: 0.7, y: 0.82, width: 0.22, height: 0.04 },
      },
    ];

    return {
      provider: 'mock',
      operationId: operation.operationId,
      spans,
      qualityFlags: [],
    };
  }
}
