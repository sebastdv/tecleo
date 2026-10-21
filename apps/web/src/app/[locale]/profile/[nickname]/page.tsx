import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ProfileScreen } from '@/features/profile/profile-screen';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/profile/[nickname]'>): Promise<Metadata> {
  const { nickname } = await params;
  const t = await getTranslations('profile');
  return { title: t('title', { nickname: decodeURIComponent(nickname) }) };
}

async function Profile({
  params,
}: {
  params: PageProps<'/[locale]/profile/[nickname]'>['params'];
}) {
  const { nickname } = await params;
  return <ProfileScreen nickname={decodeURIComponent(nickname)} />;
}

// El apodo solo se conoce al pedir la página: se resuelve dentro de Suspense.
export default function ProfilePage({ params }: PageProps<'/[locale]/profile/[nickname]'>) {
  return (
    <PageContainer>
      <Suspense>
        <Profile params={params} />
      </Suspense>
    </PageContainer>
  );
}
