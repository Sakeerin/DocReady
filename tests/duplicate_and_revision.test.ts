import { describe, it, expect } from 'vitest';
import { detectSemanticDuplicates, validateDocumentRevision, RevisionConflictError, validateRelationType } from '@docready/domain';
import { TenantRepository, DocumentRecord } from '@docready/db';

describe('Phase S5 Human Review & Duplicate Matching Suite (DR-501 - DR-506)', () => {
  const officeA_id = '11111111-1111-1111-1111-111111111111';
  const officeB_id = '22222222-2222-2222-2222-222222222222';
  const clientA1_id = 'a1111111-1111-1111-1111-111111111111';
  const clientB1_id = 'b1111111-1111-1111-1111-111111111111';

  const mockDocuments: DocumentRecord[] = [
    {
      id: 'doc_501_a',
      officeId: officeA_id,
      clientId: clientA1_id,
      periodId: 'p1',
      documentNumber: 'INV-2026-0001',
      sellerTaxId: '0105558001111',
      documentDate: '2026-10-05',
      grandTotal: '10700.00',
      currency: 'THB',
      fileHash: 'sha256_hash_abc_123',
      status: 'needs_review',
      revisionNumber: 1,
    },
    {
      id: 'doc_501_b',
      officeId: officeA_id,
      clientId: clientA1_id,
      periodId: 'p1',
      documentNumber: 'INV-2026-0001',
      sellerTaxId: '0105558001111',
      documentDate: '2026-10-05',
      grandTotal: '10700.00',
      currency: 'THB',
      fileHash: 'sha256_hash_different',
      status: 'needs_review',
      revisionNumber: 1,
    },
    {
      id: 'doc_501_office_b',
      officeId: officeB_id,
      clientId: clientB1_id,
      periodId: 'p2',
      documentNumber: 'INV-2026-0001',
      fileHash: 'sha256_hash_abc_123',
      status: 'needs_review',
      revisionNumber: 1,
    },
  ];

  const repo = new TenantRepository(mockDocuments);

  it('[DR-502 Invariant] Optimistic concurrency control raises RevisionConflictError (409) on mismatch', async () => {
    const scope = { officeId: officeA_id, clientId: clientA1_id };

    // Update with correct expectedRevision = 1
    const updated = await repo.updateDocumentFields(scope, 'doc_501_a', { sellerName: 'บริษัท ใหม่ จำกัด' }, 1);
    expect(updated.revisionNumber).toBe(2);

    // Concurrently attempting to update with stale expectedRevision = 1 should throw RevisionConflictError
    await expect(
      repo.updateDocumentFields(scope, 'doc_501_a', { sellerName: 'อีกพนักงานชนกัน' }, 1)
    ).rejects.toThrow(RevisionConflictError);
  });

  it('[DR-503 Invariant] Scopes exact hash duplicate search to tenant without cross-tenant hash leakage', async () => {
    const scopeOfficeA = { officeId: officeA_id, clientId: clientA1_id };
    const hashMatchesA = await repo.findHashDuplicates(scopeOfficeA, 'sha256_hash_abc_123');
    expect(hashMatchesA).toHaveLength(1);
    expect(hashMatchesA[0]?.id).toBe('doc_501_a');

    // Office B cannot query Office A's document even with identical file hash
    const scopeOfficeB = { officeId: officeB_id, clientId: clientB1_id };
    const hashMatchesB = await repo.findHashDuplicates(scopeOfficeB, 'sha256_hash_abc_123');
    expect(hashMatchesB).toHaveLength(1);
    expect(hashMatchesB[0]?.id).toBe('doc_501_office_b');
  });

  it('[DR-503 & DR-504] Detects semantic duplicate candidates within tenant scope for human review', async () => {
    const scope = { officeId: officeA_id, clientId: clientA1_id };
    const candidates = await repo.findSemanticDuplicateCandidates(scope, 'doc_501_a');

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.candidate.id).toBe('doc_501_b');
    expect(candidates[0]?.score).toBeGreaterThanOrEqual(0.8);
    expect(candidates[0]?.matchReasons.length).toBeGreaterThan(0);
  });

  it('[DR-504 Invariant] Forces Invoice + Receipt pairing to "supports" instead of duplicate_of', () => {
    const relation = validateRelationType('invoice', 'receipt', 'duplicate_of');
    expect(relation).toBe('supports');

    const duplicateRelation = validateRelationType('tax_invoice', 'tax_invoice', 'duplicate_of');
    expect(duplicateRelation).toBe('duplicate_of');
  });

  it('[DR-504] Records confirmed document relation link between documents', async () => {
    const scope = { officeId: officeA_id, clientId: clientA1_id };
    const relation = await repo.createDocumentRelation(scope, 'doc_501_a', 'doc_501_b', 'supports', 'user_acc_reviewer');

    expect(relation.relationType).toBe('supports');
    expect(relation.confirmedByUserId).toBe('user_acc_reviewer');

    const list = await repo.getDocumentRelations(scope, 'doc_501_a');
    expect(list).toHaveLength(1);
    expect(list[0]?.targetDocumentId).toBe('doc_501_b');
  });
});
