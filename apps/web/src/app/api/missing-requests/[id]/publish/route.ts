import { NextResponse } from 'next/server';
import { transitionMissingRequestStatus } from '@docready/domain';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const newStatus = transitionMissingRequestStatus('draft', 'publish', 'office_staff');

    return NextResponse.json({
      requestId: params.id,
      status: newStatus,
      publishedAt: new Date().toISOString(),
      message: 'Missing document request published to Client Portal.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
