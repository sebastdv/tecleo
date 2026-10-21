'use client';

import type { TypingAction, TypingState } from '@tecleo/engine';
import { useCallback } from 'react';

import { playKeySound } from '@/lib/key-sound';
import { useSettingsStore } from '@/settings/settings-store';

import type { ActionHandler } from './use-typing-input';

/**
 * Envuelve el `input` de un store y suena la tecla según cómo la juzgó el motor
 * (acierto, espacio o error). Si el sonido está desactivado no hace nada extra.
 */
export function useSoundedInput(
  input: ActionHandler,
  getTyping: () => TypingState | null,
): ActionHandler {
  return useCallback(
    (action: TypingAction, timestamp: number) => {
      const before = getTyping()?.keystrokes.length ?? 0;
      input(action, timestamp);
      if (action.type !== 'insert') return;
      const keystrokes = getTyping()?.keystrokes ?? [];
      const last = keystrokes.at(-1);
      if (!last || keystrokes.length === before) return;
      const { keySound, soundVolume } = useSettingsStore.getState().settings;
      const kind = !last.correct ? 'error' : last.input === ' ' ? 'space' : 'correct';
      playKeySound(keySound, soundVolume, kind);
    },
    [input, getTyping],
  );
}
