'use client';

import { BOT_LEVEL_IDS } from '@tecleo/engine';
import { useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { BOT_COUNTS, useRaceStore, type BotLevelChoice, type RaceConfig } from './race-store';

/** Una opción con su etiqueta (para grupos de botones) y una pista opcional debajo. */
export function SetupOption({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (labelId: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-sm font-medium">
        {label}
      </span>
      {children(id)}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function RaceSetup({ loading }: { loading: boolean }) {
  const t = useTranslations('race');
  const tLevels = useTranslations('settings.botLevels');
  const tLengths = useTranslations('practice.config.lengths');
  const config = useRaceStore((state) => state.config);
  const configure = useRaceStore((state) => state.configure);
  const prepare = useRaceStore((state) => state.prepare);

  return (
    <section aria-label={t('setupLabel')} className="flex max-w-3xl flex-col gap-8">
      <SetupOption label={t('botCount')}>
        {(labelId) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            value={String(config.botCount)}
            onValueChange={(value) => {
              const count = Number(value) as RaceConfig['botCount'];
              if (BOT_COUNTS.includes(count)) configure({ botCount: count });
            }}
          >
            {BOT_COUNTS.map((count) => (
              <ToggleGroupItem key={count} value={String(count)} className="w-11">
                {count}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </SetupOption>

      <SetupOption
        label={t('level')}
        hint={config.level === 'mixed' ? t('mixedHint') : tLevels(config.level)}
      >
        {(labelId) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            value={config.level}
            onValueChange={(value) => {
              if (value) configure({ level: value as BotLevelChoice });
            }}
            className="flex-wrap"
          >
            {[...BOT_LEVEL_IDS, 'mixed' as const].map((level) => (
              <ToggleGroupItem key={level} value={level} className="px-3">
                {t(`levels.${level}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </SetupOption>

      <SetupOption label={t('length')}>
        {(labelId) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            value={config.length}
            onValueChange={(value) => {
              if (value) configure({ length: value as RaceConfig['length'] });
            }}
          >
            {(['any', 'short', 'medium', 'long'] as const).map((length) => (
              <ToggleGroupItem key={length} value={length} className="px-3">
                {tLengths(length)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </SetupOption>

      <Button
        size="lg"
        className="h-12 self-start px-6 text-base"
        disabled={loading}
        onClick={() => {
          void prepare();
        }}
      >
        {loading ? t('loading') : t('start')}
      </Button>
    </section>
  );
}
