import { useTranslations } from 'next-intl';

import { PageContainer } from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default function NotFoundPage() {
  const t = useTranslations('notFound');
  return (
    <PageContainer className="justify-center">
      <div className="flex max-w-xl flex-col items-start gap-4">
        <p aria-hidden="true" className="font-game text-6xl text-pending">
          4<span className="text-error underline decoration-2 underline-offset-8">0</span>4
        </p>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('description')}</p>
        <Button asChild>
          <Link href="/">{t('cta')}</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
