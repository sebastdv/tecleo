import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './i18n/routing';

const intl = createMiddleware(routing);
const SERVER_URL = process.env.SERVER_URL ?? 'http://localhost:4100';

/** IP del cliente según el proxy que tenga delante (Vercel la pone primera en x-forwarded-for). */
function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded ?? request.headers.get('x-real-ip');
}

/**
 * La API se sirve bajo el mismo dominio que la web (`/api/*` → server) para que la cookie
 * httpOnly del refresh token sea de primera parte. Con `PROXY_SECRET`, se le pasa al server la
 * IP del cliente firmada: si no, el server vería la IP del proxy y todos compartirían el límite
 * de intentos de login.
 */
function proxyApi(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const target = new URL(`${pathname.slice('/api'.length)}${search}`, SERVER_URL);
  const headers = new Headers(request.headers);
  headers.delete('x-tecleo-client-ip');
  headers.delete('x-tecleo-proxy-secret');
  const secret = process.env.PROXY_SECRET;
  const ip = clientIp(request);
  if (secret && ip) {
    headers.set('x-tecleo-client-ip', ip);
    headers.set('x-tecleo-proxy-secret', secret);
  }
  return NextResponse.rewrite(target, { request: { headers } });
}

/** API al server; el resto, redirigido a /es o /en según la cookie o `Accept-Language`. */
export default function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) return proxyApi(request);
  return intl(request);
}

export const config = {
  // Todo menos los archivos internos de Next y los que tienen extensión.
  matcher: '/((?!_next|_vercel|.*\\..*).*)',
};
