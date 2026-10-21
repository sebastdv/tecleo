'use client';

import type { CharStatEntry, KeyboardLayout } from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

import { heatByKey, KEYBOARD_ROWS } from './keyboard-layouts';

/** Ancho en "unidades de tecla" de las teclas especiales. */
const SPACE_UNITS = 6;

/**
 * Teclado con las teclas teñidas según su tasa de errores. El tinte se mezcla con el fondo de
 * la tecla hasta un máximo, para que la letra siga leyéndose en todos los temas.
 */
export function KeyboardHeatmap({
  stats,
  layout,
}: {
  stats: readonly CharStatEntry[];
  layout: KeyboardLayout;
}) {
  const t = useTranslations('profile');
  const tLayouts = useTranslations('settings.layouts');
  const heat = useMemo(() => heatByKey(stats, layout), [stats, layout]);
  const maxRate = Math.max(0, ...[...heat.values()].map((key) => key.rate));

  if (heat.size === 0) return <p className="text-muted-foreground">{t('heatmapEmpty')}</p>;

  return (
    <figure className="flex flex-col gap-3">
      <div
        className="flex flex-col gap-1.5 overflow-x-auto pb-1"
        role="list"
        aria-label={t('heatmap')}
      >
        {KEYBOARD_ROWS[layout].map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex gap-1.5"
            style={{ paddingLeft: `${rowIndex === 4 ? 3.5 : rowIndex * 0.5}rem` }}
          >
            {row.map((key) => {
              const stat = heat.get(key);
              const intensity = stat && maxRate > 0 ? stat.rate / maxRate : 0;
              const label = key === ' ' ? '␣' : key;
              return (
                <div
                  key={key}
                  role="listitem"
                  title={
                    stat
                      ? t('heatmapKey', {
                          key: label,
                          errors: stat.errors,
                          attempts: stat.attempts,
                        })
                      : label
                  }
                  className={cn(
                    'flex h-10 shrink-0 items-center justify-center rounded-md border font-game text-sm',
                    key === ' ' ? 'grow' : 'w-10',
                  )}
                  style={{
                    ...(key === ' ' && { minWidth: `${SPACE_UNITS * 2.5}rem` }),
                    background: `color-mix(in oklch, var(--error) ${Math.round(intensity * 45)}%, var(--muted))`,
                  }}
                >
                  <span aria-hidden="true">{label}</span>
                  <span className="sr-only">
                    {stat
                      ? t('heatmapKey', {
                          key: label,
                          errors: stat.errors,
                          attempts: stat.attempts,
                        })
                      : label}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <figcaption className="text-sm text-muted-foreground">
        {t('heatmapHint', { layout: tLayouts(layout) })}
      </figcaption>
    </figure>
  );
}
