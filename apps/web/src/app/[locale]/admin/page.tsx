import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { AdminTextsScreen } from '@/features/admin/admin-texts-screen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin');
  return { title: t('title'), robots: { index: false } };
}

export default function AdminPage() {
  const t = useTranslations('admin');
  return (
    <PageContainer className="max-w-5xl">
      <PageHeader title={t('title')} description={t('description')} />
      <AdminTextsScreen />
    </PageContainer>
  );
}
