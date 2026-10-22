import { describe, expect, it } from 'vitest';

import { estimateClock, roomCodeSchema, roomJoinSchema, raceProgressSchema } from './realtime.js';

describe('estimateClock', () => {
  it('usa la muestra con menor ida y vuelta y asume respuesta a mitad de camino', () => {
    // Servidor 1000 ms adelantado. Muestra lenta (rtt 300) con asimetría, muestra rápida (rtt 40).
    const estimate = estimateClock([
      { sent: 0, server: 1_250, received: 300 },
      { sent: 500, server: 1_520, received: 540 },
    ]);
    expect(estimate).toEqual({ offset: 1_000, rtt: 40 });
  });

  it('descarta muestras imposibles y falla sin ninguna válida', () => {
    expect(() => estimateClock([{ sent: 10, server: 0, received: 5 }])).toThrow();
  });
});

describe('contratos de sala', () => {
  it('normaliza el código de sala y rechaza caracteres ambiguos', () => {
    expect(roomCodeSchema.parse(' abc234 ')).toBe('ABC234');
    expect(roomCodeSchema.safeParse('ABCDE0').success).toBe(false);
    expect(roomCodeSchema.safeParse('ABCDEI').success).toBe(false);
  });

  it('distingue unirse a una sala privada de buscar una pública', () => {
    expect(roomJoinSchema.parse({ mode: 'public', language: 'en' })).toEqual({
      mode: 'public',
      language: 'en',
    });
    expect(roomJoinSchema.safeParse({ mode: 'private' }).success).toBe(false);
  });

  it('rechaza progreso malformado', () => {
    expect(
      raceProgressSchema.safeParse({ charIndex: -1, errors: 0, wpm: 0, clientTime: 0 }).success,
    ).toBe(false);
    expect(
      raceProgressSchema.safeParse({ charIndex: 1, errors: 0, wpm: 1e9, clientTime: 0 }).success,
    ).toBe(false);
  });
});
