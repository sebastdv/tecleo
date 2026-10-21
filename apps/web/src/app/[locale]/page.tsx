import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ComposedTitle } from '@/features/home/composed-title';
import { Link } from '@/i18n/navigation';

const MODES = [
  { key: 'practice', href: '/practice' },
  { key: 'bots', href: null },
  { key: 'public', href: null },
  { key: 'private', href: null },
  { key: 'ghost', href: null },
  { key: 'daily', href: null },
  { key: 'targeted', href: null },
] as const;

export default function HomePage() {
  const t = useTranslations('home');
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 pt-14 pb-20 sm:px-6 sm:pt-24">
      <section className="flex flex-col items-start gap-8">
        <ComposedTitle text="tecleo" />
        <p className="max-w-xl text-xl leading-relaxed text-muted-foreground">{t('tagline')}</p>
        {/* Hasta que existan las carreras (fases 3 y 5), jugar lleva a la práctica. */}
        <Button size="lg" asChild className="h-12 px-6 text-base">
          <Link href="/practice">{t('playNow')}</Link>
        </Button>
      </section>

      <section aria-labelledby="modes-title" className="flex flex-col gap-6">
        <h2 id="modes-title" className="font-heading text-2xl font-bold tracking-tight">
          {t('modesTitle')}
        </h2>
        <ul className="grid gap-x-12 md:grid-cols-2">
          {MODES.map((mode) => (
            <li key={mode.key} className="flex items-baseline justify-between gap-6 border-t py-5">
              <div className="flex flex-col gap-1">
                {mode.href ? (
                  <Link
                    href={mode.href}
                    className="font-heading text-lg font-semibold underline-offset-4 hover:underline"
                  >
                    {t(`modes.${mode.key}.name`)}
                  </Link>
                ) : (
                  <span className="font-heading text-lg font-semibold">
                    {t(`modes.${mode.key}.name`)}
                  </span>
                )}
                <p className="text-muted-foreground">{t(`modes.${mode.key}.description`)}</p>
              </div>
              <span
                className={
                  mode.href
                    ? 'shrink-0 text-sm font-medium text-primary'
                    : 'shrink-0 text-sm text-muted-foreground'
                }
              >
                {mode.href ? t('available') : t('soon')}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
