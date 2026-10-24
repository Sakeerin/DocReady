import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import {
  buildReviewSample,
  computeCoverage,
  computePilotMetrics,
  evaluateAutoClassificationGate,
  evaluatePilotDecision,
  evaluatePilotRolloutStage,
  wilsonLowerBound,
} from '@docready/domain';
import { PilotEvent } from '@docready/contracts';

const event = (over: Partial<PilotEvent>): PilotEvent => ({
  officeId: 'off_a',
  clientId: 'cli_a',
  mode: 'baseline',
  documents: 100,
  activeSeconds: 10000,
  supportSeconds: 0,
  reviewRounds: 100,
  reworkedDocuments: 10,
  costSatang: 0,
  recordedAt: '2026-10-24T00:00:00Z',
  ...over,
});

describe('Phase S9 Pilot Evaluation Tooling (DR-901 - DR-906)', () => {
  it('Wilson lower bound matches hand-computed reference values', () => {
    expect(wilsonLowerBound(300, 300)).toBeCloseTo(0.9874, 3);
    expect(wilsonLowerBound(95, 100)).toBeCloseTo(0.888, 2);
    expect(wilsonLowerBound(0, 0)).toBe(0);
  });

  it('DR-904: fewer than 300 decisions keeps assist even at 100% accuracy; financial auto-approve never opens', () => {
    const thin = evaluateAutoClassificationGate({
      perCategory: [{ category: 'tax_invoice', correct: 299, total: 299 }],
    });
    expect(thin.autoRouteEnabled).toBe(false);
    expect(thin.reason).toContain('คงโหมด assist');
    expect(thin.autoApproveFinancialFields).toBe(false);
    expect(thin.autoApprovePackage).toBe(false);
  });

  it('DR-904: only categories whose Wilson lower bound >= 0.95 are auto-routed', () => {
    const result = evaluateAutoClassificationGate({
      perCategory: [
        { category: 'tax_invoice', correct: 300, total: 300 },
        { category: 'payment_evidence', correct: 95, total: 100 },
      ],
    });
    const byCat = Object.fromEntries(result.categories.map((c) => [c.category, c.passed]));
    expect(byCat.tax_invoice).toBe(true);
    expect(byCat.payment_evidence).toBe(false);
    expect(result.autoRouteEnabled).toBe(true);
    expect(result.autoApproveFinancialFields).toBe(false);
  });

  it('DR-903: coverage is reported with error rate and review sample covers all three groups deterministically', () => {
    expect(computeCoverage({ eligible: 100, autoClassified: 40, errors: 2 })).toEqual({
      coverage: 0.4,
      errorRate: 0.05,
    });
    expect(computeCoverage({ eligible: 0, autoClassified: 0, errors: 0 })).toEqual({
      coverage: null,
      errorRate: null,
    });

    const items = Array.from({ length: 30 }, (_, i) => ({
      id: `d${i}`,
      group: (['reviewer_accepted', 'reviewer_corrected', 'ai_abstained'] as const)[i % 3]!,
    }));
    const a = buildReviewSample({ items, perGroup: 4, seed: 42 });
    const b = buildReviewSample({ items, perGroup: 4, seed: 42 });
    expect(a.sampled).toEqual(b.sampled);
    expect(a.groupsCovered).toHaveLength(3);
    expect(a.sampled).toHaveLength(12);

    const short = buildReviewSample({ items: items.slice(0, 3), perGroup: 4, seed: 1 });
    expect(short.shortfalls).toHaveLength(3);
  });

  it('DR-905: thin samples return insufficient_sample instead of numbers', () => {
    const result = computePilotMetrics({
      events: [event({ mode: 'baseline', documents: 50 }), event({ mode: 'assisted', documents: 50 })],
    });
    expect(result.status).toBe('insufficient_sample');
    expect(result.timeReductionPercent).toBeUndefined();

    expect(computePilotMetrics({ events: [] }).status).toBe('insufficient_sample');
    // one mode only is not comparable
    expect(computePilotMetrics({ events: [event({ documents: 500 })] }).status).toBe('insufficient_sample');
  });

  it('DR-905: computes time reduction per 100 documents including support time', () => {
    const result = computePilotMetrics({
      events: [
        event({ mode: 'baseline', documents: 100, activeSeconds: 10000, reworkedDocuments: 10 }),
        event({ mode: 'assisted', documents: 100, activeSeconds: 6000, supportSeconds: 1000, reworkedDocuments: 8 }),
      ],
    });
    expect(result.status).toBe('ok');
    expect(result.baseline?.secondsPer100Docs).toBe(10000);
    expect(result.assisted?.secondsPer100Docs).toBe(7000);
    expect(result.timeReductionPercent).toBeCloseTo(30, 5);
    expect(result.reworkWorseThanBaseline).toBe(false);
  });

  it('DR-905/906: short pilot, open accounting cycle or thin sample always means continue_pilot', () => {
    const good = { sampleSizeOk: true, timeReductionPercent: 40, reworkWorseThanBaseline: false };
    expect(
      evaluatePilotDecision({ ...good, workingDays: 6, accountingCycleClosed: true }).decision
    ).toBe('continue_pilot');
    expect(
      evaluatePilotDecision({ ...good, workingDays: 10, accountingCycleClosed: false }).decision
    ).toBe('continue_pilot');
    expect(
      evaluatePilotDecision({
        ...good,
        sampleSizeOk: false,
        workingDays: 10,
        accountingCycleClosed: true,
      }).decision
    ).toBe('continue_pilot');
    expect(
      evaluatePilotDecision({ ...good, workingDays: 10, accountingCycleClosed: true }).decision
    ).toBe('expand');
    expect(
      evaluatePilotDecision({
        ...good,
        timeReductionPercent: 10,
        workingDays: 10,
        accountingCycleClosed: true,
      }).decision
    ).toBe('keep_assist');
    expect(
      evaluatePilotDecision({
        ...good,
        timeReductionPercent: 40,
        reworkWorseThanBaseline: true,
        workingDays: 10,
        accountingCycleClosed: true,
      }).decision
    ).toBe('adjust_workflow');
  });

  it('DR-901/902: stage 2 needs no blocking defects and S8 readiness', () => {
    expect(evaluatePilotRolloutStage({ blockingDefectsOpen: 0, s8ReadinessPassed: true }).canAdvance).toBe(true);
    const blocked = evaluatePilotRolloutStage({ blockingDefectsOpen: 2, s8ReadinessPassed: false });
    expect(blocked.canAdvance).toBe(false);
    expect(blocked.blockers).toHaveLength(2);
  });

  it('pilot data is tenant-isolated and the server scope overrides payload scope', async () => {
    const repo = new TenantRepository();
    const scopeA = { officeId: 'off_a', clientId: 'cli_a' };
    const scopeB = { officeId: 'off_b', clientId: 'cli_b' };

    await repo.recordPilotEvent(scopeA, event({ mode: 'baseline', officeId: 'off_b', clientId: 'cli_b' }));
    await repo.recordPilotEvent(scopeA, event({ mode: 'assisted' }));

    expect((await repo.getPilotMetrics(scopeA, 1)).sampleSize).toBe(200);
    expect((await repo.getPilotMetrics(scopeB, 1)).sampleSize).toBe(0);

    for (let i = 0; i < 300; i++) {
      await repo.recordReviewSampleResult(scopeA, {
        documentId: `d${i}`,
        group: 'reviewer_accepted',
        category: 'tax_invoice',
        outcome: 'correct',
      });
    }
    expect((await repo.evaluateAutoClassificationGateForScope(scopeA)).autoRouteEnabled).toBe(true);
    expect((await repo.evaluateAutoClassificationGateForScope(scopeB)).autoRouteEnabled).toBe(false);

    await repo.recordWtpResponse(scopeA, {
      respondentRole: 'office_owner',
      pricingModel: 'subscription_page_allowance',
      priceBand: 'mid',
      wouldContinue: true,
    });
    expect(await repo.getWtpResponses(scopeA)).toHaveLength(1);
    expect(await repo.getWtpResponses(scopeB)).toHaveLength(0);
  });
});
