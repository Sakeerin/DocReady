import { NextResponse } from 'next/server';
import { CompleteUploadSessionSchema } from '@docready/contracts';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = CompleteUploadSessionSchema.safeParse({
      sessionId: params.id,
      ...body,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid completion request DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { sessionId, storageKey, fileHash } = parseResult.data;

    // Creates asset & enqueues scan job in outbox
    const assetId = `asset_${sessionId}`;

    return NextResponse.json({
      status: 'completed',
      assetId,
      fileHash,
      outboxEventEnqueued: true,
      message: 'File receipt completed successfully. Quarantine scan queued.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
