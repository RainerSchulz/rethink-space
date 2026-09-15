import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist', 'node_modules', 'tests/playwright-report', 'test-results', '_old_assets'] },

  // Website-Code: Browser-Globals
  {
    files: ['src/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // Tests + Config: Node- und Vitest-Globals
  {
    files: ['tests/**/*.js', '*.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser, ...globals.vitest },
    },
  },
];
