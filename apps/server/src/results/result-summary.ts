import type { ResultSummary } from '@tecleo/shared';

import type { RaceResult } from '../generated/prisma/client.js';

export function toResultSummary(result: RaceResult & { runners: number }): ResultSummary {
  return {
    id: result.id,
    raceId: result.raceId,
    mode: result.mode,
    language: result.language === 'en' ? 'en' : 'es',
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    consistency: result.consistency,
    durationMs: result.durationMs,
    completed: result.completed,
    position: result.position,
    runners: result.runners,
    ignoreAccents: result.ignoreAccents,
    flagged: result.flagged,
    createdAt: result.createdAt.toISOString(),
  };
}
