import { NextResponse } from 'next/server';
import { createExportArchiveBundle } from '@docready/exports';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as {
      officeId?: string;
      clientId?: string;
      periodId?: string;
      packageStatus?: string;
    };

    if (!body.officeId || !body.clientId) {
      return NextResponse.json(
        { error: 'officeId and clientId are required for tenant isolation' },
        { status: 422 }
      );
    }

    // T-21 Guard: Reject export if package approval was invalidated by post-approval edits
    if (body.packageStatus === 'invalidated_by_change') {
      return NextResponse.json(
        {
          error:
            'การอนุมัติเดิมถูกยกเลิกเนื่องจากมีการแก้ไขเอกสารหรือ Checklist หลังอนุมัติ (T-21) กรุณาสร้างและอนุมัติ Package Revision ใหม่',
        },
        { status: 409 }
      );
    }

    const bundle = createExportArchiveBundle({
      packageId: params.id,
      packageRevision: 1,
      officeId: body.officeId,
      clientId: body.clientId,
      periodId: body.periodId ?? 'period_2026_10',
      packageMode: 'complete_against_defined_list',
      coverageBasis: 'complete_against_defined_list',
      items: [
        {
          documentId: 'DOC-SYN-001',
          documentRevision: 2,
          documentNumber: '00045129',
          documentDate: '2026-10-03',
          sellerName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
          sellerTaxId: '0105561001234',
          grandTotal: '10700.00',
          statedTax: '700.00',
          currency: 'THB',
          documentRoles: ['tax_invoice'],
          countingRole: 'primary_counting',
          sourceAssetId: 'asset_001',
          sourceHash: 'sha256_src_001',
          pageRange: '1-1',
          derivedStoragePath: `derived/${body.officeId}/${body.clientId}/DOC-SYN-001_p1-1_rev2.pdf`,
          derivedFileHash: 'sha256_drv_001',
          hasMixedClientFlag: false,
        },
      ],
    });

    return NextResponse.json({
      status: 'completed',
      exportJob: {
        id: `expjob_${Date.now()}`,
        packageId: params.id,
        storageBucket: bundle.storageBucket,
        storagePath: bundle.storagePath,
        sha256Checksum: bundle.sha256Checksum,
        fileSizeBytes: bundle.fileSizeBytes,
        manifest: bundle.manifest,
        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
