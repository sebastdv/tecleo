'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

import { useSettings, useSettingsStore } from './settings-store';

/**
 * Refleja las preferencias en `<html>` (tema, tipografía, tamaño). El cambio de tema es
 * instantáneo: se desactivan las transiciones durante un cuadro para que nada se anime.
 */
export function SettingsEffects() {
  const { theme, gameFont, gameFontSize, interfaceLanguage } = useSettings();
  const locale = useLocale();

  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);

  // El idioma de la URL manda: la preferencia guardada lo sigue.
  useEffect(() => {
    if (useSettingsStore.persist.hasHydrated() && interfaceLanguage !== locale) {
      useSettingsStore.getState().update({ interfaceLanguage: locale });
    }
  }, [interfaceLanguage, locale]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === theme) return;
    root.dataset.switchingTheme = '';
    root.dataset.theme = theme;
    // Doble rAF: el primer cuadro ya pinta con el tema nuevo sin transiciones.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        delete root.dataset.switchingTheme;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      delete root.dataset.switchingTheme;
    };
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = gameFont;
    document.documentElement.dataset.size = gameFontSize;
  }, [gameFont, gameFontSize]);

  return null;
}
