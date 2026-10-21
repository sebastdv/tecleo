import { base } from '@tecleo/eslint-config';

export default [
  ...base({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // Los módulos de Nest son clases vacías con decoradores.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
];
