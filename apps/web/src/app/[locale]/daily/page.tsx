import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DailyScreen } from '@/features/daily/daily-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('daily');
  return { title: t('title') };
}

export default function DailyPage() {
  const t = useTranslations('daily');
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome>
        <PageHeader title={t('title')} description={t('description')} />
      </div>
      <DailyScreen />
    </PageContainer>
  );
}
