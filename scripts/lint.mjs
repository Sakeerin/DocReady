import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const errors = [];

function walkFiles(dir, extensions) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === 'dist' ||
      entry.name === '.git'
    ) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// 1. Check TypeScript files in apps/ and packages/ for explicit `any` or public bucket flags
const tsFiles = [
  ...walkFiles(join(rootDir, 'apps'), ['.ts', '.tsx']),
  ...walkFiles(join(rootDir, 'packages'), ['.ts', '.tsx']),
];

for (const file of tsFiles) {
  const rel = relative(rootDir, file);
  const content = readFileSync(file, 'utf8');

  if (/:\s*any\b|\bas\s+any\b/.test(content)) {
    errors.push(`[Strict-TS] Explicit 'any' found in ${rel}`);
  }
  if (/public\s*:\s*true/i.test(content)) {
    errors.push(`[Storage-Security] Public bucket configuration ('public: true') found in ${rel}`);
  }
}

// 2. Check SQL Migrations for broken table names and RLS completeness
const migrationsDir = join(rootDir, 'supabase', 'migrations');
const sqlFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const combinedSql = sqlFiles
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

if (combinedSql.includes('accounting_offices') || combinedSql.includes('document_periods')) {
  errors.push('[SQL-Schema] Found invalid table reference (accounting_offices or document_periods)');
}

const tableMatches = [
  ...combinedSql.matchAll(/CREATE TABLE IF NOT EXISTS (?:public\.)?([a-z0-9_]+)/gi),
];
for (const match of tableMatches) {
  const table = match[1];
  const enableRls = new RegExp(
    `ALTER TABLE (?:public\\.)?${table} ENABLE ROW LEVEL SECURITY`,
    'i'
  ).test(combinedSql);
  const forceRls = new RegExp(
    `ALTER TABLE (?:public\\.)?${table} FORCE ROW LEVEL SECURITY`,
    'i'
  ).test(combinedSql);
  const hasPolicy = new RegExp(
    `CREATE POLICY [a-z0-9_]+ ON (?:public\\.)?${table}\\b`,
    'i'
  ).test(combinedSql);

  if (!enableRls || !forceRls || !hasPolicy) {
    errors.push(
      `[SQL-RLS] Table '${table}' is missing ENABLE RLS (${enableRls}), FORCE RLS (${forceRls}), or CREATE POLICY (${hasPolicy})`
    );
  }
}

// 3. Check Worker diagnostic log redaction (DR-804)
const workerIndex = readFileSync(join(rootDir, 'apps', 'worker', 'src', 'index.ts'), 'utf8');
if (!workerIndex.includes('redactDiagnosticText')) {
  errors.push('[DR-804] Worker must use redactDiagnosticText for diagnostic logging');
}

// 4. Check workspace package.json scripts hygiene
const pkgDirs = [
  join(rootDir, 'apps', 'web'),
  join(rootDir, 'apps', 'worker'),
  ...readdirSync(join(rootDir, 'packages')).map((p) => join(rootDir, 'packages', p)),
];

for (const pkgDir of pkgDirs) {
  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  if (!pkg.scripts?.typecheck || !pkg.scripts?.build) {
    errors.push(`[Workspace] ${pkg.name} is missing 'typecheck' or 'build' script in package.json`);
  }
}

if (errors.length > 0) {
  console.error('DocReady Architectural & Code Linter failed with errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `[DocReady Lint] Passed! Checked ${tsFiles.length} TypeScript files, ${sqlFiles.length} SQL migrations (${tableMatches.length} tables), and ${pkgDirs.length} workspace packages.`
);
