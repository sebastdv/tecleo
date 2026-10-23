import { describe, expect, it } from 'vitest';

import {
  AVATAR_UNLOCKS,
  earnedAchievements,
  isUnlocked,
  levelFromXp,
  levelProgress,
  MAX_RACE_XP,
  raceXp,
  xpForLevel,
  type AchievementStats,
} from './progression.js';

const base = {
  wpm: 60,
  accuracy: 100,
  correctChars: 300,
  completed: true,
  position: null,
  runners: 1,
  flagged: false,
};

describe('XP por prueba', () => {
  it('crece con la longitud, la velocidad y sobre todo la precisión', () => {
    expect(raceXp(base)).toBe(30);
    expect(raceXp({ ...base, correctChars: 600 })).toBe(60);
    expect(raceXp({ ...base, wpm: 120 })).toBe(60);
    expect(raceXp({ ...base, accuracy: 90 })).toBe(24);
  });

  it('premia los rivales que quedaron detrás y ganar', () => {
    expect(raceXp({ ...base, position: 1, runners: 4 })).toBe(30 + 12 + 10);
    expect(raceXp({ ...base, position: 4, runners: 4 })).toBe(30);
  });

  it('lo marcado o vacío no suma, lo incompleto vale la mitad y hay un tope', () => {
    expect(raceXp({ ...base, flagged: true })).toBe(0);
    expect(raceXp({ ...base, correctChars: 0 })).toBe(0);
    expect(raceXp({ ...base, completed: false })).toBe(15);
    expect(raceXp({ ...base, correctChars: 100_000, wpm: 500 })).toBe(MAX_RACE_XP);
  });
});

describe('niveles', () => {
  it('cada nivel pide más XP que el anterior', () => {
    expect([1, 2, 3, 4, 5, 10].map(xpForLevel)).toEqual([0, 100, 300, 600, 1_000, 4_500]);
  });

  it('el nivel sale de la XP total, incluidos los bordes exactos', () => {
    for (let level = 1; level <= 60; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
      expect(levelFromXp(xpForLevel(level + 1) - 1)).toBe(level);
    }
    expect(levelFromXp(-5)).toBe(1);
  });

  it('informa cuánto falta para el siguiente', () => {
    expect(levelProgress(450)).toEqual({ level: 3, current: 150, needed: 300 });
  });
});

describe('logros y desbloqueos', () => {
  const none: AchievementStats = {
    races: 0,
    wins: 0,
    bestWpm: 0,
    perfect: 0,
    online: 0,
    daily: 0,
    ghostWins: 0,
    level: 1,
  };

  it('sin pruebas no hay logros; cada umbral se cumple al alcanzarlo', () => {
    expect(earnedAchievements(none)).toEqual([]);
    expect(earnedAchievements({ ...none, races: 1, bestWpm: 80 })).toEqual([
      'first-race',
      'wpm-60',
      'wpm-80',
    ]);
    expect(earnedAchievements({ ...none, races: 100 })).toContain('races-100');
    expect(earnedAchievements({ ...none, level: 5, perfect: 1 })).toEqual(['perfect', 'level-5']);
  });

  it('los avatares se desbloquean por nivel o por logro', () => {
    expect(isUnlocked(AVATAR_UNLOCKS.brass, 1, [])).toBe(true);
    expect(isUnlocked(AVATAR_UNLOCKS.forest, 2, [])).toBe(false);
    expect(isUnlocked(AVATAR_UNLOCKS.forest, 3, [])).toBe(true);
    expect(isUnlocked(AVATAR_UNLOCKS.ribbon, 20, [])).toBe(false);
    expect(isUnlocked(AVATAR_UNLOCKS.ribbon, 1, ['wpm-80'])).toBe(true);
  });
});
