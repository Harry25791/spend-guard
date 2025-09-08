// eslint.config.mjs
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default tseslint.config(
  // Ignore build artifacts
  { ignores: ['.next/**', 'dist/**', 'coverage/**'] },

  // Type-aware TS base (needs tsconfig.eslint.json)
  ...tseslint.configs.recommendedTypeChecked,

  // Repo-wide TypeScript rules
  {
    languageOptions: {
      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: process.cwd() },
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true, ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }]
    }
  },

  // React/Next rules only on JSX/TSX files
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      '@next/next': nextPlugin,
      react: reactPlugin,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    settings: {
      react: { version: 'detect' },
      next: { rootDir: ['.'] }
    },
    rules: {
      // Next core web vitals bundle
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Hooks correctness
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  // Tests: allow `any`
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' }
  }
);
