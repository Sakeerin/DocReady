import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    // Return normalized OCR spans & extracted candidate highlights
    return NextResponse.json({
      documentId,
      provider: 'azure_read',
      spans: [
        { id: 'span_1', page: 1, text: 'ใบกำกับภาษี / ใบเสร็จรับเงิน', confidence: 0.99, boundingBox: { x: 0.35, y: 0.05, width: 0.3, height: 0.04 } },
        { id: 'span_2', page: 1, text: 'INV-2026-0001', confidence: 0.98, boundingBox: { x: 0.72, y: 0.08, width: 0.22, height: 0.03 } },
        { id: 'span_3', page: 1, text: '05/10/2026', confidence: 0.97, boundingBox: { x: 0.72, y: 0.11, width: 0.18, height: 0.03 } },
        { id: 'span_4', page: 1, text: 'บริษัท สยาม ไอที เซอร์วิส จำกัด', confidence: 0.99, boundingBox: { x: 0.08, y: 0.05, width: 0.4, height: 0.04 } },
        { id: 'span_5', page: 1, text: '0105558001111', confidence: 0.99, boundingBox: { x: 0.08, y: 0.1, width: 0.25, height: 0.03 } },
        { id: 'span_6', page: 1, text: '10,700.00', confidence: 0.99, boundingBox: { x: 0.7, y: 0.82, width: 0.22, height: 0.04 } },
      ],
      candidates: [
        { fieldName: 'document_number', rawText: 'INV-2026-0001', normalizedValue: 'INV-2026-0001', spanIds: ['span_2'] },
        { fieldName: 'document_date', rawText: '05/10/2026', normalizedValue: '2026-10-05', spanIds: ['span_3'] },
        { fieldName: 'seller_tax_id', rawText: '0105558001111', normalizedValue: '0105558001111', spanIds: ['span_5'] },
        { fieldName: 'grand_total', rawText: '10,700.00', normalizedValue: '10700.00', spanIds: ['span_6'] },
      ],
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
