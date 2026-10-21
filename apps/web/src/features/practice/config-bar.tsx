'use client';

import type { LengthCategory, WordListSize } from '@tecleo/content';
import { LANGUAGES, type UserSettings } from '@tecleo/shared';
import { useTranslations } from 'next-intl';

import { useSettings, useSettingsStore } from '@/settings/settings-store';

import {
  DURATIONS,
  WORD_COUNTS,
  type PracticeConfig,
  type PracticeMode,
  type TextKind,
} from './practice-config';

interface Option<T> {
  readonly value: T;
  readonly label: string;
}

const OPTION_CLASS =
  'rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:font-medium';

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
          className={OPTION_CLASS}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={OPTION_CLASS}
    >
      {label}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />;

interface ConfigBarProps {
  readonly config: PracticeConfig;
  readonly onChange: (patch: Partial<PracticeConfig>) => void;
}

/**
 * Opciones de la práctica. El idioma del texto, las reglas y "ignorar tildes" son preferencias
 * generales: se guardan en Configuración y aplican también fuera de la práctica.
 */
export function ConfigBar({ config, onChange }: ConfigBarProps) {
  const t = useTranslations('practice.config');
  const tLanguages = useTranslations('settings.languages');
  const settings = useSettings();
  const update = useSettingsStore((state) => state.update);
  const updateSettings = (patch: Partial<UserSettings>) => {
    update(patch);
  };

  return (
    <div
      role="group"
      aria-label={t('label')}
      className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-lg border bg-card px-2 py-1.5"
    >
      <Segmented
        label={t('textLanguage')}
        value={settings.textLanguage}
        options={LANGUAGES.map((language) => ({
          value: language,
          label: tLanguages(language).toLowerCase(),
        }))}
        onChange={(textLanguage) => {
          updateSettings({ textLanguage });
        }}
      />
      <Divider />
      <Segmented<PracticeMode>
        label={t('mode')}
        value={config.mode}
        options={(['time', 'words', 'text'] as const).map((mode) => ({
          value: mode,
          label: t(`modes.${mode}`),
        }))}
        onChange={(mode) => {
          onChange({ mode });
        }}
      />
      <Divider />
      {config.mode === 'time' && (
        <Segmented
          label={t('duration')}
          value={config.durationSeconds}
          options={DURATIONS.map((value) => ({ value, label: t('seconds', { value }) }))}
          onChange={(durationSeconds) => {
            onChange({ durationSeconds });
          }}
        />
      )}
      {config.mode === 'words' && (
        <Segmented
          label={t('wordCount')}
          value={config.wordCount}
          options={WORD_COUNTS.map((value) => ({ value, label: String(value) }))}
          onChange={(wordCount) => {
            onChange({ wordCount });
          }}
        />
      )}
      {config.mode === 'text' ? (
        <>
          <Segmented<TextKind>
            label={t('kind')}
            value={config.textKind}
            options={(['quote', 'code'] as const).map((kind) => ({
              value: kind,
              label: t(`kinds.${kind}`),
            }))}
            onChange={(textKind) => {
              onChange({ textKind });
            }}
          />
          {config.textKind === 'quote' && (
            <>
              <Divider />
              <Segmented<LengthCategory | 'any'>
                label={t('length')}
                value={config.quoteLength}
                options={(['any', 'short', 'medium', 'long'] as const).map((length) => ({
                  value: length,
                  label: t(`lengths.${length}`),
                }))}
                onChange={(quoteLength) => {
                  onChange({ quoteLength });
                }}
              />
            </>
          )}
        </>
      ) : (
        <>
          <Divider />
          <Segmented<WordListSize>
            label={t('listSize')}
            value={config.listSize}
            options={([200, 1000, 5000] as const).map((size) => ({
              value: size,
              label: t(`lists.${size}`),
            }))}
            onChange={(listSize) => {
              onChange({ listSize });
            }}
          />
          <Toggle
            label={t('punctuation')}
            checked={config.punctuation}
            onChange={(punctuation) => {
              onChange({ punctuation });
            }}
          />
          <Toggle
            label={t('numbers')}
            checked={config.numbers}
            onChange={(numbers) => {
              onChange({ numbers });
            }}
          />
        </>
      )}
      <Divider />
      <Segmented
        label={t('rules')}
        value={settings.typingMode}
        options={(['free', 'strict'] as const).map((mode) => ({
          value: mode,
          label: t(`ruleNames.${mode}`),
        }))}
        onChange={(typingMode) => {
          updateSettings({ typingMode });
        }}
      />
      <Toggle
        label={t('ignoreAccents')}
        checked={settings.ignoreAccents}
        onChange={(ignoreAccents) => {
          updateSettings({ ignoreAccents });
        }}
      />
    </div>
  );
}
