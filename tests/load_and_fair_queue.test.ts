import { describe, it, expect } from 'vitest';
import { FairQueueJob, scheduleFairQueue } from '@docready/domain';

const makeJobs = (officeId: string, clientId: string, count: number, pages = 1): FairQueueJob[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${clientId}_job_${i}`,
    officeId,
    clientId,
    pages,
  }));

describe('Phase S8 Load & Fairness Simulation (DR-802)', () => {
  const config = {
    maxConcurrentPagesPerClient: 6,
    maxConcurrentJobsPerOffice: 20,
    dailyPageBudgetPerOffice: 6000,
  };

  it('a noisy client cannot starve other clients of worker slots', () => {
    const pending = [
      ...makeJobs('off_a', 'cli_noisy', 200, 3),
      ...makeJobs('off_a', 'cli_b', 1, 3),
      ...makeJobs('off_a', 'cli_c', 1, 3),
    ];
    const result = scheduleFairQueue({ pending, config, totalWorkerSlots: 10 });

    const startedClients = result.started.map((j) => j.clientId);
    expect(startedClients).toContain('cli_b');
    expect(startedClients).toContain('cli_c');
    // noisy client is capped by max concurrent pages (6 pages / 3 per job = 2 jobs)
    expect(startedClients.filter((c) => c === 'cli_noisy')).toHaveLength(2);
    expect(result.deferred.length).toBe(198);
  });

  it('burst of 3 batches x 50 files is shared evenly and nothing is silently dropped', () => {
    const pending = [
      ...makeJobs('off_a', 'cli_1', 50),
      ...makeJobs('off_a', 'cli_2', 50),
      ...makeJobs('off_b', 'cli_3', 50),
    ];
    const result = scheduleFairQueue({
      pending,
      config: { ...config, maxConcurrentPagesPerClient: 10 },
      totalWorkerSlots: 100,
    });

    for (const c of ['cli_1', 'cli_2', 'cli_3']) {
      expect(result.started.filter((j) => j.clientId === c)).toHaveLength(10);
    }
    expect(result.started.length + result.deferred.length + result.rejectedBudget.length).toBe(150);
    expect(result.rejectedBudget).toHaveLength(0);
  });

  it('daily page budget is enforced per office without affecting other offices', () => {
    const pending = [...makeJobs('off_a', 'cli_1', 1, 3), ...makeJobs('off_b', 'cli_2', 1, 3)];
    const result = scheduleFairQueue({
      pending,
      config,
      totalWorkerSlots: 10,
      usedPagesTodayByOffice: { off_a: 5998 },
    });

    expect(result.rejectedBudget.map((j) => j.officeId)).toEqual(['off_a']);
    expect(result.started.map((j) => j.officeId)).toEqual(['off_b']);
  });

  it('per-office concurrent job cap leaves worker slots for other offices', () => {
    const pending = [...makeJobs('off_a', 'cli_1', 30), ...makeJobs('off_b', 'cli_2', 5)];
    const result = scheduleFairQueue({
      pending,
      config: { ...config, maxConcurrentPagesPerClient: 100, maxConcurrentJobsPerOffice: 5 },
      totalWorkerSlots: 20,
    });

    expect(result.started.filter((j) => j.officeId === 'off_a')).toHaveLength(5);
    expect(result.started.filter((j) => j.officeId === 'off_b')).toHaveLength(5);
  });
});
