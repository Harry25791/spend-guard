// eslint.config.mjs
import next from 'eslint-config-next';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 1) Ignore generated/build outputs
  { ignores: ['.next/**', 'dist/**', 'coverage/**'] },

  // 2) Next.js & TypeScript (type-aware)
  ...tseslint.configs.recommendedTypeChecked, // needs project below
  next,

  // 3) Base rules for the repo
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: process.cwd()
      },
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // Long-term strictness:
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true, ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Keep hooks rule strict; silence false positives case-by-case if needed
      'react-hooks/exhaustive-deps': 'warn'
    },
    settings: { next: { rootDir: ['.'] } }
  },

  // 4) Tests can be looser (allow `any` in tests)
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
