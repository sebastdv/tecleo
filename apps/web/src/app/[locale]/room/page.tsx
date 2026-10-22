import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { RaceModesNav } from '@/features/room/race-modes-nav';
import { RoomEntry } from '@/features/room/room-entry';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('room');
  return { title: t('entryTitle') };
}

export default function RoomEntryPage() {
  const t = useTranslations('room');
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome className="flex flex-col gap-6">
        <RaceModesNav />
        <PageHeader title={t('entryTitle')} description={t('entryDescription')} />
      </div>
      <RoomEntry />
    </PageContainer>
  );
}
