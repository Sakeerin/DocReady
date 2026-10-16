import { NextResponse } from 'next/server';
import { computeOperationalMetrics, summarizeUsageLedger } from '@docready/domain';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const officeId =
    request.headers.get('x-office-id') ?? url.searchParams.get('officeId') ?? 'off_alpha';

  const operations = computeOperationalMetrics({
    officeId,
    documents: [
      { status: 'reviewed', prepDurationSeconds: 74, hasException: false },
      { status: 'approved', prepDurationSeconds: 68, hasException: false },
      { status: 'reviewed', prepDurationSeconds: 95, hasException: true },
      { status: 'pending_review', hasException: false },
    ],
    missingRequests: [{ status: 'published' }, { status: 'resolved' }],
    packages: [{ status: 'approved' }, { status: 'invalidated_by_change' }],
  });

  const usageByClient = summarizeUsageLedger([
    {
      id: 'usage_001',
      officeId,
      clientId: 'cli_alpha_1',
      periodId: 'period_2026_10',
      metricType: 'ocr_pages',
      rawUnits: 42,
      billableUnits: 42,
      isSystemFaultReprocess: false,
      providerCostSatang: 2100,
      idempotencyKey: 'ocr_batch_1',
      createdAt: '2026-10-16T10:00:00Z',
    },
    {
      id: 'usage_002',
      officeId,
      clientId: 'cli_alpha_1',
      periodId: 'period_2026_10',
      metricType: 'ocr_pages',
      rawUnits: 5,
      billableUnits: 0,
      isSystemFaultReprocess: true,
      providerCostSatang: 250,
      idempotencyKey: 'ocr_retry_sys_fault_1',
      createdAt: '2026-10-16T10:15:00Z',
    },
    {
      id: 'usage_003',
      officeId,
      clientId: 'cli_alpha_1',
      periodId: 'period_2026_10',
      metricType: 'jev_input_tokens',
      rawUnits: 18450,
      billableUnits: 18450,
      isSystemFaultReprocess: false,
      providerCostSatang: 550,
      idempotencyKey: 'jev_batch_1',
      createdAt: '2026-10-16T10:30:00Z',
    },
    {
      id: 'usage_004',
      officeId,
      clientId: 'cli_alpha_1',
      periodId: 'period_2026_10',
      metricType: 'export_runs',
      rawUnits: 2,
      billableUnits: 2,
      isSystemFaultReprocess: false,
      providerCostSatang: 0,
      idempotencyKey: 'exp_batch_1',
      createdAt: '2026-10-16T14:00:00Z',
    },
  ]);

  return NextResponse.json({
    officeId,
    generatedAt: new Date().toISOString(),
    operations,
    usageByClient,
  });
}
