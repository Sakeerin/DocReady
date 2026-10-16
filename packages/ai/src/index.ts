import { DecisionProviderType, DecisionRunResult } from '@docready/contracts';
import { BoundedQuestion } from './questions';
import { JevDecisionAdapter } from './providers/jev';
import { RuleBaselineDecisionAdapter } from './providers/baseline';
import { MockDecisionProvider } from './providers/mock';

export * from './questions';
export { JevDecisionAdapter, RuleBaselineDecisionAdapter, MockDecisionProvider };

export interface DecisionProvider {
  modelVersion: string;
  evaluateQuestion(question: BoundedQuestion): Promise<DecisionRunResult>;
}

/**
 * Decision Provider Factory.
 * Returns decision provider based on environment config or requested provider type.
 */
export function getDecisionProvider(providerType?: DecisionProviderType | string): DecisionProvider {
  const selected = (providerType || process.env.DOCREADY_DECISION_PROVIDER || 'jev_1.13.0').toLowerCase();

  switch (selected) {
    case 'jev_1.13.0':
    case 'jev':
      return new JevDecisionAdapter();
    case 'rule_baseline':
      return new RuleBaselineDecisionAdapter();
    case 'mock':
    default:
      return new MockDecisionProvider();
  }
}
