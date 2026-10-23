import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { GhostScreen } from '@/features/ghost/ghost-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('ghost');
  return { title: t('title') };
}

async function Ghost({ params }: { params: PageProps<'/[locale]/ghost/[resultId]'>['params'] }) {
  const { resultId } = await params;
  return <GhostScreen resultId={resultId} />;
}

export default function GhostPage({ params }: PageProps<'/[locale]/ghost/[resultId]'>) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense>
        <Ghost params={params} />
      </Suspense>
    </PageContainer>
  );
}
