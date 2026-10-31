import { NextResponse } from 'next/server';
import { UpdateDocumentFieldsSchema } from '@docready/contracts';
import { preserveStringIdentifier, isValidDecimalString } from '@docready/domain';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = UpdateDocumentFieldsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid field update DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const updates = parseResult.data;

    // Invariant Enforcement
    if (updates.documentNumber) {
      updates.documentNumber = preserveStringIdentifier(updates.documentNumber);
    }

    if (updates.grandTotal && !isValidDecimalString(updates.grandTotal)) {
      return NextResponse.json(
        { error: 'Grand total must be a valid decimal string format (e.g. 1250.00)' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'confirmed',
      documentId: params.id,
      updatedFields: updates,
      actor: 'human',
      message: 'Document fields confirmed and updated successfully',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
