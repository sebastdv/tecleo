import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { PageContainer } from '@/components/layout/page-container';
import { ReplayScreen } from '@/features/replay/replay-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('replay');
  return { title: t('title') };
}

async function Replay({ params }: { params: PageProps<'/[locale]/replay/[resultId]'>['params'] }) {
  const { resultId } = await params;
  return <ReplayScreen resultId={resultId} />;
}

export default function ReplayPage({ params }: PageProps<'/[locale]/replay/[resultId]'>) {
  return (
    <PageContainer className="max-w-5xl">
      <Suspense>
        <Replay params={params} />
      </Suspense>
    </PageContainer>
  );
}
