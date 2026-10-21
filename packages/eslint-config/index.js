import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Configuración base con reglas que usan información de tipos.
 * Cada workspace la extiende pasando su `tsconfigRootDir`.
 *
 * @param {{ tsconfigRootDir: string, env?: 'node' | 'browser' }} options
 */
export function base({ tsconfigRootDir, env = 'node' }) {
  return tseslint.config(
    { ignores: ['dist/**', 'coverage/**', '.next/**', '.turbo/**', 'next-env.d.ts'] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        globals: env === 'node' ? globals.node : globals.browser,
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    prettier,
  );
}
