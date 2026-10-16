import { DecisionRunResult } from '@docready/contracts';
import { BoundedQuestion } from '../questions';

export class RuleBaselineDecisionAdapter {
  public readonly modelVersion = 'rule_baseline_v1';

  public async evaluateQuestion(question: BoundedQuestion): Promise<DecisionRunResult> {
    const selected = question.choices.length > 0 ? question.choices[0]?.id || null : null;

    return {
      decisionRunId: `base_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      modelVersion: this.modelVersion,
      questionType: question.questionType,
      selectedCandidateId: selected,
      confidence: 0.90,
      inputTokens: 0,
      estimatedCostUsd: 0.0,
    };
  }
}
