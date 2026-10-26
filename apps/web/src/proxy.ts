import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

/** Redirige las rutas sin idioma a /es o /en según la cookie o `Accept-Language`. */
export default createMiddleware(routing);

export const config = {
  // Todo menos la API (la reenvía `app/api/[...path]/route.ts`), los archivos internos de Next
  // y los que tienen extensión.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
