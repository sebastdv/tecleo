import type { NextRequest } from 'next/server';

/**
 * La API se sirve bajo el mismo dominio que la web (`/api/*` → server) para que la cookie
 * httpOnly del refresh token sea de primera parte. El reenvío lo hace este handler (y no un
 * rewrite) para controlar las cabeceras: con `PROXY_SECRET`, el server recibe la IP del
 * cliente firmada; si no, vería la del proxy y todos compartirían el límite de login.
 */

/** Cabeceras de un solo salto o que el reenvío debe recalcular. */
const SKIP_REQUEST = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'x-tecleo-client-ip',
  'x-tecleo-proxy-secret',
]);
/** `fetch` ya descomprime el cuerpo: no se reenvían su codificación ni su largo. */
const SKIP_RESPONSE = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'set-cookie',
]);

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  // Una cabecera vacía no es una IP: se pasa a la siguiente.
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip');
}

async function forward(
  request: NextRequest,
  { params }: RouteContext<'/api/[...path]'>,
): Promise<Response> {
  const { path } = await params;
  const server = process.env.SERVER_URL ?? 'http://localhost:4100';
  const target = new URL(
    `/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`,
    server,
  );

  const headers = new Headers();
  for (const [name, value] of request.headers) {
    if (!SKIP_REQUEST.has(name)) headers.set(name, value);
  }
  const secret = process.env.PROXY_SECRET;
  const ip = clientIp(request);
  if (secret && ip) {
    headers.set('x-tecleo-client-ip', ip);
    headers.set('x-tecleo-proxy-secret', secret);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const response = await fetch(target, {
    method: request.method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
    ...(hasBody && { body: await request.arrayBuffer() }),
  });

  const out = new Headers();
  for (const [name, value] of response.headers) {
    if (!SKIP_RESPONSE.has(name)) out.set(name, value);
  }
  // Varias cookies no se pueden unir en una sola cabecera: van una por una.
  for (const cookie of response.headers.getSetCookie()) out.append('set-cookie', cookie);
  return new Response(response.body, { status: response.status, headers: out });
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };
