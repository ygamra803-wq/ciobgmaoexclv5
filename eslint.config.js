import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'dev-dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'scripts/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      // Handled natively and more accurately by TypeScript compiler (tsc --noEmit)
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'react/prop-types': 'off',
      'no-empty': 'off',
      'react/no-unescaped-entities': 'off',
      // LINT-DEPS-P1: Global exhaustive-deps remains 'off' (legacy UI views/hooks debt documented; do not enable globally yet).
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
    settings: {
      react: { version: '19.2' },
    },
  },
  // LINT-DEPS-P1: Progressive scoped 'warn' on clean directories (expanded as views/hooks are refactored)
  {
    files: [
      'src/utils/**/*.{ts,tsx}',
      'src/application/repositories/**/*.{ts,tsx}',
      'src/presentation/pages/corrective/hooks/**/*.{ts,tsx}',
      'src/presentation/pages/corrective/components/InterventionLive*.{ts,tsx}',
      'src/presentation/pages/corrective/InterventionLiveTab.tsx',
    ],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
