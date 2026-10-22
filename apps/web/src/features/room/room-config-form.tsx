'use client';

import { BOT_LEVEL_IDS } from '@tecleo/engine';
import { LANGUAGES, type RoomConfig } from '@tecleo/shared';
import { useTranslations } from 'next-intl';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

import { SetupOption } from '../race/race-setup';

const LENGTHS = ['any', 'short', 'medium', 'long'] as const;
const BOT_COUNTS = [0, 1, 2, 3, 4, 5] as const;
const MAX_PLAYERS = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Configuración de la sala: editable por el anfitrión, de solo lectura para el resto. */
export function RoomConfigForm({
  config,
  editable,
  minPlayers,
  onChange,
}: {
  config: RoomConfig;
  editable: boolean;
  /** No se puede bajar el máximo por debajo de quienes ya están. */
  minPlayers: number;
  onChange: (config: RoomConfig) => void;
}) {
  const t = useTranslations('room');
  const tRace = useTranslations('race');
  const tLengths = useTranslations('practice.config.lengths');
  const update = (patch: Partial<RoomConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <section aria-labelledby="config-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 id="config-title" className="font-heading text-lg font-semibold">
          {t('config')}
        </h2>
        {!editable && <p className="text-sm text-muted-foreground">{t('configHostOnly')}</p>}
      </div>

      <SetupOption label={t('language')}>
        {(labelId) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            disabled={!editable}
            value={config.language}
            onValueChange={(value) => {
              const language = LANGUAGES.find((candidate) => candidate === value);
              if (language) update({ language });
            }}
          >
            {LANGUAGES.map((language) => (
              <ToggleGroupItem key={language} value={language} className="px-3">
                {t(`languages.${language}`)}
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
            disabled={!editable}
            value={config.length}
            onValueChange={(value) => {
              const length = LENGTHS.find((candidate) => candidate === value);
              if (length) update({ length });
            }}
          >
            {LENGTHS.map((length) => (
              <ToggleGroupItem key={length} value={length} className="px-3">
                {tLengths(length)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </SetupOption>

      <SetupOption label={t('bots')}>
        {(labelId) => (
          <ToggleGroup
            type="single"
            variant="outline"
            aria-labelledby={labelId}
            disabled={!editable}
            value={String(config.botCount)}
            onValueChange={(value) => {
              const botCount = BOT_COUNTS.find((count) => String(count) === value);
              if (botCount !== undefined) update({ botCount });
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

      {config.botCount > 0 && (
        <SetupOption label={t('botLevel')}>
          {(labelId) => (
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={labelId}
              disabled={!editable}
              value={config.botLevel}
              onValueChange={(value) => {
                const botLevel = [...BOT_LEVEL_IDS, 'mixed' as const].find(
                  (level) => level === value,
                );
                if (botLevel) update({ botLevel });
              }}
              className="flex-wrap"
            >
              {[...BOT_LEVEL_IDS, 'mixed' as const].map((level) => (
                <ToggleGroupItem key={level} value={level} className="px-3">
                  {tRace(`levels.${level}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </SetupOption>
      )}

      <SetupOption label={t('maxPlayers')}>
        {(labelId) => (
          <Select
            disabled={!editable}
            value={String(config.maxPlayers)}
            onValueChange={(value) => {
              const maxPlayers = MAX_PLAYERS.find((count) => String(count) === value);
              if (maxPlayers !== undefined) update({ maxPlayers });
            }}
          >
            <SelectTrigger aria-labelledby={labelId} className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MAX_PLAYERS.filter((count) => count >= minPlayers).map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SetupOption>
    </section>
  );
}
