import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PlayScreen } from '@/features/room/play-screen';
import { RaceModesNav } from '@/features/room/race-modes-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('play');
  return { title: t('title') };
}

export default function PlayPage() {
  const t = useTranslations('play');
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome className="flex flex-col gap-6">
        <RaceModesNav />
        <PageHeader title={t('title')} description={t('description')} />
      </div>
      <PlayScreen />
    </PageContainer>
  );
}
