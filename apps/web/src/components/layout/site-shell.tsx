import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { ServerStatus } from '@/components/server-status';

import { Header } from './header';

function Footer() {
  const t = useTranslations('footer');
  const external = (href: string) =>
    function ExternalLink(chunks: ReactNode) {
      return (
        <a
          href={href}
          className="underline underline-offset-2 hover:text-foreground"
          rel="noreferrer"
        >
          {chunks}
        </a>
      );
    };
  return (
    <footer data-chrome className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="max-w-prose">
          {t.rich('credits', {
            gutenberg: external('https://www.gutenberg.org'),
            frequency: external('https://github.com/hermitdave/FrequencyWords'),
          })}
        </p>
        <div className="flex items-center gap-4">
          <ServerStatus />
          <a
            href="https://github.com/sebastdv/tecleo"
            className="underline underline-offset-2 hover:text-foreground"
            rel="noreferrer"
          >
            {t('source')}
          </a>
        </div>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('skipToContent')}
      </a>
      <Header />
      <main id="content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
