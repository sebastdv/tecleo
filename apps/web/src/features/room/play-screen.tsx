'use client';

import { useSettings } from '@/settings/settings-store';

import { RoomScreen } from './room-screen';

/** Matchmaking público en el idioma de los textos de la persona. */
export function PlayScreen() {
  const { textLanguage } = useSettings();
  return <RoomScreen target={{ mode: 'public', language: textLanguage }} />;
}
