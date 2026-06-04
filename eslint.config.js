// Flat config (ESLint 9+/10). Ported from the former .eslintrc.json.
const tseslint = require('typescript-eslint');
const prettierRecommended = require('eslint-plugin-prettier/recommended');
const unusedImports = require('eslint-plugin-unused-imports');

module.exports = tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/lib/**'],
  },
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ['**/*.ts'],
    plugins: {
      'unused-imports': unusedImports,
    },
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // Renamed from the former no-var-requires; keep require() allowed.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
