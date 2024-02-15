// @ts-nocheck

import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';

export default [
  { ignores: [`coverage/`, `lib/`] },
  { languageOptions: { ecmaVersion: 2022, sourceType: `module`, globals: { ...globals.browser } } },
  js.configs.recommended,

  {
    rules: {
      'complexity': `error`,
      'eqeqeq': [`error`, `always`, { null: `ignore` }],

      'no-restricted-globals': [
        `error`,
        { name: `__dirname`, message: `Use "dirname(fileURLToPath(import.meta.url))" instead.` },
        { name: `__filename`, message: `Use "fileURLToPath(import.meta.url)" instead.` },
      ],

      'no-shadow': `error`,
      'object-shorthand': `error`,
      'prefer-const': [`error`, { destructuring: `all` }],
      'quotes': [`error`, `backtick`],
      'sort-imports': `error`,
    },
  },

  ...[
    ...ts.configs.recommendedTypeChecked,
    { languageOptions: { parserOptions: { project: true } } },

    {
      rules: {
        '@typescript-eslint/consistent-type-imports': `error`,

        '@typescript-eslint/explicit-module-boundary-types': [
          `error`,
          { allowDirectConstAssertionInArrowFunctions: true },
        ],

        '@typescript-eslint/no-import-type-side-effects': `error`,
        '@typescript-eslint/no-require-imports': `error`,
        '@typescript-eslint/no-shadow': [`error`, { hoist: `all` }],
        '@typescript-eslint/promise-function-async': `error`,
        '@typescript-eslint/quotes': [`error`, `backtick`],
        'no-shadow': `off`,
        'quotes': `off`,
      },
    },
  ].map((config) => ({ ...config, files: [`**/*.ts`, `**/*.tsx`, `**/*.mts`, `**/*.cts`] })),

  {
    files: [`**/*.cjs`, `**/*.cts`],
    rules: {
      '@typescript-eslint/no-require-imports': `off`,
      'no-restricted-globals': `off`,
    },
  },
];
