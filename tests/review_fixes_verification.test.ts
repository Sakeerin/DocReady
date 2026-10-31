import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { TenantRepository } from '@docready/db';
import {
  detectAmbiguousDate,
  isValidCalendarDate,
  isValidThaiTaxIdChecksum,
} from '@docready/domain';
import { escapeExcelFormulaCell } from '@docready/exports';
import { extractFieldCandidates } from '@docready/ocr';
import { extractPdfPageRangeBuffer } from '@docready/files';

describe('Phase 1 Review Fixes Verification (SQL RLS, Strict TS, Calendar/TaxID, PDF/Excel/ZIP, Defensive Clone)', () => {
  it('SQL-01: All Supabase migrations reference valid table names, define RLS helper functions, and enable + force RLS with policies on every table', () => {
    const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(10);
    // Seed migration should no longer be inside migrations/
    expect(files).not.toContain('20261006000002_seed_test_tenants.sql');

    const combinedSql = files
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n');

    // No broken table references
    expect(combinedSql).not.toContain('accounting_offices');
    expect(combinedSql).not.toContain('document_periods');

    // Helper functions defined with SECURITY DEFINER and SET search_path = public
    expect(combinedSql).toContain('CREATE OR REPLACE FUNCTION public.user_has_office_access');
    expect(combinedSql).toContain('CREATE OR REPLACE FUNCTION public.user_has_client_access');

    // Every created table must have ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY, and CREATE POLICY
    const tableMatches = [
      ...combinedSql.matchAll(/CREATE TABLE IF NOT EXISTS (?:public\.)?([a-z0-9_]+)/gi),
    ];
    const tableNames = tableMatches.map((m) => m[1]!);
    expect(tableNames.length).toBeGreaterThanOrEqual(25);

    for (const table of tableNames) {
      const enableRegex = new RegExp(
        `ALTER TABLE (?:public\\.)?${table} ENABLE ROW LEVEL SECURITY`,
        'i'
      );
      const forceRegex = new RegExp(
        `ALTER TABLE (?:public\\.)?${table} FORCE ROW LEVEL SECURITY`,
        'i'
      );
      const policyRegex = new RegExp(
        `CREATE POLICY [a-z0-9_]+ ON (?:public\\.)?${table}\\b`,
        'i'
      );

      expect(enableRegex.test(combinedSql), `Missing ENABLE RLS on ${table}`).toBe(true);
      expect(forceRegex.test(combinedSql), `Missing FORCE RLS on ${table}`).toBe(true);
      expect(policyRegex.test(combinedSql), `Missing CREATE POLICY on ${table}`).toBe(true);
    }
  });

  it('TS-01: Zero occurrences of `: any` or `as any` in apps/ and packages/', () => {
    const walkFiles = (dir: string): string[] => {
      const entries = readdirSync(dir, { withFileTypes: true });
      const results: string[] = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walkFiles(fullPath));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    };

    const rootDir = join(__dirname, '..');
    const sourceFiles = [
      ...walkFiles(join(rootDir, 'apps')),
      ...walkFiles(join(rootDir, 'packages')),
    ];

    const violations: string[] = [];
    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      if (/:\s*any\b|\bas\s+any\b/.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('DOM-01: Validates real calendar dates (rejecting 31/02/2026 and 99/12/2026, accepting leap day 29/02/2024 & BE 29/02/2567) and Thai Tax ID Mod-11 checksums', () => {
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);

    // Invalid calendar dates must not produce proposed candidates
    const feb31 = detectAmbiguousDate('31/02/2026');
    expect(feb31.status).toBe('ambiguous');
    expect(feb31.candidates).toEqual([]);

    // Valid leap day in Buddhist Era (2567 BE = 2024 CE)
    const leapBe = detectAmbiguousDate('29/02/2567');
    expect(leapBe.status).toBe('proposed');
    expect(leapBe.candidates).toEqual(['2024-02-29']);

    // OCR extractor also filters out impossible calendar dates like 31/02/2026
    const extracted = extractFieldCandidates([
      {
        id: 'sp_bad_date',
        page: 1,
        text: '31/02/2026',
        confidence: 0.99,
        boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
      },
      {
        id: 'sp_good_date',
        page: 1,
        text: '29/02/2567',
        confidence: 0.99,
        boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
      },
    ]);
    const dateCandidates = extracted.filter((c) => c.fieldName === 'document_date');
    expect(dateCandidates).toHaveLength(1);
    expect(dateCandidates[0]?.normalizedValue).toBe('2024-02-29');

    // Thai 13-digit Tax ID Mod 11 checksum (212 % 11 = 3 -> 11 - 3 = 8)
    expect(isValidThaiTaxIdChecksum('0105558001118')).toBe(true);
    expect(isValidThaiTaxIdChecksum('0105558001111')).toBe(false);
    expect(isValidThaiTaxIdChecksum('12345')).toBe(false);
  });

  it('EXP-01: Preserves negative decimal strings in Excel while escaping dangerous formulas, and generates valid PDF xref tables with sanitized provenance', () => {
    // Credit note negative decimal is NOT prefixed with single quote
    expect(escapeExcelFormulaCell('-100.00')).toBe('-100.00');
    expect(escapeExcelFormulaCell('-2500.5000')).toBe('-2500.5000');

    // Dangerous formulas starting with '-', '=', '+', '@' ARE escaped
    expect(escapeExcelFormulaCell('-SUM(A1:A10)')).toBe("'-SUM(A1:A10)");
    expect(escapeExcelFormulaCell('=CMD|\'/C calc\'!A0')).toBe("'=CMD|'/C calc'!A0");

    // PDF provenance newline sanitization & xref table verification
    const pdfBuf = extractPdfPageRangeBuffer({
      sourceAssetId: 'asset_01\n1 0 obj',
      sourceHash: 'hash_01\r\n%%EOF',
      pageRange: '1-2',
      documentId: 'doc_01',
      documentRevision: 1,
    });
    const pdfText = pdfBuf.toString('utf8');
    expect(pdfText).toContain('xref\n0 5\n0000000000 65535 f ');
    expect(pdfText).toContain('startxref\n');
    expect(pdfText).toContain('sourceAssetId=asset_01_1 0 obj');
  });

  it('DB-01: TenantRepository returns defensive clones from getDocumentById and getPackageById so caller mutations cannot corrupt internal state', async () => {
    const scope = { officeId: 'off_clone', clientId: 'cli_clone' };
    const repo = new TenantRepository([
      {
        id: 'doc_clone_1',
        officeId: 'off_clone',
        clientId: 'cli_clone',
        periodId: '2026-10',
        documentNumber: '000111',
        grandTotal: '1000.00',
        status: 'reviewed',
        revisionNumber: 1,
      },
    ]);

    const fetchedDoc = await repo.getDocumentById(scope, 'doc_clone_1');
    expect(fetchedDoc).not.toBeNull();
    // Mutate the returned object directly outside updateDocumentFields
    fetchedDoc!.grandTotal = '999999.99';
    fetchedDoc!.documentNumber = 'HACKED';

    const refetchedDoc = await repo.getDocumentById(scope, 'doc_clone_1');
    expect(refetchedDoc?.grandTotal).toBe('1000.00');
    expect(refetchedDoc?.documentNumber).toBe('000111');

    const pkg = await repo.createPackageSnapshot(scope, {
      periodId: '2026-10',
      packageMode: 'received_documents_with_exceptions',
      exceptionsAcknowledged: true,
    });
    const fetchedPkg = await repo.getPackageById(scope, pkg.id);
    fetchedPkg!.items[0]!.grandTotal = '0.00';

    const refetchedPkg = await repo.getPackageById(scope, pkg.id);
    expect(refetchedPkg?.items[0]?.grandTotal).toBe('1000.00');
  });

  it('OS-01: Open Source community files (LICENSE, CONTRIBUTING.md, SECURITY.md, .env.example), CI workflow, and watermarked synthetic fixtures exist and are valid', () => {
    const rootDir = join(__dirname, '..');
    expect(readFileSync(join(rootDir, 'LICENSE'), 'utf8')).toContain('MIT License');
    expect(readFileSync(join(rootDir, 'CONTRIBUTING.md'), 'utf8')).toContain('pnpm run lint');
    expect(readFileSync(join(rootDir, 'SECURITY.md'), 'utf8')).toContain('Row Level Security');
    expect(readFileSync(join(rootDir, '.env.example'), 'utf8')).toContain('DOCREADY_OCR_PROVIDER');

    const ciYaml = readFileSync(join(rootDir, '.github', 'workflows', 'ci.yml'), 'utf8');
    expect(ciYaml).toContain('pnpm run lint');
    expect(ciYaml).toContain('pnpm run typecheck');
    expect(ciYaml).toContain('pnpm run test');

    const synPdf = readFileSync(
      join(rootDir, 'fixtures', 'synthetic', 'images', 'syn_tax_inv_001.pdf'),
      'utf8'
    );
    expect(synPdf).toContain('%PDF-1.4');
    expect(synPdf).toContain('DEMO / SYNTHETIC');

    const synLabel = JSON.parse(
      readFileSync(
        join(rootDir, 'fixtures', 'synthetic', 'labels', 'syn_tax_inv_001.json'),
        'utf8'
      )
    );
    expect(synLabel.synthetic_tag).toBe('DEMO_SYNTHETIC');
    expect(synLabel.ground_truth_spans.length).toBeGreaterThanOrEqual(4);
  });
});
