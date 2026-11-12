import { create } from 'zustand';
import {
  findWornHousehold,
  forgetHousehold,
  onHouseholdKnown,
  type Role,
} from '@/services/household/householdApi';
import { storage } from '@/services/storage';
import { nextWearerRoute, WEARER_STEP } from '@/features/wearer/steps';

/**
 * Setup progress, kept on this phone so setup resumes where the person left off. On load it is brought up to date
 * from the server (GET /me/home, A4): a household set up on another phone, or before a web reload, is picked up.
 * PENDING BACKEND: the server's setup checklist does not cover every app step (permissions, C4 checks), so the
 * step number stays the phone's; the server can only move it forward.
 */

/** Flow B to D has about 7 steps (role, permissions, box, basics, contacts, link, pairing). Not final. */
export const SETUP_TOTAL_STEPS = 7;

const key = (userId: string) => `svaraa.household.setup.${userId}`;

type SetupState = {
  userId?: string;
  /** Chosen at B1. Undefined until then ("not sure" leaves it empty). */
  role?: Role;
  householdId?: string;
  /** Caregiver only: notifications allowed and the push token saved (B3 done). */
  notificationsDone: boolean;
  /** 0 = not started. Otherwise the last step the person finished (saved, so setup can resume). */
  setupStep: number;
  totalSteps: number;
  /** True once a pendant is Active. The setup card disappears then. */
  hasActiveDevice: boolean;
  load(userId: string): Promise<void>;
  /** B1 done: the household exists with this role. Counts as step 1. */
  chooseRole(role: Role, householdId: string): Promise<void>;
  /** B3 done. Counts as step 2. */
  finishNotifications(): Promise<void>;
  /** A setup step is finished (never moves progress back). */
  reachStep(step: number): Promise<void>;
  /** The pendant is Active (wearer: SOS drill passed). The Home setup card goes away. */
  activate(): Promise<void>;
  /** Test helper until real setup screens exist. */
  advance(): Promise<void>;
  reset(): Promise<void>;
  /** Forget what is in memory (on sign-out). The saved copy stays for the next sign-in. */
  unload: () => void;
};

type Saved = {
  setupStep: number;
  hasActiveDevice: boolean;
  role?: Role;
  householdId?: string;
  notificationsDone?: boolean;
};

async function persist(s: SetupState) {
  if (!s.userId) return;
  const saved: Saved = {
    setupStep: s.setupStep,
    hasActiveDevice: s.hasActiveDevice,
    role: s.role,
    householdId: s.householdId,
    notificationsDone: s.notificationsDone,
  };
  await storage.set(key(s.userId), JSON.stringify(saved));
}

export const useHousehold = create<SetupState>((set, get) => ({
  setupStep: 0,
  totalSteps: SETUP_TOTAL_STEPS,
  hasActiveDevice: false,
  notificationsDone: false,

  load: async (userId) => {
    forgetHousehold();
    let saved: Saved | null = null;
    try {
      const raw = await storage.get(key(userId));
      saved = raw ? (JSON.parse(raw) as Saved) : null;
    } catch {
      /* unreadable: start fresh */
    }
    set({
      userId,
      setupStep: saved?.setupStep ?? 0,
      hasActiveDevice: saved?.hasActiveDevice ?? false,
      role: saved?.role,
      householdId: saved?.householdId,
      notificationsDone: saved?.notificationsDone ?? false,
    });
    await syncWithServer(userId);
  },

  chooseRole: async (role, householdId) => {
    set((s) => ({ role, householdId, setupStep: Math.max(s.setupStep, 1) }));
    await persist(get());
  },

  finishNotifications: async () => {
    set((s) => ({ notificationsDone: true, setupStep: Math.max(s.setupStep, 2) }));
    await persist(get());
  },

  reachStep: async (step) => {
    set((s) => ({ setupStep: Math.min(Math.max(s.setupStep, step), s.totalSteps) }));
    await persist(get());
  },

  activate: async () => {
    set((s) => ({ setupStep: s.totalSteps, hasActiveDevice: true }));
    await persist(get());
  },

  advance: async () => {
    const { setupStep, totalSteps } = get();
    const next = Math.min(setupStep + 1, totalSteps);
    set({ setupStep: next, hasActiveDevice: next >= totalSteps });
    await persist(get());
  },

  reset: async () => {
    set({
      setupStep: 0,
      hasActiveDevice: false,
      role: undefined,
      householdId: undefined,
      notificationsDone: false,
    });
    await persist(get());
  },

  unload: () => {
    forgetHousehold();
    set({
      userId: undefined,
      setupStep: 0,
      hasActiveDevice: false,
      role: undefined,
      householdId: undefined,
      notificationsDone: false,
    });
  },
}));

// Once the server has the household (C1 created it, or GET /me/home named it), keep its real id instead of the
// placeholder B1 saved, so it is still there after a reload.
onHouseholdKnown((id) => {
  const s = useHousehold.getState();
  if (!s.userId || s.householdId === id) return;
  useHousehold.setState({ role: 'wearer', householdId: id });
  void persist(useHousehold.getState());
});

/**
 * A4: take the household this person wears from the server, if there is one, and move the progress forward to
 * match it: the household exists (C1 done), it is active (pendant verified and a contact saved), or protected
 * (an SOS drill passed). Offline or signed out: keep what the phone has.
 */
async function syncWithServer(userId: string) {
  let worn: Awaited<ReturnType<typeof findWornHousehold>>;
  try {
    worn = await findWornHousehold();
  } catch {
    return;
  }
  const s = useHousehold.getState();
  if (!worn || s.userId !== userId) return;
  if (worn.protected) {
    useHousehold.setState({ role: 'wearer', householdId: worn.id });
    await s.activate();
    return;
  }
  const step = worn.state === 'active' ? WEARER_STEP.contacts : WEARER_STEP.about;
  useHousehold.setState((x) => ({
    role: 'wearer',
    householdId: worn.id,
    setupStep: Math.min(Math.max(x.setupStep, step), x.totalSteps),
  }));
  await persist(useHousehold.getState());
}

/**
 * Where the setup card sends the person: the first step they have not finished.
 * No role yet: B1. Wearer: the next C step (see features/wearer/steps.ts). Caregiver: B3, then D1 (FE-04; /setup for now).
 * `paired`: the wearer paired the pendant (C3) but has not done the checks (C4).
 */
export function nextSetupRoute(
  s: Pick<SetupState, 'role' | 'notificationsDone'> & { setupStep?: number; paired?: boolean },
) {
  if (!s.role) return '/role' as const;
  if (s.role === 'wearer') return nextWearerRoute(s.setupStep ?? 0, s.paired);
  return s.notificationsDone ? ('/setup' as const) : ('/caregiver-permissions' as const);
}
