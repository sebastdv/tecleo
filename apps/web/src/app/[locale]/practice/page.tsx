import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PracticeScreen } from '@/features/practice/practice-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('practice');
  return { title: t('title') };
}

export default function PracticePage() {
  const t = useTranslations('practice');
  return (
    <PageContainer className="max-w-5xl justify-center">
      <h1 className="sr-only">{t('title')}</h1>
      <PracticeScreen />
    </PageContainer>
  );
}
