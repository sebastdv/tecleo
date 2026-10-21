'use client';

import { applyInput, createTypingState, type TypingState } from '@tecleo/engine';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { useSettings } from '@/settings/settings-store';

import { TypingArea } from '../typing/typing-area';

const SAMPLE = {
  es: { text: 'El veloz murciélago hindú comía feliz cardillo y kiwi.', typed: 'El veloz murcia' },
  en: { text: 'The quick brown fox jumps over the lazy dog.', typed: 'The quick brpw' },
} as const;

/** Estado congelado a mitad de escritura (con un error) para ver tipografía, colores y cursor. */
function previewState(locale: 'es' | 'en'): TypingState {
  const { text, typed } = SAMPLE[locale];
  let state = createTypingState({ text, rules: { mode: 'free' } });
  Array.from(typed).forEach((ch, index) => {
    state = applyInput(state, { type: 'insert', text: ch }, index * 150);
  });
  return state;
}

export function TypingPreview() {
  const t = useTranslations('settings');
  const locale = useLocale() === 'en' ? 'en' : 'es';
  const { caretStyle } = useSettings();
  const state = useMemo(() => previewState(locale), [locale]);
  return (
    <figure className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <TypingArea
        state={state}
        onAction={() => undefined}
        caretStyle={caretStyle}
        interactive={false}
        lines={2}
      />
      <figcaption className="text-sm text-muted-foreground">{t('preview')}</figcaption>
    </figure>
  );
}
