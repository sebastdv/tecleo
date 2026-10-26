import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { RaceModesNav } from '@/features/room/race-modes-nav';
import { RoomEntry } from '@/features/room/room-entry';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('room');
  return { title: t('entryTitle') };
}

export default function RoomEntryPage() {
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome>
        <RaceModesNav />
      </div>
      <RoomEntry />
    </PageContainer>
  );
}
