'use client';

import type { LengthCategory, TextLanguage, WordListSize } from '@tecleo/content';
import type { TypingMode } from '@tecleo/engine';

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
    <div role="group" aria-label={label} className="flex items-center gap-1">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => {
            onChange(option.value);
          }}
          className="rounded px-2 py-1 text-sm text-zinc-500 hover:text-zinc-200 aria-pressed:text-amber-300"
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
      className="rounded px-2 py-1 text-sm text-zinc-500 hover:text-zinc-200 aria-pressed:text-amber-300"
    >
      {label}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="h-4 w-px bg-zinc-700" />;

interface ConfigBarProps {
  readonly config: PracticeConfig;
  readonly onChange: (patch: Partial<PracticeConfig>) => void;
}

export function ConfigBar({ config, onChange }: ConfigBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-zinc-900 px-3 py-2">
      <Segmented<TextLanguage>
        label="Idioma del texto"
        value={config.language}
        options={[
          { value: 'es', label: 'español' },
          { value: 'en', label: 'inglés' },
        ]}
        onChange={(language) => {
          onChange({ language });
        }}
      />
      <Divider />
      <Segmented<PracticeMode>
        label="Modo"
        value={config.mode}
        options={[
          { value: 'time', label: 'tiempo' },
          { value: 'words', label: 'palabras' },
          { value: 'text', label: 'texto' },
        ]}
        onChange={(mode) => {
          onChange({ mode });
        }}
      />
      <Divider />
      {config.mode === 'time' && (
        <Segmented
          label="Duración en segundos"
          value={config.durationSeconds}
          options={DURATIONS.map((value) => ({ value, label: `${value}s` }))}
          onChange={(durationSeconds) => {
            onChange({ durationSeconds });
          }}
        />
      )}
      {config.mode === 'words' && (
        <Segmented
          label="Cantidad de palabras"
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
            label="Tipo de texto"
            value={config.textKind}
            options={[
              { value: 'quote', label: 'cita' },
              { value: 'code', label: 'código' },
            ]}
            onChange={(textKind) => {
              onChange({ textKind });
            }}
          />
          {config.textKind === 'quote' && (
            <Segmented<LengthCategory | 'any'>
              label="Longitud"
              value={config.quoteLength}
              options={[
                { value: 'any', label: 'cualquiera' },
                { value: 'short', label: 'corto' },
                { value: 'medium', label: 'medio' },
                { value: 'long', label: 'largo' },
              ]}
              onChange={(quoteLength) => {
                onChange({ quoteLength });
              }}
            />
          )}
        </>
      ) : (
        <>
          <Divider />
          <Segmented<WordListSize>
            label="Palabras más frecuentes"
            value={config.listSize}
            options={[
              { value: 200, label: 'top 200' },
              { value: 1000, label: '1k' },
              { value: 5000, label: '5k' },
            ]}
            onChange={(listSize) => {
              onChange({ listSize });
            }}
          />
          <Toggle
            label="puntuación"
            checked={config.punctuation}
            onChange={(punctuation) => {
              onChange({ punctuation });
            }}
          />
          <Toggle
            label="números"
            checked={config.numbers}
            onChange={(numbers) => {
              onChange({ numbers });
            }}
          />
        </>
      )}
      <Divider />
      <Segmented<TypingMode>
        label="Reglas de escritura"
        value={config.typingMode}
        options={[
          { value: 'free', label: 'libre' },
          { value: 'strict', label: 'estricto' },
        ]}
        onChange={(typingMode) => {
          onChange({ typingMode });
        }}
      />
      <Toggle
        label="ignorar tildes"
        checked={config.ignoreAccents}
        onChange={(ignoreAccents) => {
          onChange({ ignoreAccents });
        }}
      />
    </div>
  );
}
