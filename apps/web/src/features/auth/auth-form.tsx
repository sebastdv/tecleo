'use client';

import {
  importResultsResponseSchema,
  loginSchema,
  registerSchema,
  type ApiErrorCode,
} from '@tecleo/shared';
import { useTranslations } from 'next-intl';
import { useId, useState, useSyncExternalStore } from 'react';

import { login, register } from '@/auth/auth-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, fetchApi } from '@/lib/api';
import { clearGuestResults, readGuestResults } from '@/results/guest-results';

type Field = 'email' | 'password' | 'nickname';
type FormError = Exclude<ApiErrorCode, 'VALIDATION'> | 'NETWORK' | 'generic';

const noSubscription = () => () => undefined;

/** Verdadero solo en el cliente ya hidratado. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

/** Cuántos resultados de invitado hay en este navegador (0 en el servidor). */
function useGuestResultCount(): number {
  return useSyncExternalStore(
    () => () => undefined,
    () => readGuestResults().length,
    () => 0,
  );
}

function FieldInput({
  id,
  name,
  label,
  type = 'text',
  autoComplete,
  error,
  hint,
}: {
  id: string;
  name: Field;
  label: string;
  type?: string;
  autoComplete: string;
  error: string | undefined;
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        required
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const id = useId();
  const isRegister = mode === 'register';
  const guestCount = useGuestResultCount();
  const hydrated = useHydrated();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      ['email', 'password', 'nickname'].map((key) => {
        const value = data.get(key);
        return [key, typeof value === 'string' ? value : ''];
      }),
    );
    const parsed = (isRegister ? registerSchema : loginSchema).safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'password' && !isRegister) {
          // En el login la contraseña solo tiene que estar escrita: la regla de 8 es del registro.
          errors.password = t('errors.passwordRequired');
        } else if (field === 'email' || field === 'password' || field === 'nickname') {
          errors[field] = t(`errors.${field}`);
        }
      }
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(parsed.data as Parameters<typeof register>[0]);
        if (data.get('importGuest') === 'on') {
          const results = readGuestResults();
          if (results.length > 0) {
            await fetchApi('/results/import', importResultsResponseSchema, {
              method: 'POST',
              body: { results },
              auth: true,
            });
            clearGuestResults();
          }
        }
      } else {
        await login(parsed.data);
      }
      router.push('/');
    } catch (error) {
      if (error instanceof ApiError && error.code !== 'VALIDATION') {
        setFormError(
          error.code === 'UNAUTHORIZED' || error.code === 'SESSION_EXPIRED'
            ? 'generic'
            : error.code,
        );
      } else {
        setFormError('generic');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const knownErrors: FormError[] = [
    'EMAIL_TAKEN',
    'NICKNAME_TAKEN',
    'INVALID_CREDENTIALS',
    'RATE_LIMITED',
    'NETWORK',
  ];

  return (
    // POST y botón deshabilitado hasta hidratar: un envío nativo nunca pone credenciales en la URL.
    <form
      method="post"
      className="flex w-full max-w-sm flex-col gap-5"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
    >
      {formError && (
        <p role="alert" className="rounded-md border border-error/50 px-3 py-2 text-sm text-error">
          {t(
            `errors.${knownErrors.includes(formError) ? formError : 'generic'}` as 'errors.generic',
          )}
        </p>
      )}
      {isRegister && (
        <FieldInput
          id={`${id}-nickname`}
          name="nickname"
          label={t('nickname')}
          autoComplete="username"
          error={fieldErrors.nickname}
          hint={t('nicknameHint')}
        />
      )}
      <FieldInput
        id={`${id}-email`}
        name="email"
        label={t('email')}
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <FieldInput
        id={`${id}-password`}
        name="password"
        label={t('password')}
        type="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        error={fieldErrors.password}
        {...(isRegister && { hint: t('passwordHint') })}
      />
      {isRegister && guestCount > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="importGuest"
            defaultChecked
            className="mt-0.5 size-4 accent-primary"
          />
          {t('importGuest', { count: guestCount })}
        </label>
      )}
      <Button type="submit" disabled={!hydrated || submitting} className="h-10">
        {submitting ? t('submitting') : isRegister ? t('registerSubmit') : t('loginSubmit')}
      </Button>
      <p className="text-sm text-muted-foreground">
        {isRegister ? t('haveAccount') : t('noAccount')}{' '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {isRegister ? t('toLogin') : t('toRegister')}
        </Link>
      </p>
    </form>
  );
}
