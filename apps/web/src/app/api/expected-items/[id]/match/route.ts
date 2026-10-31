import { NextResponse } from 'next/server';
import { MatchExpectedItemSchema } from '@docready/contracts';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = MatchExpectedItemSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid match DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { officeId, clientId, documentId } = parseResult.data;

    return NextResponse.json({
      status: 'matched',
      matchId: `match_${Date.now()}`,
      expectedItemId: params.id,
      officeId,
      clientId,
      documentId,
      confirmedBy: 'human_reviewer',
      message: `Document ${documentId} matched to expected item ${params.id}`,
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
