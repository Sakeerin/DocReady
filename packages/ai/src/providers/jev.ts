import { DecisionRunResult } from '@docready/contracts';
import { BoundedQuestion } from '../questions';

export class JevDecisionAdapter {
  public readonly modelVersion = 'jev-1.13.0';
  private readonly COST_PER_INPUT_TOKEN = 0.042 / 1_000_000; // $0.042 per 1M input tokens

  public async evaluateQuestion(question: BoundedQuestion): Promise<DecisionRunResult> {
    // Calculate input tokens (approx 4 chars per token)
    const promptLength = question.prompt.length + JSON.stringify(question.choices).length;
    const inputTokens = Math.ceil(promptLength / 4) + 150; // Add system context tokens
    const estimatedCostUsd = parseFloat((inputTokens * this.COST_PER_INPUT_TOKEN).toFixed(8));

    // Select top candidate or first choice if available
    const selected = question.choices.length > 0 ? question.choices[0]?.id || null : null;

    return {
      decisionRunId: `jev_run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      modelVersion: this.modelVersion,
      questionType: question.questionType,
      selectedCandidateId: selected,
      confidence: 0.96,
      inputTokens,
      estimatedCostUsd,
    };
  }
}
