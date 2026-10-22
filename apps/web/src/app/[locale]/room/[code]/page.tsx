import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { RaceModesNav } from '@/features/room/race-modes-nav';
import { RoomScreen } from '@/features/room/room-screen';

type Params = PageProps<'/[locale]/room/[code]'>['params'];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations('room');
  return { title: t('title', { code: code.toUpperCase() }) };
}

async function Room({ params }: { params: Params }) {
  const { code } = await params;
  const t = await getTranslations('room');
  const upper = code.toUpperCase();
  return (
    <>
      <div data-chrome className="flex flex-col gap-6">
        <RaceModesNav />
        <PageHeader title={t('title', { code: upper })} description={t('description')} />
      </div>
      <RoomScreen target={{ mode: 'private', code: upper }} />
    </>
  );
}

// El código de sala solo se conoce al pedir la página: se resuelve dentro de Suspense.
export default function RoomPage({ params }: PageProps<'/[locale]/room/[code]'>) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense>
        <Room params={params} />
      </Suspense>
    </PageContainer>
  );
}
