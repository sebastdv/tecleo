import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { Upcoming } from '@/components/upcoming';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('race');
  return { title: t('title') };
}

export default function RacePage() {
  const t = useTranslations('race');
  return <Upcoming title={t('title')} description={t('description')} />;
}
