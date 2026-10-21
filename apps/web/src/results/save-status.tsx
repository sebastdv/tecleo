'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import type { SaveStatus } from './save-result';

/** Línea bajo los resultados: dónde quedó guardada la prueba. */
export function SaveStatusNote({ status }: { status: SaveStatus }) {
  const t = useTranslations('saveStatus');
  if (status === 'idle') return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {status === 'local'
        ? t.rich('local', {
            register: (chunks) => (
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {chunks}
              </Link>
            ),
          })
        : t(status)}
    </p>
  );
}
