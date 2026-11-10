import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { NewsRegion } from '@/services/news/newsApi';

const KEY = 'svaraa.news.region';

type State = {
  region: NewsRegion;
  load(): Promise<void>;
  setRegion(region: NewsRegion): void;
};

/** Which region the News app shows (worldwide, India, US or Canada), remembered on this device. */
export const useNewsRegion = create<State>((set) => ({
  region: 'world',
  load: async () => {
    try {
      const saved = await storage.get(KEY);
      if (saved === 'world' || saved === 'IN' || saved === 'US' || saved === 'CA') set({ region: saved });
    } catch {
      /* keep the default */
    }
  },
  setRegion: (region) => {
    set({ region });
    void storage.set(KEY, region).catch(() => undefined);
  },
}));
