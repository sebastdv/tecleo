'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const MODES = [
  { key: 'bots', href: '/race' },
  { key: 'public', href: '/play' },
  { key: 'private', href: '/room' },
] as const;

/** Acceso a los tres tipos de carrera desde cualquiera de ellos. */
export function RaceModesNav() {
  const t = useTranslations('raceModes');
  const pathname = usePathname();
  return (
    <nav aria-label={t('label')} data-chrome>
      <ul className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-sm">
        {MODES.map(({ key, href }) => {
          const current = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-md px-3 font-medium transition-colors',
                  current
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
