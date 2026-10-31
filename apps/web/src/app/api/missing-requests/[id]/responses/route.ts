import { NextResponse } from 'next/server';
import { SubmitRequestResponseSchema, ResolveMissingRequestSchema } from '@docready/contracts';
import { transitionMissingRequestStatus } from '@docready/domain';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // If accounting staff is resolving the request
    if (body.action === 'staff_resolve') {
      const resolveParse = ResolveMissingRequestSchema.safeParse(body);
      if (!resolveParse.success) {
        return NextResponse.json(
          { error: 'Invalid staff resolution DTO', details: resolveParse.error.format() },
          { status: 422 }
        );
      }

      const newStatus = transitionMissingRequestStatus('responded', 'staff_resolve', 'office_staff');
      return NextResponse.json({
        requestId: params.id,
        status: newStatus,
        resolutionNote: resolveParse.data.resolutionNote,
        markExpectedItemNotApplicable: resolveParse.data.markExpectedItemNotApplicable || false,
        message: 'Missing request verified and resolved by accounting reviewer.',
      });
    }

    // Client response submission (T-23: transitions to 'responded', NEVER 'resolved')
    const parseResult = SubmitRequestResponseSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid client response DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const newStatus = transitionMissingRequestStatus('published', 'client_respond', 'client_user');

    return NextResponse.json({
      requestId: params.id,
      status: newStatus,
      responseType: parseResult.data.responseType,
      explanationText: parseResult.data.explanationText,
      uploadedDocumentId: parseResult.data.uploadedDocumentId,
      message: 'รับคำตอบจากลูกค้าแล้ว (สถานะ: responded — รอนักบัญชีตรวจสอบเพื่อปิดคำขอ)',
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
