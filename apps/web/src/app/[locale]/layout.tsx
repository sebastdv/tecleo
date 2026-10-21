import type { Metadata } from 'next';
import {
  Fira_Code,
  Geist_Mono,
  IBM_Plex_Mono,
  JetBrains_Mono,
  Schibsted_Grotesk,
} from 'next/font/google';
import { notFound } from 'next/navigation';
import { locale as localeParam } from 'next/root-params';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { SiteShell } from '@/components/layout/site-shell';
import { Providers } from '@/components/providers';
import { routing } from '@/i18n/routing';
import { SessionBootstrap } from '@/auth/session-bootstrap';
import { SettingsEffects } from '@/settings/settings-effects';
import { SettingsSync } from '@/settings/settings-sync';
import { themeScript } from '@/settings/theme-script';
import { themeCss } from '@/theme/themes';

import '../globals.css';

const schibsted = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted' });
// Solo la tipografía de juego por defecto se precarga; las demás se piden al elegirlas.
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
const plex = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex',
  preload: false,
});
const fira = Fira_Code({ subsets: ['latin'], variable: '--font-fira', preload: false });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', preload: false });

const fontVariables = [schibsted, jetbrains, plex, fira, geistMono]
  .map((font) => font.variable)
  .join(' ');

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await localeParam();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    // El script de <head> ajusta data-theme antes de hidratar; la diferencia es esperada.
    <html lang={locale} data-theme="ink" className={fontVariables} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
        {/* Aplica el tema guardado durante el parseo del HTML, antes del primer pintado. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <SettingsEffects />
            <SessionBootstrap />
            <SettingsSync />
            <SiteShell>{children}</SiteShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
