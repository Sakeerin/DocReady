import { NextResponse } from 'next/server';
import { ExportStatus, PackageItemSnapshot } from '@docready/contracts';
import { generateRealExportArchive, sanitizeExportPath, verifyExportDownloadAccess } from '@docready/exports';

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
  const format = url.searchParams.get('format') ?? 'json';

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

  if (format === 'zip' || format === 'xlsx') {
    const sampleItems: PackageItemSnapshot[] = [
      {
        documentId: 'doc_sample_01',
        documentRevision: 1,
        documentNumber: '00001234',
        documentDate: '2026-09-15',
        sellerName: 'บริษัท ตัวอย่าง จำกัด',
        sellerTaxId: '0105550009991',
        grandTotal: '1070.00',
        statedTax: '70.00',
        currency: 'THB',
        documentRoles: ['tax_invoice'],
        countingRole: 'primary_counting',
        sourceAssetId: 'asset_sample_01',
        sourceHash: 'sha256_source_sample_01',
        pageRange: '1-2',
        derivedStoragePath: 'derived/off_alpha/cli_alpha_1/doc_sample_01_p1-2_rev1.pdf',
        derivedFileHash: 'sha256_derived_sample_01',
        hasMixedClientFlag: false,
      },
    ];

    const realBundle = await generateRealExportArchive({
      packageId: `pkg_for_${params.id}`,
      packageRevision: 1,
      officeId: sampleExportJob.officeId,
      clientId: sampleExportJob.clientId,
      periodId: '2026-09',
      packageMode: 'complete_against_defined_list',
      coverageBasis: 'complete_against_defined_list',
      items: sampleItems,
    });

    const safeId = sanitizeExportPath(params.id);

    if (format === 'xlsx') {
      return new NextResponse(new Uint8Array(realBundle.xlsxBuffer), {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="docready_${safeId}.xlsx"`,
          'Content-Length': String(realBundle.xlsxBuffer.length),
          'X-SHA256-Checksum': realBundle.sha256Checksum,
        },
      });
    }

    return new NextResponse(new Uint8Array(realBundle.zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="docready_${safeId}.zip"`,
        'Content-Length': String(realBundle.zipBuffer.length),
        'X-SHA256-Checksum': realBundle.sha256Checksum,
      },
    });
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
