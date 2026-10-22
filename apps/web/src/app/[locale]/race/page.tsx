import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { RaceScreen } from '@/features/race/race-screen';
import { RaceModesNav } from '@/features/room/race-modes-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('race');
  return { title: t('title') };
}

export default function RacePage() {
  const t = useTranslations('race');
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome className="flex flex-col gap-6">
        <RaceModesNav />
        <PageHeader title={t('title')} description={t('description')} />
      </div>
      <RaceScreen />
    </PageContainer>
  );
}
