import { NextResponse } from 'next/server';
import { CreateExpectedItemSchema, ImportExpectedCsvSchema } from '@docready/contracts';
import { computePeriodReadiness, parseExpectedItemsCsv } from '@docready/domain';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const periodId = params.id;
    const sampleExpectedItems = [
      {
        id: 'exp_001',
        title: 'ค่าเช่าสำนักงานประจำเดือน 10/2026',
        vendorName: 'บริษัท อาคารพาณิชย์และบริการ จำกัด',
        expectedAmount: '48150.00',
        source: 'template' as const,
        requirementStatus: 'required' as const,
      },
      {
        id: 'exp_002',
        title: 'ค่าบริการอินเทอร์เน็ตองค์กร',
        vendorName: 'บริษัท โทรคมนาคมไทย จำกัด (มหาชน)',
        expectedAmount: '3199.30',
        source: 'template' as const,
        requirementStatus: 'required' as const,
      },
      {
        id: 'exp_003',
        title: 'ค่าบริการ Cloud Server',
        vendorName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
        expectedAmount: '10700.00',
        source: 'manual' as const,
        requirementStatus: 'required' as const,
      },
    ];

    const sampleMatches = [
      { expectedItemId: 'exp_002', documentId: 'DOC-SYN-006' },
      { expectedItemId: 'exp_003', documentId: 'DOC-SYN-001' },
    ];

    const readiness = computePeriodReadiness(sampleExpectedItems, sampleMatches, 2, false);

    return NextResponse.json({
      periodId,
      expectedItems: sampleExpectedItems,
      matches: sampleMatches,
      readiness,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // Check if CSV Import payload
    if (body.csvContent) {
      const csvParse = ImportExpectedCsvSchema.safeParse({
        ...body,
        periodId: params.id,
      });

      if (!csvParse.success) {
        return NextResponse.json(
          { error: 'Invalid CSV import DTO', details: csvParse.error.format() },
          { status: 422 }
        );
      }

      const parsedRows = parseExpectedItemsCsv(csvParse.data.csvContent);
      return NextResponse.json({
        status: 'imported',
        periodId: params.id,
        importedCount: parsedRows.length,
        items: parsedRows,
      });
    }

    // Standard single Expected Item creation
    const parseResult = CreateExpectedItemSchema.safeParse({
      ...body,
      periodId: params.id,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid expected item DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'created',
      expectedItem: {
        id: `exp_${Date.now()}`,
        ...parseResult.data,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
