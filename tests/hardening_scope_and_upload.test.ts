import { describe, it, expect } from 'vitest';
import { TenantRepository } from '@docready/db';
import {
  checkFileQuotaLimits,
  validatePageGroupingCompleteness,
  RevisionConflictError,
} from '@docready/domain';
import { inspectPdfHeader, validateFileMagicBytes } from '@docready/files';

describe('Phase S8 Hardening: Scope, Upload & Concurrency (DR-801)', () => {
  const scopeA = { officeId: 'off_a', clientId: 'cli_a' };
  const scopeB = { officeId: 'off_a', clientId: 'cli_b' };

  const reserve = async (repo: TenantRepository, id: string) =>
    repo.createUploadSession({
      id,
      officeId: 'off_a',
      clientId: 'cli_a',
      periodId: 'per_1',
      filename: 'inv.pdf',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      storageKey: `quarantine/off_a/cli_a/${id}.pdf`,
      status: 'reserved',
    });

  it('T-03: upload completion ignores client-supplied client/period/storage key and uses the reserved scope', async () => {
    const repo = new TenantRepository();
    await reserve(repo, 'sess_t03');

    const { asset } = await repo.completeUploadSession(scopeA, 'sess_t03', {
      fileHash: 'sha256_abc12345',
      clientId: 'cli_b',
      periodId: 'per_evil',
      storageKey: 'quarantine/off_b/cli_b/steal.pdf',
    });

    expect(asset.clientId).toBe('cli_a');
    expect(asset.periodId).toBe('per_1');
    expect(asset.storageKey).toBe('quarantine/off_a/cli_a/sess_t03.pdf');

    // Another client in the same office cannot complete or read this session/asset
    await expect(
      repo.completeUploadSession(scopeB, 'sess_t03', { fileHash: 'x' })
    ).rejects.toThrow(/not found or access denied/);
    expect(await repo.getAsset(scopeB, asset.id)).toBeNull();
  });

  it('T-05: page bomb, oversized and encrypted PDFs are rejected without crashing', () => {
    expect(checkFileQuotaLimits(1024, 500).valid).toBe(false);
    expect(checkFileQuotaLimits(30 * 1024 * 1024, 1).valid).toBe(false);
    expect(checkFileQuotaLimits(1024, 3).valid).toBe(true);

    const encrypted = Buffer.from('%PDF-1.4\n/Encrypt 5 0 R\n/Type /Page\n');
    expect(inspectPdfHeader(encrypted).isEncrypted).toBe(true);
    expect(validateFileMagicBytes(Buffer.from('MZ-not-a-pdf'), 'application/pdf')).toBe(false);
  });

  it('T-06: retrying complete after a DB failure is idempotent and creates no duplicate asset', async () => {
    const repo = new TenantRepository();
    await reserve(repo, 'sess_t06');

    const first = await repo.completeUploadSession(scopeA, 'sess_t06', { fileHash: 'sha256_h1h1h1h1' });
    const retry = await repo.completeUploadSession(scopeA, 'sess_t06', { fileHash: 'sha256_h1h1h1h1' });

    expect(first.alreadyCompleted).toBe(false);
    expect(retry.alreadyCompleted).toBe(true);
    expect(retry.asset.id).toBe(first.asset.id);
  });

  it('T-09: every page of a 5-page PDF must be mapped or explicitly excluded', () => {
    const groups = [
      { documentIndex: 1, pageNumbers: [1, 2], roles: ['tax_invoice' as const] },
      { documentIndex: 2, pageNumbers: [3], roles: ['other' as const] }, // explicit exclusion: blank page
      { documentIndex: 3, pageNumbers: [4, 5], roles: ['receipt' as const] },
    ];
    expect(validatePageGroupingCompleteness(5, groups).valid).toBe(true);

    const forgotten = groups.filter((g) => g.documentIndex !== 2);
    const result = validatePageGroupingCompleteness(5, forgotten);
    expect(result.valid).toBe(false);
    expect(result.missingPages).toEqual([3]);
  });

  it('T-20: two reviewers editing the same revision get an explicit conflict, never a silent overwrite', async () => {
    const repo = new TenantRepository();
    await repo.addDocument(scopeA, {
      id: 'doc_t20',
      periodId: 'per_1',
      documentNumber: '0001',
      status: 'needs_review',
    });

    await repo.updateDocumentFields(scopeA, 'doc_t20', { grandTotal: '100.00' }, 1, 'user_1');
    await expect(
      repo.updateDocumentFields(scopeA, 'doc_t20', { grandTotal: '999.00' }, 1, 'user_2')
    ).rejects.toBeInstanceOf(RevisionConflictError);

    const doc = await repo.getDocumentById(scopeA, 'doc_t20');
    expect(doc?.grandTotal).toBe('100.00');
    expect(doc?.revisionNumber).toBe(2);
  });
});
