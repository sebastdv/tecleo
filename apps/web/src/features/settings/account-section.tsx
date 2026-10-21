'use client';

import { AVATARS, publicUserSchema, type AvatarId, type UpdateProfileInput } from '@tecleo/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

import { useAuthStore } from '@/auth/auth-store';
import { TypeAvatar } from '@/components/type-avatar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchApi } from '@/lib/api';

/** Países hispanohablantes y anglohablantes primero; el resto se puede sumar sin cambiar la API. */
const COUNTRIES = [
  'AR',
  'BO',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'ES',
  'GQ',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
  'US',
  'CA',
  'GB',
  'IE',
  'AU',
  'NZ',
  'BR',
  'PT',
  'FR',
  'DE',
  'IT',
] as const;
const NONE = 'none';

export function AccountSection() {
  const t = useTranslations('settings');
  const locale = useLocale();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [message, setMessage] = useState<'accountSaved' | 'accountError' | null>(null);
  const avatarLabelId = useId();
  const countryId = useId();

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    return COUNTRIES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    );
  }, [locale]);

  if (!user) return null;

  async function save(patch: UpdateProfileInput) {
    try {
      setUser(
        await fetchApi('/me', publicUserSchema, { method: 'PATCH', body: patch, auth: true }),
      );
      setMessage('accountSaved');
    } catch {
      setMessage('accountError');
    }
  }

  return (
    <section
      aria-labelledby={`${avatarLabelId}-title`}
      className="flex flex-col gap-6 border-t pt-6"
    >
      <h2 id={`${avatarLabelId}-title`} className="font-heading text-xl font-semibold">
        {t('account')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('syncedToAccount')}</p>
      <div className="flex flex-col gap-2">
        <Label id={avatarLabelId}>{t('avatar')}</Label>
        <RadioGroup
          aria-labelledby={avatarLabelId}
          value={user.avatar ?? 'brass'}
          onValueChange={(avatar) => void save({ avatar: avatar as AvatarId })}
          className="flex flex-wrap gap-3"
        >
          {AVATARS.map((avatar) => (
            <label
              key={avatar}
              className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 pr-3 has-data-[state=checked]:border-primary"
            >
              <RadioGroupItem value={avatar} />
              <TypeAvatar nickname={user.nickname} avatar={avatar} size="sm" />
              <span className="text-sm">{t(`avatars.${avatar}`)}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
      <div className="flex max-w-xs flex-col gap-2">
        <Label htmlFor={countryId}>{t('country')}</Label>
        <Select
          value={user.country ?? NONE}
          onValueChange={(value) => void save({ country: value === NONE ? null : value })}
        >
          <SelectTrigger id={countryId} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t('countryNone')}</SelectItem>
            {countries.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                {country.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {message && (
        <p
          role="status"
          className={
            message === 'accountError' ? 'text-sm text-error' : 'text-sm text-muted-foreground'
          }
        >
          {t(message)}
        </p>
      )}
    </section>
  );
}
