import type { DeviceOut, HouseholdOut } from '@/services/api/pending';
import type { components } from '@/services/api/schema';

type S = components['schemas'];
type Profile = S['ProfileOut'];
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
  /** User id -> the household they wear (one per user, like the real backend). */
  households: Map<string, HouseholdOut>;
  /** User id -> saved app installations (push tokens). */
  pushTokens: Map<string, S['InstallationIn'][]>;
  /** Household id -> what setup saved for it. */
  setup: Map<string, HouseholdSetup>;
  /** Claim code -> pendant, for every code anyone claimed. */
  claimed: Map<string, MockDevice>;
};

/** A claimed pendant, in the real API's shape plus the household that holds it. */
export type MockDevice = S['DeviceOut'] & { householdId: string };
/** An emergency contact as the mock keeps it: what was sent, plus its id. */
export type MockContact = S['ContactIn'] & { id: string };

/** What the mock backend keeps per household during setup. */
export type HouseholdSetup = {
  state: S['CircleState'];
  createdAt: string;
  wearer?: { name: string; date_of_birth: string; call_as: string | null; languages: string[] };
  consents: { version: string; given_at: string }[];
  /** In alert order. */
  contacts: MockContact[];
  /** Open invites, newest last. */
  invites: S['MemberInviteOut'][];
  drills: S['DrillOut'][];
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

/** C1: create the household this user wears (POST /circles, `wearer_first`). Undefined if they already wear one. */
export function createHouseholdFor(
  userId: string,
  wearer: NonNullable<HouseholdSetup['wearer']>,
  version: string,
): HouseholdOut | undefined {
  if (db.households.has(userId)) return undefined;
  const created: HouseholdOut = { id: uuid(++db.counter), role: 'wearer' };
  db.households.set(userId, created);
  const now = new Date().toISOString();
  db.setup.set(created.id, {
    state: 'pending_pairing',
    createdAt: now,
    wearer,
    consents: [{ version, given_at: now }],
    contacts: [],
    invites: [],
    drills: [],
  });
  return created;
}

/** Remember an app installation (push token) for this user; the same token is kept once. */
export function savePushTokenFor(userId: string, entry: S['InstallationIn']): void {
  const list = db.pushTokens.get(userId) ?? [];
  if (!list.some((t) => t.push_token === entry.push_token)) list.push(entry);
  db.pushTokens.set(userId, list);
}

/** For tests: what the mock backend holds for this user. */
export const mockHouseholdOf = (userId: string) => db.households.get(userId);
export const mockPushTokensOf = (userId: string) => db.pushTokens.get(userId) ?? [];

/** The household with this id, if this user wears it. */
export function householdOf(userId: string, householdId: string): HouseholdOut | undefined {
  const h = db.households.get(userId);
  return h?.id === householdId ? h : undefined;
}

/** The setup record of a household (only households created through POST /circles have one). */
export const setupOf = (householdId: string): HouseholdSetup | undefined => db.setup.get(householdId);

/** The household as GET/PATCH /circles answer it. */
export function circleOut(householdId: string): S['CircleOut'] {
  const s = db.setup.get(householdId);
  const passed = s?.drills.find((d) => d.status === 'passed');
  return {
    id: householdId,
    state: s?.state ?? 'draft',
    wearer_name: s?.wearer?.name ?? null,
    wearer_date_of_birth: s?.wearer?.date_of_birth ?? null,
    call_as: s?.wearer?.call_as ?? null,
    languages: s?.wearer?.languages ?? [],
    wearer_mobile_masked: null,
    protected_at: passed?.acknowledged_at ?? null,
    my_role: 'wearer',
    created_at: s?.createdAt ?? new Date().toISOString(),
  };
}

/** Active once a verified pendant and a contact exist (back to pending_pairing without them), like the server. */
export function updateState(householdId: string): void {
  const s = db.setup.get(householdId);
  if (!s) return;
  const verified = [...db.claimed.values()].some(
    (d) => d.householdId === householdId && d.claim_state === 'claimed_verified',
  );
  s.state = verified && s.contacts.length > 0 ? 'active' : 'pending_pairing';
}

const withoutHousehold = ({ householdId: _h, ...d }: MockDevice): S['DeviceOut'] => d;

/** Claim the pendant behind a box code for this household. Claiming twice returns the same pendant. */
export function claimDevice(householdId: string, code: string): S['DeviceOut'] | 'device_already_claimed' {
  const found = db.claimed.get(code);
  if (found) return found.householdId === householdId ? withoutHousehold(found) : 'device_already_claimed';
  const device: MockDevice = {
    id: uuid(++db.counter),
    serial_no: code.split('-')[1] ?? '0000',
    model: 'svaraa-fold',
    claim_state: 'claimed_unverified',
    claimed_at: new Date().toISOString(),
    verified_at: null,
    attestation: null,
    checks_passed_at: null,
    last_seen_at: null,
    householdId,
  };
  db.claimed.set(code, device);
  return withoutHousehold(device);
}

/** The pendant as the API answers it. */
export const deviceOut = (d: MockDevice): S['DeviceOut'] => withoutHousehold(d);

/** For tests: the setup record (contacts without their ids) of this household. */
export function mockSetupOf(householdId: string) {
  const s = db.setup.get(householdId);
  return s && { ...s, contacts: s.contacts.map(({ id: _id, ...c }) => c) };
}

/** For tests: the pendants of this household, in the app's shape. */
export const mockDevicesOf = (householdId: string): DeviceOut[] =>
  [...db.claimed.values()]
    .filter((d) => d.householdId === householdId)
    .map((d) => ({
      id: d.id,
      serial: d.serial_no,
      claim_state: d.claim_state === 'claimed_verified' ? 'verified' : 'unverified',
      is_owner: true,
    }));

/** A pendant by id, with the household that holds it. */
export const deviceById = (deviceId: string): MockDevice | undefined =>
  [...db.claimed.values()].find((d) => d.id === deviceId);

/** A new id for a contact or invite. */
export const newId = () => uuid(++db.counter);

/** A new invite code such as "SVR-4F7K" (no 0/O or 1/I, to read out easily). */
export function newInviteCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const n = ++db.counter;
  return `SVR-${Array.from({ length: 4 }, (_, i) => letters[(n * 7 + i * 13) % letters.length]).join('')}`;
}

/** Mock timing for the SOS drill. The first contact "answers" after `ackMs`. Tests change these. */
export const mockDrillTiming = { ackMs: 6000, timeoutMs: 5 * 60_000 };

/** A drill as it stands now. With no contacts nobody can answer, so it runs out. */
export function drillNow(householdId: string, drillId: string, now = Date.now()): S['DrillOut'] | undefined {
  const s = db.setup.get(householdId);
  const d = s?.drills.find((x) => x.id === drillId);
  if (!s || !d || d.status !== 'running') return d;
  const first = s.contacts[0];
  if (first && now - Date.parse(d.started_at) >= mockDrillTiming.ackMs) {
    d.status = 'passed';
    d.acknowledged_by = first.name;
    d.acknowledged_at = new Date(now).toISOString();
  } else if (now >= Date.parse(d.expires_at)) d.status = 'expired';
  return d;
}

/** Start a drill for this household, or return the one still running. */
export function startDrillFor(householdId: string, now = Date.now()): S['DrillOut'] | undefined {
  const s = db.setup.get(householdId);
  if (!s) return undefined;
  const running = s.drills.find((d) => drillNow(householdId, d.id, now)?.status === 'running');
  if (running) return running;
  const drill: S['DrillOut'] = {
    id: uuid(++db.counter),
    circle_id: householdId,
    status: 'running',
    started_at: new Date(now).toISOString(),
    expires_at: new Date(now + mockDrillTiming.timeoutMs).toISOString(),
    acknowledged_at: null,
    acknowledged_by: null,
  };
  s.drills.push(drill);
  return drill;
}
