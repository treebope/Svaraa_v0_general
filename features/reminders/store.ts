import { create } from 'zustand';
import { storage } from '@/services/storage';
import { sampleReminders, type Draft, type Reminder } from './logic';

const KEY = 'svaraa.reminders';

type State = {
  items: Reminder[];
  loaded: boolean;
  load(): Promise<void>;
  add(draft: Draft, by: string): string;
  update(id: string, draft: Draft): void;
  remove(id: string): void;
  togglePause(id: string): void;
};

/**
 * PENDING BACKEND: reminders live on this device (with sample ones to start) until the reminders API exists.
 * The pendant will say them and report back whether the wearer confirmed.
 */
export const useReminders = create<State>((set, get) => {
  const keep = (items: Reminder[]) => {
    set({ items });
    void storage.set(KEY, JSON.stringify(items)).catch(() => undefined);
  };
  return {
    items: [],
    loaded: false,
    load: async () => {
      if (get().loaded) return;
      let items: Reminder[] | undefined;
      try {
        const raw = await storage.get(KEY);
        items = raw ? (JSON.parse(raw) as Reminder[]) : undefined;
      } catch {
        /* unreadable: start with the samples */
      }
      set({ items: items ?? sampleReminders(new Date()), loaded: true });
    },
    add: (draft, by) => {
      const id = `r${Date.now()}`;
      keep([...get().items, { ...draft, id, by, paused: false, history: [] }]);
      return id;
    },
    update: (id, draft) => keep(get().items.map((r) => (r.id === id ? { ...r, ...draft } : r))),
    remove: (id) => keep(get().items.filter((r) => r.id !== id)),
    togglePause: (id) => keep(get().items.map((r) => (r.id === id ? { ...r, paused: !r.paused } : r))),
  };
});
