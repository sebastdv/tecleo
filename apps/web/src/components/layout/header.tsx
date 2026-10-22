'use client';

import { LANGUAGES, THEMES, type Language, type ThemeId } from '@tecleo/shared';
import { Languages, LogOut, Menu, Palette, Settings, User } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { logout } from '@/auth/auth-actions';
import { useAuthStore } from '@/auth/auth-store';
import { TypeAvatar } from '@/components/type-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link, usePathname } from '@/i18n/navigation';
import { useSettings, useSettingsStore } from '@/settings/settings-store';
import { THEME_TOKENS } from '@/theme/themes';

import { Logo } from './logo';

const NAV_ITEMS = [
  { href: '/practice', key: 'practice' },
  { href: '/race', key: 'race' },
  { href: '/leaderboards', key: 'leaderboards' },
] as const;

/** "Carreras" agrupa las tres pantallas de carrera (bots, pública y salas). */
const SECTIONS: Readonly<Record<string, readonly string[]>> = {
  '/race': ['/race', '/play', '/room'],
};

function isActive(pathname: string, href: string): boolean {
  return (SECTIONS[href] ?? [href]).some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

interface NavLinksProps {
  readonly vertical?: boolean;
  readonly onNavigate?: () => void;
}

function NavList({
  vertical = false,
  onNavigate,
  pathname,
}: NavLinksProps & { pathname: string | null }) {
  const t = useTranslations('nav');
  return (
    <ul className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-1'}>
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className="relative block rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
            >
              {t(item.key)}
              {active && !vertical && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 -bottom-[0.6rem] h-0.5 rounded-full bg-primary"
                />
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveNavList(props: NavLinksProps) {
  return <NavList {...props} pathname={usePathname()} />;
}

/**
 * La ruta actual es dato de la petición en las páginas dinámicas (`/profile/[nickname]`):
 * se lee dentro de Suspense y, mientras tanto, los enlaces se muestran sin marcar.
 */
function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <ActiveNavList {...props} />
    </Suspense>
  );
}

function ThemeMenu() {
  const t = useTranslations();
  const { theme } = useSettings();
  const update = useSettingsStore((state) => state.update);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('nav.theme')}>
              <Palette />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('nav.theme')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t('nav.theme')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            update({ theme: value as ThemeId });
          }}
        >
          {THEMES.map((id) => (
            <DropdownMenuRadioItem key={id} value={id} className="gap-2">
              <span
                aria-hidden="true"
                className="inline-flex size-4 items-center justify-center rounded-sm border"
                style={{ background: THEME_TOKENS[id].background }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: THEME_TOKENS[id].accent }}
                />
              </span>
              {t(`settings.themes.${id}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const LOCALE_PREFIX = new RegExp(`^/(${LANGUAGES.join('|')})(?=/|$)`);

/**
 * Cambia el idioma de la URL (y por tanto de la interfaz) conservando la página actual.
 * Es una navegación completa: el layout raíz cambia entero (`<html lang>`) y así el script
 * del tema no se vuelve a renderizar en el cliente. La ruta se lee al hacer clic.
 */
export function useSwitchLanguage() {
  const update = useSettingsStore((state) => state.update);
  return (language: Language) => {
    update({ interfaceLanguage: language });
    const { pathname, search } = window.location;
    const rest = pathname.replace(LOCALE_PREFIX, '');
    // Navegación completa a propósito (ver arriba): useRouter() re-renderizaría el layout raíz.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/${language}${rest}${search}`);
  };
}

function LanguageMenu() {
  const t = useTranslations();
  const locale = useLocale();
  const switchLanguage = useSwitchLanguage();
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t('nav.language')}>
              <Languages />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('nav.language')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('nav.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            switchLanguage(value as Language);
          }}
        >
          {LANGUAGES.map((language) => (
            <DropdownMenuRadioItem key={language} value={language} lang={language}>
              {language === 'es' ? 'Español' : 'English'}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Entrar" para invitados; menú con perfil y salir con sesión. Nada mientras se comprueba. */
function AccountMenu({ mobile = false }: { mobile?: boolean }) {
  const t = useTranslations('nav');
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  if (status === 'unknown')
    return <span aria-hidden="true" className={mobile ? '' : 'ml-2 hidden w-16 sm:block'} />;
  if (status !== 'authenticated' || !user) {
    return (
      <Button
        variant="outline"
        size={mobile ? 'default' : 'sm'}
        asChild
        className={mobile ? '' : 'ml-2 hidden sm:inline-flex'}
      >
        <Link href="/login">{t('login')}</Link>
      </Button>
    );
  }
  if (mobile) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="outline" asChild>
          <Link href={`/profile/${user.nickname}`}>{t('profile')}</Link>
        </Button>
        <Button variant="ghost" onClick={() => void logout()}>
          {t('logout')}
        </Button>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="ml-2 hidden h-9 gap-2 px-2 sm:inline-flex"
          aria-label={`${t('account')}: ${user.nickname}`}
        >
          <TypeAvatar nickname={user.nickname} avatar={user.avatar} size="sm" />
          <span className="max-w-32 truncate text-sm">{user.nickname}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild>
          <Link href={`/profile/${user.nickname}`}>
            <User />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const t = useTranslations('nav');
  return (
    <header data-chrome className="border-b border-border/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="rounded-sm" aria-label={`${t('home')}: Tecleo`}>
          <Logo />
        </Link>
        <nav aria-label={t('primary')} className="hidden md:block">
          <NavLinks />
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeMenu />
          <LanguageMenu />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/settings" aria-label={t('settings')}>
                  <Settings />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('settings')}</TooltipContent>
          </Tooltip>
          <AccountMenu />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function MobileMenu() {
  const t = useTranslations('nav');
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('openMenu')}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="gap-6 p-6">
        <SheetTitle>
          <Logo />
        </SheetTitle>
        <nav aria-label={t('primary')}>
          <NavLinks vertical />
        </nav>
        <AccountMenu mobile />
      </SheetContent>
    </Sheet>
  );
}
