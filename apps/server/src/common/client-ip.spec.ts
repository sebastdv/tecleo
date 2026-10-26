import { describe, expect, it } from 'vitest';

import { clientIp, clientIpSource } from './client-ip.js';

const SECRET = 'un-secreto-compartido-largo';

describe('clientIp', () => {
  it('usa la IP que manda el proxy solo si trae el secreto correcto', () => {
    const headers = { 'x-tecleo-client-ip': '203.0.113.7', 'x-tecleo-proxy-secret': SECRET };
    expect(clientIp({ ip: '10.0.0.1', headers }, SECRET)).toBe('203.0.113.7');
    expect(clientIpSource({ headers }, SECRET)).toBe('proxy');
    expect(clientIpSource({ headers }, 'otro-secreto-cualquiera-largo')).toBe('connection');
  });

  it('ignora la cabecera sin secreto, con otro secreto o sin secreto configurado', () => {
    const forged = { 'x-tecleo-client-ip': '198.51.100.9' };
    expect(clientIp({ ip: '10.0.0.1', headers: forged }, SECRET)).toBe('10.0.0.1');
    expect(
      clientIp({ ip: '10.0.0.1', headers: { ...forged, 'x-tecleo-proxy-secret': 'otro' } }, SECRET),
    ).toBe('10.0.0.1');
    expect(
      clientIp(
        { ip: '10.0.0.1', headers: { ...forged, 'x-tecleo-proxy-secret': SECRET } },
        undefined,
      ),
    ).toBe('10.0.0.1');
  });
});
