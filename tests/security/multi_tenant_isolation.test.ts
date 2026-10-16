import { describe, it, expect } from 'vitest';
import { TenantRepository, DocumentRecord } from '@docready/db';
import { preserveStringIdentifier } from '@docready/domain';
import { validateFileMagicBytes } from '@docready/files';
import { sanitizeExportPath, escapeExcelFormulaCell } from '@docready/exports';

describe('Phase S1 Security Isolation & Architectural Invariants Suite', () => {
  const officeA_id = '11111111-1111-1111-1111-111111111111';
  const officeB_id = '22222222-2222-2222-2222-222222222222';
  const clientA1_id = 'a1111111-1111-1111-1111-111111111111';
  const clientA2_id = 'a2222222-2222-2222-2222-222222222222';
  const clientB1_id = 'b1111111-1111-1111-1111-111111111111';

  const mockDocuments: DocumentRecord[] = [
    {
      id: 'doc_a1_001',
      officeId: officeA_id,
      clientId: clientA1_id,
      periodId: 'period_202610',
      documentNumber: 'INV-00123',
      status: 'received',
    },
    {
      id: 'doc_a2_001',
      officeId: officeA_id,
      clientId: clientA2_id,
      periodId: 'period_202610',
      documentNumber: 'INV-00456',
      status: 'received',
    },
    {
      id: 'doc_b1_001',
      officeId: officeB_id,
      clientId: clientB1_id,
      periodId: 'period_202610',
      documentNumber: 'INV-00789',
      status: 'received',
    },
  ];

  const repo = new TenantRepository(mockDocuments);

  it('[T-01] User in Office A cannot access documents belonging to Office B', async () => {
    const scopeOfficeA = { officeId: officeA_id };
    const docs = await repo.getDocuments(scopeOfficeA);
    const officeBDocs = docs.filter((d) => d.officeId === officeB_id);
    expect(officeBDocs).toHaveLength(0);
  });

  it('[T-02] Staff in Office A assigned to Client A1 cannot access Client A2 documents', async () => {
    const scopeClientA1 = { officeId: officeA_id, clientId: clientA1_id };
    const docs = await repo.getDocuments(scopeClientA1);
    expect(docs).toHaveLength(1);
    expect(docs[0]?.id).toBe('doc_a1_001');

    const unaccessibleDoc = await repo.getDocumentById(scopeClientA1, 'doc_a2_001');
    expect(unaccessibleDoc).toBeNull();
  });

  it('[T-12 Invariant] Document numbers and tax IDs preserve string formatting and leading zeroes', () => {
    const docNumber = preserveStringIdentifier('0004812');
    expect(docNumber).toBe('0004812');
    expect(typeof docNumber).toBe('string');
  });

  it('[T-04 Invariant] Validates file magic bytes to reject corrupted/malformed uploads', () => {
    const validPdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const malformedBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);

    expect(validateFileMagicBytes(validPdfBuffer, 'application/pdf')).toBe(true);
    expect(validateFileMagicBytes(malformedBuffer, 'application/pdf')).toBe(false);
  });

  it('[T-25 Invariant] Sanitizes export file paths against ZIP path traversal and formula injection', () => {
    const dangerousPath = '../../etc/passwd';
    const sanitizedPath = sanitizeExportPath(dangerousPath);
    expect(sanitizedPath).not.toContain('..');

    const dangerousFormula = '=SUM(1,2)';
    const escapedFormula = escapeExcelFormulaCell(dangerousFormula);
    expect(escapedFormula).toBe("'=SUM(1,2)");
  });
});
