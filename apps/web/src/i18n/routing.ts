import { LANGUAGES } from '@tecleo/shared';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: LANGUAGES,
  defaultLocale: 'es',
  // Siempre con prefijo (/es/..., /en/...): cada idioma se prerenderiza por separado.
  localePrefix: 'always',
});
