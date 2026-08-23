import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Runs before any test module is imported, which matters: module-level
    // vectors are allocated at import time and cannot be converted afterwards.
    setupFiles: ['./test/setup.mjs'],
  },
});
