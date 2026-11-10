import { create } from 'zustand';
import { storage } from '@/services/storage';
import type { DrillStatus } from '@/services/api';

export type DrillRecord = {
  id: string;
  startedAt: string;
  status: Exclude<DrillStatus, 'waiting'>;
  answeredBy?: string;
  /** Seconds from the start until it passed or expired. */
  seconds: number;
};

const KEY = 'svaraa.drillHistory';
export const KEEP_DRILLS = 10;

type State = {
  records: DrillRecord[];
  load(): Promise<void>;
  record(r: DrillRecord): Promise<void>;
};

/**
 * The last SOS drills and how each ended, newest first, kept on this device.
 * PENDING BACKEND: a drill history endpoint would replace this local list.
 */
export const useDrillRecords = create<State>((set, get) => ({
  records: [],
  load: async () => {
    try {
      const raw = await storage.get(KEY);
      if (raw) set({ records: JSON.parse(raw) as DrillRecord[] });
    } catch {
      /* an unreadable list just starts empty */
    }
  },
  record: async (r) => {
    if (get().records.some((x) => x.id === r.id)) return;
    const records = [r, ...get().records].slice(0, KEEP_DRILLS);
    set({ records });
    await storage.set(KEY, JSON.stringify(records));
  },
}));
