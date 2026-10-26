import { timingSafeEqual } from 'node:crypto';

export const CLIENT_IP_HEADER = 'x-tecleo-client-ip';
export const PROXY_SECRET_HEADER = 'x-tecleo-proxy-secret';

export interface RequestLike {
  readonly ip?: string | undefined;
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
}

function header(request: RequestLike, name: string): string | undefined {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** ¿La IP del cliente viene del proxy de la web (con el secreto correcto) o de la conexión? */
export function clientIpSource(
  request: RequestLike,
  proxySecret: string | undefined,
): 'proxy' | 'connection' {
  const forwarded = header(request, CLIENT_IP_HEADER);
  const secret = header(request, PROXY_SECRET_HEADER);
  return proxySecret && secret && forwarded && sameSecret(secret, proxySecret)
    ? 'proxy'
    : 'connection';
}

/**
 * IP del cliente para el rate limiting. Detrás del proxy de la web (Vercel → Render) la IP de
 * la conexión es la del proxy: la del cliente llega en una cabecera que solo se acepta junto
 * con el secreto compartido (`PROXY_SECRET`); sin él, cualquiera podría inventarse una IP.
 */
export function clientIp(request: RequestLike, proxySecret: string | undefined): string {
  const forwarded = header(request, CLIENT_IP_HEADER);
  if (forwarded && clientIpSource(request, proxySecret) === 'proxy') return forwarded;
  return request.ip ?? 'unknown';
}
