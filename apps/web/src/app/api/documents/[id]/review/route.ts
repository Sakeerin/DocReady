import { NextResponse } from 'next/server';
import { ConfirmReviewSchema } from '@docready/contracts';
import { validateDocumentRevision, RevisionConflictError } from '@docready/domain';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const parseResult = ConfirmReviewSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid review confirmation DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { expectedRevision, action, reason } = parseResult.data;
    const currentServerRevision = 1; // Simulated current revision

    // Optimistic Concurrency Control Check (409 Conflict)
    try {
      validateDocumentRevision(currentServerRevision, expectedRevision);
    } catch (err) {
      if (err instanceof RevisionConflictError) {
        return NextResponse.json(
          {
            error: 'Revision Conflict: เอกสารนี้ถูกแก้ไขโดยผู้ใช้อื่นในระหว่างที่คุณเปิดตรวจทาน โปรดรีเฟรชหน้าเพื่อดูล่าสุด',
            currentRevision: err.currentRevision,
            expectedRevision: err.expectedRevision,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    const nextRevision = currentServerRevision + 1;
    const statusMap = {
      confirm: 'reviewed',
      reject: 'needs_resubmission',
      exclude: 'excluded',
    };

    return NextResponse.json({
      documentId: params.id,
      action,
      newStatus: statusMap[action],
      revisionNumber: nextRevision,
      reason,
      message: `Document status transitioned to ${statusMap[action]} (Revision ${nextRevision})`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
