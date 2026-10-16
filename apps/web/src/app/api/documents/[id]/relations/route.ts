import { NextResponse } from 'next/server';
import { CreateRelationSchema } from '@docready/contracts';
import { validateRelationType } from '@docready/domain';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json({
      documentId: params.id,
      relations: [
        {
          id: 'rel_001',
          documentId: params.id,
          targetDocumentId: 'doc_002',
          relationType: 'supports',
          confirmedByUserId: 'user_reviewer_1',
          createdAt: new Date().toISOString(),
        },
      ],
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
    const parseResult = CreateRelationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid relation DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { targetDocumentId, relationType } = parseResult.data;

    // Validate relation type rule (Invoice + Receipt is forced to 'supports')
    const validatedRelation = validateRelationType('invoice', 'receipt', relationType);

    return NextResponse.json({
      status: 'created',
      relationId: `rel_${Date.now()}`,
      documentId: params.id,
      targetDocumentId,
      relationType: validatedRelation,
      message: `Document relation ${validatedRelation} created successfully`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
