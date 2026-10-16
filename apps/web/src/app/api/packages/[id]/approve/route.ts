import { NextResponse } from 'next/server';
import { ApprovePackageSchema } from '@docready/contracts';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = ApprovePackageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid package approval DTO', details: parsed.error.format() },
        { status: 422 }
      );
    }

    const actorRole = request.headers.get('x-actor-role') ?? 'office_staff';
    if (actorRole !== 'office_staff') {
      return NextResponse.json(
        { error: 'Only accounting office reviewers can approve packages' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: 'approved',
      packageId: params.id,
      approval: {
        id: `appr_${Date.now()}`,
        packageId: params.id,
        officeId: parsed.data.officeId,
        clientId: parsed.data.clientId,
        approvalNote: parsed.data.approvalNote,
        exceptionsAcknowledged: parsed.data.exceptionsAcknowledged,
        status: 'active',
        approvedAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
