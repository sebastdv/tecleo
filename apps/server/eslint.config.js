import { base } from '@tecleo/eslint-config';

export default [
  ...base({ tsconfigRootDir: import.meta.dirname }),
  {
    rules: {
      // Los módulos de Nest son clases vacías con decoradores.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // supertest tipa el cuerpo de la respuesta como `any`; las aserciones lo validan.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
];
