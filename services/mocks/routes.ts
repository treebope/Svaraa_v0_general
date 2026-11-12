import i18n from '@/i18n';
import type { ChatIn, ChatOut } from '@/services/api/pending';
import type { components } from '@/services/api/schema';
import { NEWS_REGIONS, sampleNews } from './news';
import {
  authenticate,
  circleOut,
  claimDevice,
  createHouseholdFor,
  deviceById,
  deviceOut,
  drillNow,
  householdOf,
  mockHouseholdOf,
  newId,
  newInviteCode,
  findOrCreateUser,
  mobileTakenBy,
  openSession,
  otpOnCooldown,
  refreshAccess,
  revokeSession,
  savePushTokenFor,
  setupOf,
  startDrillFor,
  updateState,
  type HouseholdSetup,
  type MockContact,
  type MockDevice,
  type MockUser,
} from './db';

/** Demo code accepted by the mock backend (the real dev backend also uses it). */
export const DEMO_CODE = '0000';
/** Demo hook: a number ending in 00 signs in as an existing user (is_new = false). */
export const EXISTING_USER_SUFFIX = '00';
/** Demo hook: a number ending in 11 already belongs to another account (409 mobile_number_taken). */
export const TAKEN_NUMBER_SUFFIX = '11';
/** Demo claim code, as printed on the card in the box. Any code in this shape works. */
export const DEMO_CLAIM_CODE = 'SVRA-2041-7K3P';
/** Demo hook: a claim code ending in -0000 belongs to another household (409 device_already_claimed). */
export const CLAIMED_CODE_SUFFIX = '-0000';
const CLAIM_CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

type S = components['schemas'];
/** `params` holds the values of `{name}` parts of the path, e.g. `{ circle_id: 'h1' }`. */
export type MockContext = { body: unknown; headers: Headers; params: Record<string, string> };
export type MockResult = { status: number; body?: unknown };
export type MockRoute = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Full path, as in docs/openapi.json (includes /api/v1). `{name}` parts match any one segment. */
  path: string;
  respond: (ctx: MockContext) => MockResult;
};

const fail = (status: number, code: string, message: string): MockResult => ({
  status,
  body: { error: { code, message, request_id: 'mock' } },
});
const NO_CONTENT: MockResult = { status: 204 };

/** The `{name}` values when `path` fits the route's pattern, or undefined when it does not. */
export function matchPath(pattern: string, path: string): Record<string, string> | undefined {
  const want = pattern.split('/');
  const got = path.split('/');
  if (want.length !== got.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const name = /^\{(\w+)\}$/.exec(want[i])?.[1];
    if (name && got[i]) params[name] = decodeURIComponent(got[i]);
    else if (want[i] !== got[i]) return undefined;
  }
  return params;
}

/** Checks the phone fields the way the backend does. Returns the digits, or an error response. */
function readNumber(body: unknown): { number: string } | { error: MockResult } {
  const { country_code, mobile_number } = (body ?? {}) as Partial<S['OtpRequestIn']>;
  const cc = String(country_code ?? '').replace(/^\+/, '');
  if (!/^\d{1,3}$/.test(cc)) return { error: fail(400, 'invalid_country_code', 'Unknown country code') };
  const digits = String(mobile_number ?? '');
  if (!/^\d{7,12}$/.test(digits))
    return { error: fail(400, 'invalid_mobile_number', 'Invalid mobile number') };
  return { number: `+${cc}${digits}` };
}

const API = '/api/v1';

/** The signed-in user and their household from `{circle_id}`, or the error to answer with. */
function inHousehold(ctx: MockContext): { user: MockUser; householdId: string } | { error: MockResult } {
  const auth = authenticate(ctx.headers);
  if ('code' in auth) return { error: fail(401, auth.code, 'Invalid or expired token') };
  const household = householdOf(auth.user.id, ctx.params.circle_id ?? '');
  if (!household) return { error: fail(404, 'not_found', 'Household not found') };
  return { user: auth.user, householdId: household.id };
}

/** The pendant from `{device_id}`, if it belongs to the signed-in user's household. */
function ownDevice(ctx: MockContext): { device: MockDevice } | { error: MockResult } {
  const auth = authenticate(ctx.headers);
  if ('code' in auth) return { error: fail(401, auth.code, 'Invalid or expired token') };
  const device = deviceById(ctx.params.device_id ?? '');
  if (!device || !householdOf(auth.user.id, device.householdId))
    return { error: fail(404, 'not_found', 'Device not found') };
  return { device };
}

/** The wearer's basics, checked the way the backend does, or undefined when something is missing or wrong. */
function readWearer(b: {
  name?: string | null;
  date_of_birth?: string | null;
  call_as?: string | null;
  languages?: string[] | null;
}): HouseholdSetup['wearer'] | undefined {
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const dob = typeof b.date_of_birth === 'string' ? b.date_of_birth : '';
  if (
    !name ||
    name.length > 100 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
    Number.isNaN(Date.parse(dob)) ||
    Date.parse(dob) > Date.now() ||
    !Array.isArray(b.languages) ||
    b.languages.length > 10
  )
    return undefined;
  return { name, date_of_birth: dob, call_as: b.call_as?.trim() || null, languages: b.languages };
}

/** A contact as the API answers it: the number is masked, the position is 1-based. */
const contactOut = (c: MockContact, i: number): S['ContactOut'] => ({
  id: c.id,
  name: c.name,
  relationship: c.relationship ?? null,
  mobile_masked: `${c.country_code} ••••••${c.mobile_number.slice(-4)}`,
  position: i + 1,
});

/** 409 for a pendant that belongs to another household. Only a masked initial of the owner is given. */
const alreadyClaimed: MockResult = {
  status: 409,
  body: {
    error: {
      code: 'device_already_claimed',
      message: 'Already claimed',
      owner_hint: 'M',
      request_id: 'mock',
    },
  },
};

/**
 * The mock backend, as plain data. No library, so it runs everywhere (phone, web, Jest).
 * handlers.ts turns these into MSW handlers; fetchMock.ts serves them on mobile.
 * Shapes follow docs/openapi.json (the real backend, feature/auth-and-user-creation).
 */
export const routes: MockRoute[] = [
  {
    method: 'POST',
    path: `${API}/auth/otp/request`,
    respond: ({ body }) => {
      const n = readNumber(body);
      if ('error' in n) return n.error;
      if (otpOnCooldown(n.number))
        return fail(429, 'otp_cooldown', 'Please wait before requesting another code');
      return NO_CONTENT;
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/otp/verify`,
    respond: ({ body }) => {
      const n = readNumber(body);
      if ('error' in n) return n.error;
      if ((body as S['OtpVerifyIn']).code !== DEMO_CODE)
        return fail(401, 'invalid_otp', 'Incorrect or expired code');
      const { user, isNew } = findOrCreateUser(n.number, n.number.endsWith(EXISTING_USER_SUFFIX));
      user.mobile = n.number;
      const out: S['SignInOut'] = {
        ...openSession(user),
        token_type: 'bearer',
        user_id: user.id,
        is_new: isNew,
      };
      return { status: 200, body: out };
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/google`,
    respond: ({ body }) => {
      const { id_token } = (body ?? {}) as Partial<S['GoogleSignInIn']>;
      if (!id_token) return fail(401, 'invalid_google_token', 'Invalid Google token');
      const { user, isNew } = findOrCreateUser(`google:${id_token}`);
      const out: S['SignInOut'] = {
        ...openSession(user),
        token_type: 'bearer',
        user_id: user.id,
        is_new: isNew,
      };
      return { status: 200, body: out };
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/refresh`,
    respond: ({ body }) => {
      const out = refreshAccess(String((body as Partial<S['RefreshIn']> | undefined)?.refresh_token ?? ''));
      if ('code' in out) return fail(401, out.code, 'Session ended, sign in again');
      return {
        status: 200,
        body: { access_token: out.access_token, token_type: 'bearer' } satisfies S['TokenOut'],
      };
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/logout`,
    respond: ({ headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      revokeSession(headers);
      return NO_CONTENT;
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/mobile/request`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const n = readNumber(body);
      if ('error' in n) return n.error;
      if (n.number.endsWith(TAKEN_NUMBER_SUFFIX) || mobileTakenBy(n.number, auth.user.id))
        return fail(409, 'mobile_number_taken', 'This mobile number belongs to another account');
      if (otpOnCooldown(n.number))
        return fail(429, 'otp_cooldown', 'Please wait before requesting another code');
      return NO_CONTENT;
    },
  },
  {
    method: 'POST',
    path: `${API}/auth/mobile/verify`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const n = readNumber(body);
      if ('error' in n) return n.error;
      if ((body as S['OtpVerifyIn']).code !== DEMO_CODE)
        return fail(401, 'invalid_otp', 'Incorrect or expired code');
      if (n.number.endsWith(TAKEN_NUMBER_SUFFIX) || mobileTakenBy(n.number, auth.user.id))
        return fail(409, 'mobile_number_taken', 'This mobile number belongs to another account');
      auth.user.mobile = n.number;
      return NO_CONTENT;
    },
  },
  {
    method: 'GET',
    path: `${API}/users/me`,
    respond: ({ headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      return { status: 200, body: toProfile(auth.user) };
    },
  },
  {
    method: 'PATCH',
    path: `${API}/users/me`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const patch = (body ?? {}) as Partial<S['ProfilePatchIn']>;
      if (patch.display_name !== undefined && patch.display_name !== null) {
        if (!patch.display_name.length || patch.display_name.length > 100)
          return fail(422, 'validation_error', 'Invalid request');
        auth.user.display_name = patch.display_name;
        auth.user.profile_status = 'completed';
      }
      if (patch.avatar_url !== undefined) auth.user.avatar_url = patch.avatar_url;
      return { status: 200, body: toProfile(auth.user) };
    },
  },
  {
    method: 'POST',
    path: `${API}/users/me/profile/skip`,
    respond: ({ headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      if (auth.user.profile_status === 'pending') auth.user.profile_status = 'skipped';
      return { status: 200, body: toProfile(auth.user) };
    },
  },
  // A4 · Home: the households this person belongs to (the backend calls them circles). Empty until C1.
  {
    method: 'GET',
    path: `${API}/me/home`,
    respond: ({ headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const h = mockHouseholdOf(auth.user.id);
      const s = h && setupOf(h.id);
      const circles: S['HomeCircle'][] =
        h && s
          ? [
              {
                id: h.id,
                wearer_name: s.wearer?.name ?? null,
                state: s.state,
                my_role: 'wearer',
                protected: s.drills.some((d) => d.status === 'passed'),
                next_action: null,
                notices: [],
                steps: [],
                pending_transfers: [],
                pending_members: 0,
              },
            ]
          : [];
      return { status: 200, body: { circles } satisfies S['HomeOut'] };
    },
  },
  // C1: create the household the person wears, with their basics and consent in one step. Only `wearer_first`
  // is mocked: the app does not offer caretaker-led setup yet.
  {
    method: 'POST',
    path: `${API}/circles`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const b = (body ?? {}) as Partial<S['CircleCreateIn']>;
      const wearer = readWearer(b);
      if (b.mode !== 'wearer_first' || !wearer || !b.consent?.version)
        return fail(422, 'validation_error', 'Invalid request');
      const created = createHouseholdFor(auth.user.id, wearer, b.consent.version);
      if (!created) return fail(409, 'conflict', 'You already wear a household');
      return { status: 201, body: circleOut(created.id) };
    },
  },
  // C1 again, or D2 (My Profile): change the wearer's basics. Only the fields sent change.
  {
    method: 'PATCH',
    path: `${API}/circles/{circle_id}`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const s = setupOf(h.householdId);
      const b = (ctx.body ?? {}) as Partial<S['CirclePatchIn']>;
      const before = s?.wearer;
      const wearer = readWearer({
        name: b.name ?? before?.name,
        date_of_birth: b.date_of_birth ?? before?.date_of_birth,
        call_as: b.call_as === undefined ? before?.call_as : b.call_as,
        languages: b.languages ?? before?.languages ?? [],
      });
      if (!s || !wearer) return fail(422, 'validation_error', 'Invalid request');
      s.wearer = wearer;
      return { status: 200, body: circleOut(h.householdId) };
    },
  },
  // C1 checkbox (or re-consent after a withdrawal): a consent record with the version of the text shown.
  {
    method: 'POST',
    path: `${API}/circles/{circle_id}/consent`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const version = (ctx.body as Partial<S['ConsentIn']> | undefined)?.version;
      if (!version) return fail(422, 'validation_error', 'Invalid request');
      setupOf(h.householdId)?.consents.push({ version, given_at: new Date().toISOString() });
      return { status: 200, body: circleOut(h.householdId) };
    },
  },
  // C2: claim the pendant with the one-time code from the box. Like the dev server, codes starting with MOCK work too.
  {
    method: 'POST',
    path: `${API}/devices/claim`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const b = (body ?? {}) as Partial<S['DeviceClaimIn']>;
      if (!b.circle_id || !householdOf(auth.user.id, b.circle_id))
        return fail(404, 'not_found', 'Household not found');
      const code = String(b.token ?? '').toUpperCase();
      if (!CLAIM_CODE.test(code) && !code.startsWith('MOCK'))
        return fail(404, 'invalid_claim_code', 'Unknown claim code');
      if (code.endsWith(CLAIMED_CODE_SUFFIX)) return alreadyClaimed;
      const device = claimDevice(b.circle_id, code);
      return device === 'device_already_claimed' ? alreadyClaimed : { status: 200, body: device };
    },
  },
  // C3: a random challenge for the pendant to sign. The mock always asks for the simulator's signature.
  {
    method: 'POST',
    path: `${API}/devices/{device_id}/pairing/challenge`,
    respond: (ctx) => {
      const d = ownDevice(ctx);
      if ('error' in d) return d.error;
      const out: S['PairingChallengeOut'] = {
        nonce: `challenge-${d.device.id}`,
        expires_in: 120,
        requires_signature: true,
      };
      return { status: 200, body: out };
    },
  },
  // C3: check the signature and mark the pendant verified. The mock accepts the simulator's signatures ("sim:...").
  {
    method: 'POST',
    path: `${API}/devices/{device_id}/pairing/verify`,
    respond: (ctx) => {
      const d = ownDevice(ctx);
      if ('error' in d) return d.error;
      const signature = (ctx.body as Partial<S['PairingVerifyIn']> | undefined)?.signature;
      if (!signature?.startsWith('sim:'))
        return fail(422, 'invalid_device_signature', 'Signature does not match');
      d.device.claim_state = 'claimed_verified';
      d.device.verified_at = new Date().toISOString();
      updateState(d.device.householdId);
      return { status: 200, body: deviceOut(d.device) };
    },
  },
  // C5, C6 (and D3): the emergency contacts, in alert order.
  {
    method: 'GET',
    path: `${API}/circles/{circle_id}/contacts`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      return { status: 200, body: (setupOf(h.householdId)?.contacts ?? []).map(contactOut) };
    },
  },
  // Add one contact at the end of the list. Name and number only; up to 5.
  {
    method: 'POST',
    path: `${API}/circles/{circle_id}/contacts`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const s = setupOf(h.householdId);
      const c = (ctx.body ?? {}) as Partial<S['ContactIn']>;
      const n = readNumber(c);
      if ('error' in n) return n.error;
      const name = c.name?.trim() ?? '';
      if (!s || !name || name.length > 100) return fail(422, 'validation_error', 'Invalid request');
      if (s.contacts.length >= 5) return fail(409, 'conflict', 'Up to 5 contacts');
      const contact: MockContact = {
        id: newId(),
        name,
        relationship: c.relationship?.trim() || null,
        country_code: String(c.country_code),
        mobile_number: String(c.mobile_number),
      };
      s.contacts.push(contact);
      updateState(h.householdId);
      return { status: 201, body: contactOut(contact, s.contacts.length - 1) };
    },
  },
  // Remove one contact; the others close up. With no contact left, an active household drops back to pending.
  {
    method: 'DELETE',
    path: `${API}/circles/{circle_id}/contacts/{contact_id}`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const s = setupOf(h.householdId);
      const at = s?.contacts.findIndex((c) => c.id === ctx.params.contact_id) ?? -1;
      if (!s || at < 0) return fail(404, 'not_found', 'Contact not found');
      s.contacts.splice(at, 1);
      updateState(h.householdId);
      return NO_CONTENT;
    },
  },
  // C7: invite someone to help. The code is single use and valid 24 hours; up to 5 open invites.
  {
    method: 'POST',
    path: `${API}/circles/{circle_id}/member-invites`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const role = (ctx.body as Partial<S['MemberInviteIn']> | undefined)?.role;
      if (role !== 'admin' && role !== 'viewer') return fail(422, 'invite_role_invalid', 'Invalid role');
      const invite: S['MemberInviteOut'] = {
        invite_id: newId(),
        code: newInviteCode(),
        role,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      };
      setupOf(h.householdId)?.invites.push(invite);
      return { status: 201, body: invite };
    },
  },
  // C8: start an SOS drill. The household must be active (a verified pendant and a contact).
  {
    method: 'POST',
    path: `${API}/circles/{circle_id}/drills`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      if (setupOf(h.householdId)?.state !== 'active')
        return fail(409, 'conflict', 'The household is not active yet');
      return { status: 201, body: startDrillFor(h.householdId) };
    },
  },
  // C8: the drill's status.
  {
    method: 'GET',
    path: `${API}/circles/{circle_id}/drills/{drill_id}`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const d = drillNow(h.householdId, ctx.params.drill_id ?? '');
      return d ? { status: 200, body: d } : fail(404, 'drill_not_found', 'Drill not found');
    },
  },
  // B2, B3: this phone's push token. Phones only (android, ios).
  {
    method: 'POST',
    path: `${API}/me/installations`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const b = (body ?? {}) as Partial<S['InstallationIn']>;
      if (b.platform !== 'android' && b.platform !== 'ios')
        return fail(422, 'validation_error', 'Invalid request');
      savePushTokenFor(auth.user.id, {
        platform: b.platform,
        push_token: b.push_token ?? null,
        app_version: b.app_version ?? null,
      });
      return { status: 200, body: { id: `installation-${auth.user.id}` } satisfies S['InstallationOut'] };
    },
  },
  // PENDING BACKEND: the top five news stories for a region (world, IN, US, CA), found by an AI search. Not in docs/openapi.json yet.
  {
    method: 'GET',
    path: `${API}/news/{region}`,
    respond: (ctx) => {
      const region = NEWS_REGIONS.find((r) => r === ctx.params.region);
      return region
        ? { status: 200, body: sampleNews(region) }
        : fail(404, 'region_not_found', 'Region not found');
    },
  },
  // Text chat (flags.ai). A fixed sample reply in the app's language; like the real server, no sign-in needed.
  {
    method: 'POST',
    path: `${API}/chat/`,
    respond: ({ body }) => {
      const { message, session_id } = (body ?? {}) as Partial<ChatIn>;
      if (typeof message !== 'string' || !message.trim())
        return fail(422, 'validation_error', 'Invalid request');
      const out: ChatOut = {
        session_id: session_id || `mock-chat-${Date.now()}`,
        response: i18n.t('chat.reply'),
        expires_at: new Date(Date.now() + 4 * 3_600_000).toISOString(),
      };
      return { status: 200, body: out };
    },
  },
];

function toProfile(u: {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  profile_status: S['ProfileStatus'];
}): S['ProfileOut'] {
  return {
    id: u.id,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    profile_status: u.profile_status,
  };
}
