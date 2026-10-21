import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Upcoming } from '@/components/upcoming';

async function Profile({
  params,
}: {
  params: PageProps<'/[locale]/profile/[nickname]'>['params'];
}) {
  const { nickname } = await params;
  const t = await getTranslations('profile');
  return (
    <Upcoming
      title={t('title', { nickname: decodeURIComponent(nickname) })}
      description={t('description')}
    />
  );
}

export default function ProfilePage({ params }: PageProps<'/[locale]/profile/[nickname]'>) {
  return (
    <Suspense>
      <Profile params={params} />
    </Suspense>
  );
}
