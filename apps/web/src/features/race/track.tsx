'use client';

import { Bot, Flag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type CSSProperties } from 'react';

import { cn } from '@/lib/utils';

/** Un carril de la pista. */
export interface TrackLane {
  readonly id: string;
  readonly name: string;
  readonly isBot: boolean;
  /** Quien juega en esta pantalla: resaltado y movido por sus propias pulsaciones. */
  readonly self: boolean;
  /** Progreso actual (0–1), para lectores de pantalla y para los carriles no animados. */
  readonly progress: number;
  readonly wpm: number;
  /** Puesto, cuando ya llegó. */
  readonly position?: number | undefined;
  /** Se mueve cuadro a cuadro con `progressAt` en vez de con `progress`. */
  readonly animated?: boolean;
  /** Aclaración junto al nombre (p. ej. "desconectado"). */
  readonly note?: string | undefined;
}

interface TrackProps {
  readonly lanes: readonly TrackLane[];
  /** Progreso de un carril animado en un instante de `performance.now()`. */
  readonly progressAt?: (id: string, now: number) => number;
  /** Mientras sea verdadero, los carriles animados se redibujan en cada cuadro. */
  readonly animating: boolean;
}

const RUNNER_SIZE = '2.25rem';

function Runner({ label, highlight }: { label: string; highlight: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[0.3rem] border font-game text-lg shadow-[inset_0_-0.18rem_0_var(--border)]',
        highlight
          ? 'border-primary bg-primary text-primary-foreground shadow-[inset_0_-0.18rem_0_color-mix(in_oklch,var(--primary),black_25%)]'
          : 'bg-card text-foreground',
      )}
      style={{ left: `calc(var(--p, 0) * (100% - ${RUNNER_SIZE}))` }}
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

function Lane({
  name,
  isBot,
  wpm,
  progress,
  position,
  note,
  laneRef,
  style,
  highlight,
}: {
  name: string;
  isBot: boolean;
  wpm: number;
  progress: number;
  position: number | undefined;
  note: string | undefined;
  laneRef?: (element: HTMLDivElement | null) => void;
  style?: CSSProperties | undefined;
  highlight: boolean;
}) {
  const t = useTranslations('race');
  return (
    <li className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.5rem] items-center gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_4.5rem]">
      <span
        className={cn('flex min-w-0 items-center gap-1.5 text-sm', highlight && 'font-semibold')}
      >
        {isBot && <Bot aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{name}</span>
        {isBot && <span className="sr-only">{t('botLabel')}</span>}
        {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
      </span>
      <div
        ref={laneRef}
        style={style}
        className={cn(
          'relative h-11 border-b border-dashed border-border',
          // Quien juega salta de carácter en carácter: una transición corta lo suaviza.
          // Los demás ya se interpolan cuadro a cuadro.
          highlight && 'motion-safe:[&>span]:transition-[left] motion-safe:[&>span]:duration-100',
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-1 right-0 bottom-1 w-0.5 rounded-full bg-primary/70"
        />
        <Runner label={name} highlight={highlight} />
        <span className="sr-only">{t('progress', { percent: Math.round(progress * 100) })}</span>
      </div>
      <span className="tabular text-right text-sm text-muted-foreground">
        {position !== undefined ? (
          <span className="font-semibold text-foreground">{t('position', { position })}</span>
        ) : (
          t('wpmValue', { wpm: Math.round(wpm) })
        )}
      </span>
    </li>
  );
}

/**
 * Pista de la carrera. Los carriles animados (bots y rivales) se mueven con
 * requestAnimationFrame escribiendo una variable CSS, sin re-renderizar React; el propio avanza
 * con cada pulsación.
 */
export function Track({ lanes, progressAt, animating }: TrackProps) {
  const t = useTranslations('race');
  const laneRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!animating || !progressAt) return;
    let frame = 0;
    const draw = () => {
      const now = performance.now();
      for (const [id, element] of laneRefs.current) {
        element.style.setProperty('--p', String(Math.max(0, Math.min(1, progressAt(id, now)))));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [animating, progressAt]);

  return (
    <section aria-labelledby="track-title" className="flex flex-col gap-1">
      <h2 id="track-title" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Flag aria-hidden="true" className="size-4" />
        {t('track')}
      </h2>
      <ol className="flex flex-col">
        {lanes.map((lane) => (
          <Lane
            key={lane.id}
            name={lane.name}
            isBot={lane.isBot}
            wpm={lane.wpm}
            progress={Math.min(1, lane.progress)}
            position={lane.position}
            note={lane.note}
            highlight={lane.self}
            {...(lane.animated
              ? {
                  laneRef: (element: HTMLDivElement | null) => {
                    if (element) {
                      laneRefs.current.set(lane.id, element);
                      // Solo la primera vez: después manda el cuadro a cuadro.
                      if (!element.style.getPropertyValue('--p'))
                        element.style.setProperty('--p', String(Math.min(1, lane.progress)));
                    } else laneRefs.current.delete(lane.id);
                  },
                }
              : { style: { '--p': Math.min(1, lane.progress) } as CSSProperties })}
          />
        ))}
      </ol>
    </section>
  );
}
