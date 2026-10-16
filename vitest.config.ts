import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@docready/contracts': path.resolve(__dirname, './packages/contracts/src/index.ts'),
      '@docready/domain': path.resolve(__dirname, './packages/domain/src/index.ts'),
      '@docready/db': path.resolve(__dirname, './packages/db/src/index.ts'),
      '@docready/ocr': path.resolve(__dirname, './packages/ocr/src/index.ts'),
      '@docready/ai': path.resolve(__dirname, './packages/ai/src/index.ts'),
      '@docready/files': path.resolve(__dirname, './packages/files/src/index.ts'),
      '@docready/exports': path.resolve(__dirname, './packages/exports/src/index.ts'),
    },
  },
});
