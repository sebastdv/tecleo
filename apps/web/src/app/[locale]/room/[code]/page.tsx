import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Upcoming } from '@/components/upcoming';

async function Room({ params }: { params: PageProps<'/[locale]/room/[code]'>['params'] }) {
  const { code } = await params;
  const t = await getTranslations('room');
  return (
    <Upcoming title={t('title', { code: code.toUpperCase() })} description={t('description')} />
  );
}

// El código de sala solo se conoce al pedir la página: se resuelve dentro de Suspense.
export default function RoomPage({ params }: PageProps<'/[locale]/room/[code]'>) {
  return (
    <Suspense>
      <Room params={params} />
    </Suspense>
  );
}
