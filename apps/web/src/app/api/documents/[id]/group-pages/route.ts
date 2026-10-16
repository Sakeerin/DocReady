import { NextResponse } from 'next/server';
import { UpdatePageGroupingSchema } from '@docready/contracts';
import { validatePageGroupingCompleteness } from '@docready/domain';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = UpdatePageGroupingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid page grouping DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { assetId, groups } = parseResult.data;
    const totalPages = body.totalPages || 5; // Total pages in asset

    // Enforce Page Grouping Invariant (All pages accounted for)
    const completeness = validatePageGroupingCompleteness(totalPages, groups);
    if (!completeness.valid) {
      return NextResponse.json(
        {
          error: 'Page grouping incomplete or invalid',
          missingPages: completeness.missingPages,
          duplicatePages: completeness.duplicatePages,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'success',
      assetId,
      logicalDocumentCount: groups.length,
      groups,
      message: 'Page grouping updated successfully',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
