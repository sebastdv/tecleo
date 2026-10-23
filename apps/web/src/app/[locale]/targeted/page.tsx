import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { TargetedScreen } from '@/features/targeted/targeted-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('targeted');
  return { title: t('title') };
}

export default function TargetedPage() {
  const t = useTranslations('targeted');
  return (
    <PageContainer className="max-w-5xl">
      <div data-chrome>
        <PageHeader title={t('title')} description={t('description')} />
      </div>
      <TargetedScreen />
    </PageContainer>
  );
}
