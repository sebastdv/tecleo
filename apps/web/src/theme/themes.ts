import type { ThemeId } from '@tecleo/shared';

/**
 * Design tokens de cada tema. Esta es la única fuente: `themeCss()` genera las variables CSS
 * y `themes.test.ts` verifica el contraste WCAG AA de cada combinación.
 */
export interface ThemeTokens {
  readonly scheme: 'dark' | 'light';
  /** Fondo de la página. */
  readonly background: string;
  /** Texto principal; también el texto ya escrito correctamente. */
  readonly foreground: string;
  /** Paneles y menús. */
  readonly surface: string;
  /** Controles, pistas y fondos secundarios. */
  readonly muted: string;
  /** Texto secundario. */
  readonly mutedForeground: string;
  /** Texto que falta por escribir. */
  readonly pending: string;
  readonly border: string;
  /** Acento: cursor, acciones principales, foco. */
  readonly accent: string;
  readonly accentForeground: string;
  /** Errores de escritura. */
  readonly error: string;
}

export const THEME_TOKENS: Readonly<Record<ThemeId, ThemeTokens>> = {
  // Tinta: azul de imprenta, papel y latón de los tipos móviles. Tema por defecto.
  ink: {
    scheme: 'dark',
    background: '#161a2b',
    foreground: '#ece6d8',
    surface: '#1f2439',
    muted: '#272d47',
    mutedForeground: '#a3a8c3',
    pending: '#8a8fae',
    border: '#343b5c',
    accent: '#d9a441',
    accentForeground: '#1a1406',
    error: '#ff7a73',
  },
  // Día: papel frío con tinta azul; el latón se oscurece para leerse sobre blanco.
  day: {
    scheme: 'light',
    background: '#f5f6fa',
    foreground: '#1b2033',
    surface: '#ffffff',
    muted: '#e8eaf2',
    mutedForeground: '#4f5570',
    pending: '#666c88',
    border: '#cfd3e1',
    accent: '#8a5a00',
    accentForeground: '#ffffff',
    error: '#b8232f',
  },
  graphite: {
    scheme: 'dark',
    background: '#1c1d20',
    foreground: '#e6e6e3',
    surface: '#25262a',
    muted: '#2f3135',
    mutedForeground: '#a9abb0',
    pending: '#8b8d93',
    border: '#3d3f45',
    accent: '#6cc4d9',
    accentForeground: '#0c181c',
    error: '#ff8080',
  },
  forest: {
    scheme: 'dark',
    background: '#13221c',
    foreground: '#e3eadf',
    surface: '#1a2d25',
    muted: '#22392f',
    mutedForeground: '#a3b8ab',
    pending: '#86a090',
    border: '#2f4b3e',
    accent: '#c5d86d',
    accentForeground: '#17200a',
    error: '#ff8f7f',
  },
  plum: {
    scheme: 'dark',
    background: '#221627',
    foreground: '#f0e4ec',
    surface: '#2c1d33',
    muted: '#37263f',
    mutedForeground: '#bfaac5',
    pending: '#a18dab',
    border: '#4a3454',
    accent: '#f4b860',
    accentForeground: '#2a1a05',
    error: '#ff7d93',
  },
  // Alto contraste: blanco y amarillo puros sobre negro.
  contrast: {
    scheme: 'dark',
    background: '#000000',
    foreground: '#ffffff',
    surface: '#0d0d0d',
    muted: '#1f1f1f',
    mutedForeground: '#e6e6e6',
    pending: '#b3b3b3',
    border: '#ffffff',
    accent: '#ffe14d',
    accentForeground: '#000000',
    error: '#ff9b9b',
  },
};

/** Variables CSS de un tema, con los nombres que esperan Tailwind y shadcn/ui. */
function themeVariables(tokens: ThemeTokens): string {
  const variables: Record<string, string> = {
    '--background': tokens.background,
    '--foreground': tokens.foreground,
    '--card': tokens.surface,
    '--card-foreground': tokens.foreground,
    '--popover': tokens.surface,
    '--popover-foreground': tokens.foreground,
    '--primary': tokens.accent,
    '--primary-foreground': tokens.accentForeground,
    '--secondary': tokens.muted,
    '--secondary-foreground': tokens.foreground,
    '--muted': tokens.muted,
    '--muted-foreground': tokens.mutedForeground,
    '--accent': tokens.muted,
    '--accent-foreground': tokens.foreground,
    '--destructive': tokens.error,
    '--border': tokens.border,
    '--input': tokens.border,
    '--ring': tokens.accent,
    '--pending': tokens.pending,
    '--error': tokens.error,
    '--chart-1': tokens.accent,
    '--chart-2': tokens.mutedForeground,
    '--chart-3': tokens.error,
    '--chart-4': tokens.foreground,
    '--chart-5': tokens.pending,
  };
  return Object.entries(variables)
    .map(([name, value]) => `${name}:${value};`)
    .join('');
}

/** Hoja con todos los temas; el tema activo se elige con `data-theme` en `<html>`. */
export function themeCss(): string {
  return Object.entries(THEME_TOKENS)
    .map(([id, tokens]) => {
      const selector = id === 'ink' ? `:root,[data-theme="${id}"]` : `[data-theme="${id}"]`;
      return `${selector}{color-scheme:${tokens.scheme};${themeVariables(tokens)}}`;
    })
    .join('\n');
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Color inválido: ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => channel(Number.parseInt(part, 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** Relación de contraste WCAG 2.1 entre dos colores (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}
