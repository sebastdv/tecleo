import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { TextScreen } from '@/features/leaderboards/text-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('textPage');
  return { title: t('title') };
}

async function Text({ params }: { params: PageProps<'/[locale]/texts/[id]'>['params'] }) {
  const { id } = await params;
  return <TextScreen textId={decodeURIComponent(id)} />;
}

export default function TextPage({ params }: PageProps<'/[locale]/texts/[id]'>) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense>
        <Text params={params} />
      </Suspense>
    </PageContainer>
  );
}
