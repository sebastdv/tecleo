import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * Pantalla de una función que todavía no existe. Dice qué hará y ofrece lo que sí funciona;
 * no simula datos ni controles.
 */
export function Upcoming({ title, description }: { title: ReactNode; description: ReactNode }) {
  const t = useTranslations('upcoming');
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <section className="flex max-w-2xl flex-col items-start gap-4 rounded-lg border border-dashed p-6">
        <h2 className="font-heading text-lg font-semibold">{t('title')}</h2>
        <Button asChild>
          <Link href="/practice">{t('practiceCta')}</Link>
        </Button>
      </section>
    </PageContainer>
  );
}
