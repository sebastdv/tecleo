import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { AuthForm } from '@/features/auth/auth-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: t('loginTitle') };
}

export default function LoginPage() {
  const t = useTranslations('auth');
  return (
    <PageContainer>
      <PageHeader title={t('loginTitle')} />
      <AuthForm mode="login" />
    </PageContainer>
  );
}
