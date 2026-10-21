import { z } from 'zod';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const THEMES = ['ink', 'day', 'graphite', 'forest', 'plum', 'contrast'] as const;
export type ThemeId = (typeof THEMES)[number];

export const GAME_FONTS = ['jetbrains', 'plex', 'fira', 'geist'] as const;
export type GameFont = (typeof GAME_FONTS)[number];

export const GAME_FONT_SIZES = ['s', 'm', 'l', 'xl'] as const;
export type GameFontSize = (typeof GAME_FONT_SIZES)[number];

export const CARET_STYLES = ['line', 'block', 'underline'] as const;
export type CaretStyle = (typeof CARET_STYLES)[number];

export const KEY_SOUNDS = ['off', 'click', 'soft', 'typewriter'] as const;
export type KeySound = (typeof KEY_SOUNDS)[number];

/** Distribución física del teclado, para dibujar el mapa de calor sobre las teclas correctas. */
export const KEYBOARD_LAYOUTS = ['es-ES', 'es-LA', 'en-US'] as const;
export type KeyboardLayout = (typeof KEYBOARD_LAYOUTS)[number];

export const BOT_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert', 'legend'] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];

/**
 * Preferencias del usuario. Se guardan en `localStorage` para invitados y en el servidor
 * (`UserSettings`) con sesión. Cada campo tiene valor por defecto: un JSON viejo o parcial
 * se completa en lugar de fallar.
 */
export const userSettingsSchema = z.object({
  theme: z.enum(THEMES).catch('ink').default('ink'),
  gameFont: z.enum(GAME_FONTS).catch('jetbrains').default('jetbrains'),
  gameFontSize: z.enum(GAME_FONT_SIZES).catch('m').default('m'),
  caretStyle: z.enum(CARET_STYLES).catch('line').default('line'),
  /** Reglas por defecto en práctica; las carreras siempre son estrictas. */
  typingMode: z.enum(['strict', 'free']).catch('free').default('free'),
  ignoreAccents: z.boolean().catch(false).default(false),
  keySound: z.enum(KEY_SOUNDS).catch('off').default('off'),
  soundVolume: z.number().min(0).max(1).catch(0.5).default(0.5),
  showLiveStats: z.boolean().catch(true).default(true),
  /** Esconde todo menos el texto mientras se escribe. */
  focusMode: z.boolean().catch(false).default(false),
  interfaceLanguage: z.enum(LANGUAGES).catch('es').default('es'),
  textLanguage: z.enum(LANGUAGES).catch('es').default('es'),
  keyboardLayout: z.enum(KEYBOARD_LAYOUTS).catch('es-LA').default('es-LA'),
  botLevel: z.enum(BOT_LEVELS).catch('intermediate').default('intermediate'),
});

export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_SETTINGS: UserSettings = userSettingsSchema.parse({});

/** Lee preferencias de cualquier origen (JSON guardado, respuesta del servidor) sin lanzar errores. */
export function parseSettings(value: unknown): UserSettings {
  const result = userSettingsSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_SETTINGS;
}
