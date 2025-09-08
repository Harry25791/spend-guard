// eslint.config.mjs
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  // 1) Ignore build outputs & coverage
  { ignores: ['.next/**', 'dist/**', 'coverage/**'] },

  // 2) Type-aware TS rules (needs tsconfig.eslint.json)
  ...tseslint.configs.recommendedTypeChecked,

  // 3) Project rules + Next plugin
  {
    plugins: { '@next/next': nextPlugin },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: process.cwd()
      },
      globals: { ...globals.browser, ...globals.node }
    },
    rules: {
      // Next's core-web-vitals recommendations
      ...nextPlugin.configs['core-web-vitals'].rules,

      // Long-term strictness
      '@typescript-eslint/no-explicit-any': ['error', { fixToUnknown: true, ignoreRestArgs: true }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/exhaustive-deps': 'warn'
    }
  },

  // 4) Loosen tests slightly
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
