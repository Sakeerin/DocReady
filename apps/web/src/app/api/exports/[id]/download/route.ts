import { NextResponse } from 'next/server';
import { ExportStatus } from '@docready/contracts';
import { verifyExportDownloadAccess } from '@docready/exports';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url);
  const officeId =
    request.headers.get('x-office-id') ?? url.searchParams.get('officeId') ?? 'off_alpha';
  const clientId =
    request.headers.get('x-client-id') ?? url.searchParams.get('clientId') ?? 'cli_alpha_1';
  const membershipActive = request.headers.get('x-membership-active') !== 'false';
  const simulateStatus = (url.searchParams.get('status') ?? 'completed') as ExportStatus;

  const sampleExportJob = {
    id: params.id,
    officeId: 'off_alpha',
    clientId: 'cli_alpha_1',
    status: simulateStatus,
    storagePath:
      simulateStatus === 'completed'
        ? `exports/off_alpha/cli_alpha_1/${params.id}.zip`
        : undefined,
    sha256Checksum:
      simulateStatus === 'completed'
        ? 'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3a94a8fe5ccb19ba61c4c0873'
        : undefined,
    expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
  };

  const verification = verifyExportDownloadAccess({
    exportJob: sampleExportJob,
    requesterScope: { officeId, clientId },
    isMembershipActive: membershipActive,
  });

  if (!verification.authorized) {
    return NextResponse.json(
      { error: verification.reason ?? 'Download unauthorized' },
      { status: verification.httpStatus }
    );
  }

  return NextResponse.json({
    status: 'authorized',
    exportId: params.id,
    storageBucket: 'exports',
    storagePath: sampleExportJob.storagePath,
    sha256Checksum: sampleExportJob.sha256Checksum,
    shortLivedDownloadToken: verification.shortLivedDownloadToken,
    ttlSeconds: 300,
  });
}
