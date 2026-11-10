import type {
  ConsentIn,
  DeviceOut,
  HouseholdOut,
  PushTokenIn,
  Role,
  ContactIn,
  DrillOut,
  InviteOut,
  WearerProfileIn,
} from '@/services/api/pending';
import type { components } from '@/services/api/schema';

type Profile = components['schemas']['ProfileOut'];
export type MockUser = Profile & { key: string; mobile?: string };

/** Seconds a number must wait before another code can be requested. Same as the real backend. */
export const OTP_COOLDOWN_MS = 60_000;

/** In-memory state behind the mock backend. Resets whenever the app reloads. */
type Db = {
  counter: number;
  users: Map<string, MockUser>;
  /** access token -> user id */
  access: Map<string, string>;
  /** refresh token -> { user id, revoked } */
  refresh: Map<string, { userId: string; revoked: boolean }>;
  otpAskedAt: Map<string, number>;
  /** PENDING BACKEND: user id -> household (one per user for now). */
  households: Map<string, HouseholdOut>;
  /** PENDING BACKEND: user id -> saved push tokens. */
  pushTokens: Map<string, PushTokenIn[]>;
  /** PENDING BACKEND: household id -> what setup saved for it. */
  setup: Map<string, HouseholdSetup>;
  /** PENDING BACKEND: claim code -> device, for every code anyone claimed. */
  claimed: Map<string, DeviceOut & { householdId: string }>;
};

/** What the mock backend keeps per household during setup. */
export type HouseholdSetup = {
  wearer?: WearerProfileIn;
  consents: (ConsentIn & { given_at: string })[];
  contacts: ContactIn[];
  /** Open invites; creating a new one cancels the others. */
  invites: InviteOut[];
  drills: DrillOut[];
};

const fresh = (): Db => ({
  counter: 0,
  users: new Map(),
  access: new Map(),
  refresh: new Map(),
  otpAskedAt: new Map(),
  households: new Map(),
  pushTokens: new Map(),
  setup: new Map(),
  claimed: new Map(),
});
let db = fresh();

/**
 * Ids must differ every time the app reloads. The phone keeps per-user values (such as the verified mobile number)
 * across reloads while this mock database starts empty, so ids that repeat would make a brand-new mock user
 * look like one who had already added a phone.
 */
const newRun = () => Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
let run = newRun();
const uuid = (n: number) => `${run}-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Empty the mock backend. `reload: true` also acts like an app reload: new users get ids that were never used before. */
export function resetMockDb(options?: { reload?: boolean }): void {
  db = fresh();
  if (options?.reload) run = newRun();
}

/** Finds the user for this key (a phone number or a Google token), creating one on first use. */
export function findOrCreateUser(key: string, existing = false): { user: MockUser; isNew: boolean } {
  const found = db.users.get(key);
  if (found) return { user: found, isNew: false };
  const user: MockUser = {
    key,
    id: uuid(++db.counter),
    display_name: null,
    avatar_url: null,
    profile_status: 'pending',
  };
  db.users.set(key, user);
  return { user, isNew: !existing };
}

export function openSession(user: MockUser): { access_token: string; refresh_token: string } {
  const n = ++db.counter;
  const access_token = `mock-access-${n}`;
  const refresh_token = `mock-refresh-${n}`;
  db.access.set(access_token, user.id);
  db.refresh.set(refresh_token, { userId: user.id, revoked: false });
  return { access_token, refresh_token };
}

const userById = (id: string) => [...db.users.values()].find((u) => u.id === id);

/** The user for `Authorization: Bearer <token>`, or why there is none. */
export function authenticate(
  headers: Headers,
): { user: MockUser } | { code: 'missing_token' | 'invalid_token' } {
  const token = /^Bearer (.+)$/i.exec(headers.get('authorization') ?? '')?.[1];
  if (!token) return { code: 'missing_token' };
  const id = db.access.get(token);
  const user = id ? userById(id) : (userFromRealToken(token) ?? undefined);
  return user ? { user } : { code: 'invalid_token' };
}

/**
 * Sign-in can be real (flags.auth) while household setup is still mocked. Then the mock gets the real
 * server's access token (a JWT): it takes the user id from it (`sub`, not checked: this is a mock) so the
 * mocked setup steps work for the real account. PENDING BACKEND: remove once household is real.
 */
function userFromRealToken(token: string): MockUser | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const { sub } = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: unknown };
    if (typeof sub !== 'string' || !sub) return null;
    const key = `real:${sub}`;
    const found = db.users.get(key);
    if (found) return found;
    const user: MockUser = {
      key,
      id: sub,
      display_name: null,
      avatar_url: null,
      profile_status: 'pending',
    };
    db.users.set(key, user);
    return user;
  } catch {
    return null;
  }
}

export function refreshAccess(
  refreshToken: string,
): { access_token: string } | { code: 'invalid_token' | 'session_revoked' } {
  const r = db.refresh.get(refreshToken);
  if (!r) return { code: 'invalid_token' };
  if (r.revoked) return { code: 'session_revoked' };
  const access_token = `mock-access-${++db.counter}`;
  db.access.set(access_token, r.userId);
  return { access_token };
}

/** Ends the session that owns this access token. */
export function revokeSession(headers: Headers): void {
  const token = /^Bearer (.+)$/i.exec(headers.get('authorization') ?? '')?.[1];
  const userId = token ? db.access.get(token) : undefined;
  if (token) db.access.delete(token);
  for (const r of db.refresh.values()) if (r.userId === userId) r.revoked = true;
}

/** For tests and dev: every access token stops working, as if it had expired. */
export function expireAccessTokens(): void {
  db.access.clear();
}

/** True if a code was requested for this number less than 60 s ago; otherwise records this request. */
export function otpOnCooldown(number: string, now = Date.now()): boolean {
  const last = db.otpAskedAt.get(number);
  if (last !== undefined && now - last < OTP_COOLDOWN_MS) return true;
  db.otpAskedAt.set(number, now);
  return false;
}

export function mobileTakenBy(number: string, userId: string): boolean {
  return [...db.users.values()].some((u) => u.mobile === number && u.id !== userId);
}

/** PENDING BACKEND: the user's household. Asking again returns the same one (the role is not changed). */
export function createHouseholdFor(userId: string, role: Role): HouseholdOut {
  const found = db.households.get(userId);
  if (found) return found;
  const created: HouseholdOut = { id: uuid(++db.counter), role };
  db.households.set(userId, created);
  return created;
}

/** PENDING BACKEND: remember a push token for this user (the same token is kept once). */
export function savePushTokenFor(userId: string, entry: PushTokenIn): void {
  const list = db.pushTokens.get(userId) ?? [];
  if (!list.some((t) => t.token === entry.token)) list.push(entry);
  db.pushTokens.set(userId, list);
}

/** For tests: what the mock backend holds for this user. */
export const mockHouseholdOf = (userId: string) => db.households.get(userId);
export const mockPushTokensOf = (userId: string) => db.pushTokens.get(userId) ?? [];

/** PENDING BACKEND: the household with this id, if this user belongs to it. */
export function householdOf(userId: string, householdId: string): HouseholdOut | undefined {
  const h = db.households.get(userId);
  return h?.id === householdId ? h : undefined;
}

/** PENDING BACKEND: the setup record of a household (created empty on first use). */
export function setupOf(householdId: string): HouseholdSetup {
  let s = db.setup.get(householdId);
  if (!s) {
    s = { consents: [], contacts: [], invites: [], drills: [] };
    db.setup.set(householdId, s);
  }
  return s;
}

const withoutHousehold = ({ householdId: _h, ...d }: DeviceOut & { householdId: string }): DeviceOut => d;

/** PENDING BACKEND: claim the device behind a box code for this household. Claiming twice returns the same device. */
export function claimDevice(householdId: string, code: string): DeviceOut | 'device_already_claimed' {
  const found = db.claimed.get(code);
  if (found) return found.householdId === householdId ? withoutHousehold(found) : 'device_already_claimed';
  const device: DeviceOut = {
    id: uuid(++db.counter),
    serial: code.split('-')[1] ?? '0000',
    claim_state: 'unverified',
    is_owner: true,
  };
  db.claimed.set(code, { ...device, householdId });
  return device;
}

/** For tests: the setup record and devices the mock backend holds for this household. */
export const mockSetupOf = (householdId: string) => db.setup.get(householdId);
export const mockDevicesOf = (householdId: string) =>
  [...db.claimed.values()].filter((d) => d.householdId === householdId).map(withoutHousehold);

/** PENDING BACKEND: a device of this household, by id. */
export function deviceOf(
  householdId: string,
  deviceId: string,
): (DeviceOut & { householdId: string }) | undefined {
  return [...db.claimed.values()].find((d) => d.householdId === householdId && d.id === deviceId);
}

/** PENDING BACKEND: a new invite code such as "SVR-4F7K" (no 0/O or 1/I, to read out easily). */
export function newInviteCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const n = ++db.counter;
  return `SVR-${Array.from({ length: 4 }, (_, i) => letters[(n * 7 + i * 13) % letters.length]).join('')}`;
}

/** Mock timing for the SOS drill. The first contact "answers" after `ackMs`. Tests change these. */
export const mockDrillTiming = { ackMs: 6000, timeoutMs: 5 * 60_000 };

/** PENDING BACKEND: start a drill for this household. */
export function startDrillFor(householdId: string, now = Date.now()): DrillOut {
  const drill: DrillOut = {
    id: uuid(++db.counter),
    status: 'waiting',
    started_at: new Date(now).toISOString(),
    expires_at: new Date(now + mockDrillTiming.timeoutMs).toISOString(),
    acknowledged_by: null,
  };
  setupOf(householdId).drills.push(drill);
  return drill;
}

/** PENDING BACKEND: a drill as it stands now. With no contacts nobody can answer, so it runs out. */
export function drillNow(householdId: string, drillId: string, now = Date.now()): DrillOut | undefined {
  const s = setupOf(householdId);
  const d = s.drills.find((x) => x.id === drillId);
  if (!d || d.status !== 'waiting') return d;
  const started = Date.parse(d.started_at);
  const first = s.contacts[0];
  if (first && now - started >= mockDrillTiming.ackMs) {
    d.status = 'passed';
    d.acknowledged_by = first.name;
  } else if (now >= Date.parse(d.expires_at)) d.status = 'expired';
  return d;
}
