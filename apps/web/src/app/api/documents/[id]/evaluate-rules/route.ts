import { NextResponse } from 'next/server';
import { EvaluateRulesRequestSchema } from '@docready/contracts';
import { getDecisionProvider, buildCandidateSelectionQuestion } from '@docready/ai';
import { validateMonetaryComponents, detectClientCompanyMismatch } from '@docready/domain';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = EvaluateRulesRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid evaluate-rules request DTO', details: parseResult.error.format() },
        { status: 422 }
      );
    }

    const { provider, clientCompanyTaxId } = parseResult.data;
    const decisionEngine = getDecisionProvider(provider);

    // Mock candidates for evaluation
    const sampleCandidates = [
      {
        fieldName: 'grand_total' as const,
        rawText: '10,700.00',
        normalizedValue: '10700.00',
        confidence: 0.99,
        spanIds: ['span_6'],
      },
    ];

    // Build bounded choice question for grand_total candidate selection
    const question = buildCandidateSelectionQuestion('grand_total', sampleCandidates);
    const decisionResult = await decisionEngine.evaluateQuestion(question);

    // Run domain business rule validation (Decimal arithmetic)
    const monetaryCheck = validateMonetaryComponents('10000.00', '700.00', '10700.00');

    // Run client tax ID mismatch detection
    const clientMismatch = detectClientCompanyMismatch('0105558001111', clientCompanyTaxId || '0105559009999');

    return NextResponse.json({
      documentId: params.id,
      decisionRun: decisionResult,
      monetaryValidation: monetaryCheck,
      clientMismatch,
      proposedFields: {
        documentNumber: 'INV-2026-0001',
        documentDate: '2026-10-05',
        sellerTaxId: '0105558001111',
        grandTotal: '10700.00',
        currency: 'THB',
      },
      tokenCost: {
        tokens: decisionResult.inputTokens,
        estimatedCostUsd: decisionResult.estimatedCostUsd,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
