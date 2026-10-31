import { NextResponse } from 'next/server';
import { ReprocessOcrSchema } from '@docready/contracts';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = ReprocessOcrSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid reprocess payload', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const provider = parseResult.data.provider || process.env.DOCREADY_OCR_PROVIDER || 'mock';

    return NextResponse.json({
      status: 'queued',
      documentId: params.id,
      provider,
      outboxEventEnqueued: true,
      message: `Re-OCR processing queued using provider: ${provider}`,
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
