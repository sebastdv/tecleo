'use client';

import {
  BOT_LEVELS,
  CARET_STYLES,
  GAME_FONT_SIZES,
  GAME_FONTS,
  KEY_SOUNDS,
  KEYBOARD_LAYOUTS,
  LANGUAGES,
  THEMES,
  type UserSettings,
} from '@tecleo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId, type ReactNode } from 'react';

import { useSwitchLanguage } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { playKeySound } from '@/lib/key-sound';
import { useSettings, useSettingsStore } from '@/settings/settings-store';
import { THEME_TOKENS } from '@/theme/themes';

import { AccountSection } from './account-section';
import { TypingPreview } from './typing-preview';

const FONT_NAMES: Record<UserSettings['gameFont'], string> = {
  jetbrains: 'JetBrains Mono',
  plex: 'IBM Plex Mono',
  fira: 'Fira Code',
  geist: 'Geist Mono',
};

const FONT_VARIABLE: Record<UserSettings['gameFont'], string> = {
  jetbrains: 'var(--font-jetbrains)',
  plex: 'var(--font-plex)',
  fira: 'var(--font-fira)',
  geist: 'var(--font-geist-mono)',
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-t pt-6">
      <h2 id={id} className="font-heading text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Campo con etiqueta y ayuda asociadas al control (aria-describedby). */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (ids: { labelId: string; controlId: string; hintId?: string }) => ReactNode;
}) {
  const base = useId();
  const ids = {
    labelId: `${base}-label`,
    controlId: `${base}-control`,
    ...(hint && { hintId: `${base}-hint` }),
  };
  return (
    <div className="flex flex-col gap-2">
      <Label id={ids.labelId} htmlFor={ids.controlId}>
        {label}
      </Label>
      {children(ids)}
      {hint && (
        <p id={ids.hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
    </div>
  );
}

export function SettingsForm() {
  const t = useTranslations('settings');
  const settings = useSettings();
  const update = useSettingsStore((state) => state.update);
  const locale = useLocale();
  const switchLanguage = useSwitchLanguage();

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-10">
        <AccountSection />
        <Section title={t('appearance')}>
          <Field label={t('theme')}>
            {({ labelId }) => (
              <RadioGroup
                aria-labelledby={labelId}
                value={settings.theme}
                onValueChange={(theme) => {
                  update({ theme: theme as UserSettings['theme'] });
                }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {THEMES.map((id) => {
                  const tokens = THEME_TOKENS[id];
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer flex-col gap-2 rounded-lg border p-2 has-data-[state=checked]:border-primary has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-primary/40"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-14 items-center gap-0.5 rounded-md px-3 font-game text-lg"
                        style={{ background: tokens.background, color: tokens.foreground }}
                      >
                        te
                        <span style={{ color: tokens.error }} className="underline">
                          c
                        </span>
                        <span className="h-5 w-0.5" style={{ background: tokens.accent }} />
                        <span style={{ color: tokens.pending }}>leo</span>
                      </span>
                      <span className="flex items-center gap-2 px-1 text-sm">
                        <RadioGroupItem value={id} />
                        {t(`themes.${id}`)}
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            )}
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('gameFont')}>
              {({ controlId }) => (
                <Select
                  value={settings.gameFont}
                  onValueChange={(gameFont) => {
                    update({ gameFont: gameFont as UserSettings['gameFont'] });
                  }}
                >
                  <SelectTrigger id={controlId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_FONTS.map((font) => (
                      <SelectItem
                        key={font}
                        value={font}
                        style={{ fontFamily: FONT_VARIABLE[font] }}
                      >
                        {FONT_NAMES[font]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t('gameFontSize')}>
              {({ labelId }) => (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  aria-labelledby={labelId}
                  value={settings.gameFontSize}
                  onValueChange={(size) => {
                    if (size) update({ gameFontSize: size as UserSettings['gameFontSize'] });
                  }}
                >
                  {GAME_FONT_SIZES.map((size) => (
                    <ToggleGroupItem key={size} value={size} className="px-3">
                      {t(`sizes.${size}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
            </Field>
          </div>

          <Field label={t('caretStyle')}>
            {({ labelId }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                aria-labelledby={labelId}
                value={settings.caretStyle}
                onValueChange={(caret) => {
                  if (caret) update({ caretStyle: caret as UserSettings['caretStyle'] });
                }}
              >
                {CARET_STYLES.map((caret) => (
                  <ToggleGroupItem key={caret} value={caret} className="px-3">
                    {t(`carets.${caret}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          </Field>
        </Section>

        <Section title={t('typing')}>
          <Field label={t('typingMode')} hint={t('typingModeHint')}>
            {({ labelId, hintId }) => (
              <RadioGroup
                aria-labelledby={labelId}
                aria-describedby={hintId}
                value={settings.typingMode}
                onValueChange={(mode) => {
                  update({ typingMode: mode as UserSettings['typingMode'] });
                }}
              >
                {(['free', 'strict'] as const).map((mode) => (
                  <Label key={mode} className="flex items-center gap-3 font-normal">
                    <RadioGroupItem value={mode} />
                    {t(`typingModes.${mode}`)}
                  </Label>
                ))}
              </RadioGroup>
            )}
          </Field>
          <SwitchField
            label={t('ignoreAccents')}
            hint={t('ignoreAccentsHint')}
            checked={settings.ignoreAccents}
            onChange={(ignoreAccents) => {
              update({ ignoreAccents });
            }}
          />
          <SwitchField
            label={t('showLiveStats')}
            checked={settings.showLiveStats}
            onChange={(showLiveStats) => {
              update({ showLiveStats });
            }}
          />
          <SwitchField
            label={t('focusMode')}
            hint={t('focusModeHint')}
            checked={settings.focusMode}
            onChange={(focusMode) => {
              update({ focusMode });
            }}
          />
        </Section>

        <Section title={t('sound')}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('keySound')}>
              {({ controlId }) => (
                <Select
                  value={settings.keySound}
                  onValueChange={(keySound) => {
                    update({ keySound: keySound as UserSettings['keySound'] });
                  }}
                >
                  <SelectTrigger id={controlId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEY_SOUNDS.map((sound) => (
                      <SelectItem key={sound} value={sound}>
                        {t(`keySounds.${sound}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t('volume')}>
              {({ labelId }) => (
                <div className="flex items-center gap-4">
                  <Slider
                    aria-labelledby={labelId}
                    thumbLabel={t('volume')}
                    min={0}
                    max={1}
                    step={0.05}
                    value={[settings.soundVolume]}
                    disabled={settings.keySound === 'off'}
                    onValueChange={([soundVolume]) => {
                      if (soundVolume !== undefined) update({ soundVolume });
                    }}
                  />
                  <span className="tabular w-10 text-right text-sm text-muted-foreground">
                    {Math.round(settings.soundVolume * 100)}%
                  </span>
                </div>
              )}
            </Field>
          </div>
          <Button
            variant="outline"
            className="self-start"
            disabled={settings.keySound === 'off'}
            onClick={() => {
              (['correct', 'correct', 'space', 'error'] as const).forEach((kind, index) => {
                setTimeout(() => {
                  playKeySound(settings.keySound, settings.soundVolume, kind);
                }, index * 140);
              });
            }}
          >
            {t('testSound')}
          </Button>
        </Section>

        <Section title={t('language')}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('interfaceLanguage')}>
              {({ controlId }) => (
                <Select
                  value={locale}
                  onValueChange={(language) => {
                    switchLanguage(language as UserSettings['interfaceLanguage']);
                  }}
                >
                  <SelectTrigger id={controlId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>
                        {t(`languages.${language}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t('textLanguage')}>
              {({ controlId }) => (
                <Select
                  value={settings.textLanguage}
                  onValueChange={(language) => {
                    update({ textLanguage: language as UserSettings['textLanguage'] });
                  }}
                >
                  <SelectTrigger id={controlId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language} value={language}>
                        {t(`languages.${language}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </Section>

        <Section title={t('keyboard')}>
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label={t('keyboardLayout')} hint={t('keyboardLayoutHint')}>
              {({ controlId, hintId }) => (
                <Select
                  value={settings.keyboardLayout}
                  onValueChange={(layout) => {
                    update({ keyboardLayout: layout as UserSettings['keyboardLayout'] });
                  }}
                >
                  <SelectTrigger id={controlId} aria-describedby={hintId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KEYBOARD_LAYOUTS.map((layout) => (
                      <SelectItem key={layout} value={layout}>
                        {t(`layouts.${layout}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label={t('botLevel')}>
              {({ controlId }) => (
                <Select
                  value={settings.botLevel}
                  onValueChange={(level) => {
                    update({ botLevel: level as UserSettings['botLevel'] });
                  }}
                >
                  <SelectTrigger id={controlId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOT_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {t(`botLevels.${level}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </Section>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <TypingPreview />
      </aside>
    </div>
  );
}
