import { create } from 'zustand';
import { storage } from '@/services/storage';

const KEY = 'svaraa.manage-apps';

/** The apps the wearer's Explore tab and pendant can use, in the order the wireframe (F7) lists them. */
export const MANAGED = ['reminders', 'news', 'riddles', 'music'] as const;
export type ManagedId = (typeof MANAGED)[number];

type Saved = {
  enabled: Record<ManagedId, boolean>;
  /** Quiet hours, in minutes after midnight. No news, riddles or music between these times. */
  quietStart: number;
  quietEnd: number;
  /** Still say important reminders in quiet hours, at a lower volume. */
  quietReminders: boolean;
};

type State = Saved & {
  load(): Promise<void>;
  setEnabled(id: ManagedId, on: boolean): void;
  setQuiet(patch: Partial<Pick<Saved, 'quietStart' | 'quietEnd' | 'quietReminders'>>): void;
};

const DEFAULTS: Saved = {
  enabled: { reminders: true, news: true, riddles: true, music: true },
  quietStart: 22 * 60,
  quietEnd: 6 * 60,
  quietReminders: true,
};

/**
 * PENDING BACKEND: Manage apps (F7) is kept on this device until the backend can store it per wearer and the
 * pendant can read it. Turning an app off already hides its tile on Explore.
 */
export const useManageApps = create<State>((set, get) => {
  const keep = (patch: Partial<Saved>) => {
    set(patch);
    const { enabled, quietStart, quietEnd, quietReminders } = get();
    void storage
      .set(KEY, JSON.stringify({ enabled, quietStart, quietEnd, quietReminders }))
      .catch(() => undefined);
  };
  return {
    ...DEFAULTS,
    load: async () => {
      try {
        const raw = await storage.get(KEY);
        const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
        set({ ...DEFAULTS, ...saved, enabled: { ...DEFAULTS.enabled, ...saved.enabled } });
      } catch {
        /* unreadable: keep the defaults */
      }
    },
    setEnabled: (id, on) => keep({ enabled: { ...get().enabled, [id]: on } }),
    setQuiet: (patch) => keep(patch),
  };
});
