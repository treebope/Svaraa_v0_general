import { create } from 'zustand';
import type { ThemeMode } from '@/ui/theme';
import type { Language } from '@/i18n';
import type { HomeBackgroundId } from './homeBackground';

export type SchemePreference = 'system' | 'light' | 'dark';

/**
 * Profile accessibility level shown as 1 / 2 / 3 in the UI.
 * Actual zoom is milder: 1 → 1×, 2 → 1.2×, 3 → 1.3× (see `displayScaleFactor`).
 */
export type DisplayScale = 1 | 2 | 3;
export const DISPLAY_SCALES: readonly DisplayScale[] = [1, 2, 3];

type SettingsState = {
  themeMode: ThemeMode;
  scheme: SchemePreference;
  language: Language;
  /** Main-app page background (Chat / Apps / Profile). Placeholders until real art lands. */
  homeBackground: HomeBackgroundId;
  /** Multiplies fonts (and Apps tile size). Buttons stay the same tap size. */
  displayScale: DisplayScale;
  setThemeMode: (mode: ThemeMode) => void;
  setScheme: (scheme: SchemePreference) => void;
  setLanguage: (language: Language) => void;
  setHomeBackground: (homeBackground: HomeBackgroundId) => void;
  setDisplayScale: (displayScale: DisplayScale) => void;
};

/** App-level settings. Theme mode will later follow the signed-in role (caregiver or wearer). */
export const useSettings = create<SettingsState>((set) => ({
  themeMode: 'caregiver',
  scheme: 'light',
  language: 'en',
  homeBackground: 'rose',
  displayScale: 1,
  setThemeMode: (themeMode) => set({ themeMode }),
  setScheme: (scheme) => set({ scheme }),
  setLanguage: (language) => set({ language }),
  setHomeBackground: (homeBackground) => set({ homeBackground }),
  setDisplayScale: (displayScale) => set({ displayScale }),
}));
