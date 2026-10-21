import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { Upcoming } from '@/components/upcoming';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('leaderboards');
  return { title: t('title') };
}

export default function LeaderboardsPage() {
  const t = useTranslations('leaderboards');
  return <Upcoming title={t('title')} description={t('description')} />;
}
