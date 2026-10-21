import { useTranslations } from 'next-intl';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';

/**
 * Formulario de acceso o registro. Las cuentas llegan con el backend (Fase 4): hasta entonces
 * el envío está deshabilitado y el aviso lo explica, sin simular una respuesta.
 */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const t = useTranslations('auth');
  const id = useId();
  const noticeId = `${id}-notice`;
  const isRegister = mode === 'register';

  return (
    <form className="flex w-full max-w-sm flex-col gap-5" aria-describedby={noticeId}>
      <p
        id={noticeId}
        role="note"
        className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
      >
        {t('unavailable')}
      </p>
      {isRegister && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-nickname`}>{t('nickname')}</Label>
          <Input
            id={`${id}-nickname`}
            name="nickname"
            autoComplete="username"
            aria-describedby={`${id}-nickname-hint`}
          />
          <p id={`${id}-nickname-hint`} className="text-sm text-muted-foreground">
            {t('nicknameHint')}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-email`}>{t('email')}</Label>
        <Input id={`${id}-email`} name="email" type="email" autoComplete="email" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-password`}>{t('password')}</Label>
        <Input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          aria-describedby={isRegister ? `${id}-password-hint` : undefined}
        />
        {isRegister && (
          <p id={`${id}-password-hint`} className="text-sm text-muted-foreground">
            {t('passwordHint')}
          </p>
        )}
      </div>
      <Button type="submit" disabled className="h-10">
        {isRegister ? t('registerSubmit') : t('loginSubmit')}
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
