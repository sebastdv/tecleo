import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsForm } from '@/features/settings/settings-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings');
  return { title: t('title') };
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  return (
    <PageContainer>
      <PageHeader title={t('title')} description={t('savedLocally')} />
      <SettingsForm />
    </PageContainer>
  );
}
