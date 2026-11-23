import { storage } from '@/services/storage';
import { DISPLAY_SCALES, useSettings, type DisplayScale } from './store';

const KEY = 'svaraa.displayScale';

/**
 * UI levels 1 / 2 / 3 map to mild zoom factors (not literal 2× / 3×).
 * 1 → 1, 2 → 1.2, 3 → 1.3
 */
export const DISPLAY_SCALE_FACTOR: Record<DisplayScale, number> = {
  1: 1,
  2: 1.2,
  3: 1.3,
};

export function displayScaleFactor(level: DisplayScale): number {
  return DISPLAY_SCALE_FACTOR[level] ?? 1;
}

/** Switch text / Apps size everywhere and remember it. */
export async function setAppDisplayScale(displayScale: DisplayScale): Promise<void> {
  useSettings.getState().setDisplayScale(displayScale);
  await storage.set(KEY, String(displayScale));
}

/** Call once at start: restores the saved scale, if any. */
export async function restoreDisplayScale(): Promise<void> {
  const saved = await storage.get(KEY);
  const n = saved ? Number(saved) : NaN;
  if ((DISPLAY_SCALES as readonly number[]).includes(n)) {
    useSettings.getState().setDisplayScale(n as DisplayScale);
  }
}
