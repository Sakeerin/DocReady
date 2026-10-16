import { DecisionRunResult } from '@docready/contracts';
import { BoundedQuestion } from '../questions';

export class MockDecisionProvider {
  public readonly modelVersion = 'mock_v1';

  public async evaluateQuestion(question: BoundedQuestion): Promise<DecisionRunResult> {
    const selected = question.choices.length > 0 ? question.choices[0]?.id || null : null;

    return {
      decisionRunId: `mock_run_${Date.now()}`,
      modelVersion: this.modelVersion,
      questionType: question.questionType,
      selectedCandidateId: selected,
      confidence: 0.95,
      inputTokens: 100,
      estimatedCostUsd: 0.0000042,
    };
  }
}
