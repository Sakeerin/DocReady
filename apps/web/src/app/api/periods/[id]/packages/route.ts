import { NextResponse } from 'next/server';
import { CreatePackageSnapshotSchema, PackageItemSnapshot } from '@docready/contracts';
import {
  aggregatePackageTotalsByCurrency,
  computePeriodReadiness,
  validatePackageSnapshotEligibility,
} from '@docready/domain';

const SAMPLE_ITEMS: PackageItemSnapshot[] = [
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
    derivedStoragePath: 'derived/off_1/cli_1/DOC-SYN-001_p1-1_rev2.pdf',
    derivedFileHash: 'sha256_drv_001',
    hasMixedClientFlag: false,
  },
  {
    documentId: 'DOC-SYN-002',
    documentRevision: 1,
    documentNumber: 'RC-00045129',
    documentDate: '2026-10-04',
    sellerName: 'บริษัท สยาม ไอที เซอร์วิส จำกัด',
    sellerTaxId: '0105561001234',
    grandTotal: '10700.00',
    statedTax: '700.00',
    currency: 'THB',
    documentRoles: ['receipt'],
    countingRole: 'supporting_non_counting',
    sourceAssetId: 'asset_002',
    sourceHash: 'sha256_src_002',
    pageRange: '1-1',
    derivedStoragePath: 'derived/off_1/cli_1/DOC-SYN-002_p1-1_rev1.pdf',
    derivedFileHash: 'sha256_drv_002',
    hasMixedClientFlag: false,
  },
];

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const totalsByCurrency = aggregatePackageTotalsByCurrency(SAMPLE_ITEMS);

  return NextResponse.json({
    periodId: params.id,
    packages: [
      {
        id: 'pkg_202610_rev1',
        periodId: params.id,
        packageRevision: 1,
        packageMode: 'complete_against_defined_list',
        coverageBasis: 'complete_against_defined_list',
        status: 'approved',
        checklistRevisionSnapshot: 1,
        items: SAMPLE_ITEMS,
        totalsByCurrency,
        createdAt: '2026-10-16T14:00:00Z',
      },
    ],
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = CreatePackageSnapshotSchema.safeParse({
      ...body,
      periodId: params.id,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid package snapshot DTO', details: parsed.error.format() },
        { status: 422 }
      );
    }

    const readiness = computePeriodReadiness(
      [{ id: 'exp_1', title: 'ค่าบริการ Cloud Server', requirementStatus: 'required' }],
      [{ expectedItemId: 'exp_1', documentId: 'DOC-SYN-001' }],
      2,
      parsed.data.exceptionsAcknowledged
    );

    const eligibility = validatePackageSnapshotEligibility({
      packageMode: parsed.data.packageMode,
      readiness,
      items: SAMPLE_ITEMS,
      exceptionsAcknowledged: parsed.data.exceptionsAcknowledged,
    });

    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: 'Package snapshot not eligible', reasons: eligibility.reasons },
        { status: 422 }
      );
    }

    return NextResponse.json({
      status: 'created',
      packageSnapshot: {
        id: `pkg_${Date.now()}`,
        ...parsed.data,
        packageRevision: 1,
        coverageBasis: readiness.coverageBasis,
        status: 'draft',
        items: SAMPLE_ITEMS,
        totalsByCurrency: aggregatePackageTotalsByCurrency(SAMPLE_ITEMS),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
