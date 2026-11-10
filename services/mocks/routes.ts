import type {
  ActivateIn,
  ClaimIn,
  ConsentIn,
  ContactsIn,
  DrillOut,
  HouseholdCreateIn,
  InviteIn,
  InviteOut,
  PushTokenIn,
  WearerProfileIn,
} from '@/services/api/pending';
import type { components } from '@/services/api/schema';
import { NEWS_REGIONS, sampleNews } from './news';
import {
  authenticate,
  claimDevice,
  createHouseholdFor,
  deviceOf,
  drillNow,
  householdOf,
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
  type MockUser,
} from './db';

/** Demo code accepted by the mock backend (the real dev backend also uses it). */
export const DEMO_CODE = '000000';
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
/** `params` holds the values of `{name}` parts of the path, e.g. `{ household_id: 'h1' }`. */
export type MockContext = { body: unknown; headers: Headers; params: Record<string, string> };
export type MockResult = { status: number; body?: unknown };
export type MockRoute = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT';
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

/** The signed-in user and their household from `{household_id}`, or the error to answer with. */
function inHousehold(ctx: MockContext): { user: MockUser; householdId: string } | { error: MockResult } {
  const auth = authenticate(ctx.headers);
  if ('code' in auth) return { error: fail(401, auth.code, 'Invalid or expired token') };
  const household = householdOf(auth.user.id, ctx.params.household_id ?? '');
  if (!household) return { error: fail(404, 'not_found', 'Household not found') };
  return { user: auth.user, householdId: household.id };
}

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
  // PENDING BACKEND: create the household with the person's role. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const role = (body as Partial<HouseholdCreateIn> | undefined)?.role;
      if (role !== 'wearer' && role !== 'caregiver') return fail(422, 'validation_error', 'Invalid request');
      return { status: 200, body: createHouseholdFor(auth.user.id, role) };
    },
  },
  // PENDING BACKEND: save this phone's push token. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/devices/push-token`,
    respond: ({ body, headers }) => {
      const auth = authenticate(headers);
      if ('code' in auth) return fail(401, auth.code, 'Invalid or expired token');
      const { token, platform } = (body ?? {}) as Partial<PushTokenIn>;
      if (!token || !platform || !['ios', 'android', 'web'].includes(platform))
        return fail(422, 'validation_error', 'Invalid request');
      savePushTokenFor(auth.user.id, { token, platform });
      return NO_CONTENT;
    },
  },
  // PENDING BACKEND: C1 / D2, the wearer's basics. Not in docs/openapi.json yet.
  {
    method: 'PATCH',
    path: `${API}/households/{household_id}/wearer`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const p = (ctx.body ?? {}) as Partial<WearerProfileIn>;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const dob = typeof p.date_of_birth === 'string' ? p.date_of_birth : '';
      if (
        !name ||
        name.length > 100 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
        Number.isNaN(Date.parse(dob)) ||
        Date.parse(dob) > Date.now() ||
        !Array.isArray(p.languages) ||
        typeof p.pacemaker !== 'boolean'
      )
        return fail(422, 'validation_error', 'Invalid request');
      const wearer: WearerProfileIn = {
        name,
        date_of_birth: dob,
        call_as: p.call_as?.trim() || null,
        languages: p.languages,
        health_notes: p.health_notes?.trim() || null,
        pacemaker: p.pacemaker,
      };
      setupOf(h.householdId).wearer = wearer;
      return { status: 200, body: wearer };
    },
  },
  // PENDING BACKEND: a consent record (C1 checkbox; D7 by link). Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households/{household_id}/consent`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const c = (ctx.body ?? {}) as Partial<ConsentIn>;
      if (!c.version || (c.via !== 'app' && c.via !== 'link'))
        return fail(422, 'validation_error', 'Invalid request');
      setupOf(h.householdId).consents.push({
        version: c.version,
        via: c.via,
        given_at: new Date().toISOString(),
      });
      return NO_CONTENT;
    },
  },
  // PENDING BACKEND: C2 / D1, claim the pendant with the one-time code from the box. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households/{household_id}/claim`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const code = String((ctx.body as Partial<ClaimIn> | undefined)?.code ?? '').toUpperCase();
      if (!CLAIM_CODE.test(code)) return fail(404, 'invalid_claim_code', 'Unknown claim code');
      if (code.endsWith(CLAIMED_CODE_SUFFIX)) return alreadyClaimed;
      const device = claimDevice(h.householdId, code);
      return device === 'device_already_claimed' ? alreadyClaimed : { status: 200, body: device };
    },
  },
  // PENDING BACKEND: C3, a random challenge for the pendant to sign. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households/{household_id}/devices/{device_id}/challenge`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      if (!deviceOf(h.householdId, ctx.params.device_id ?? ''))
        return fail(404, 'not_found', 'Device not found');
      return { status: 200, body: { challenge: `challenge-${ctx.params.device_id}` } };
    },
  },
  // PENDING BACKEND: C3, check the signature and lock the claim to this household. Not in docs/openapi.json yet.
  // The mock accepts the simulator's signatures ("sim:...").
  {
    method: 'POST',
    path: `${API}/households/{household_id}/devices/{device_id}/activate`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const d = deviceOf(h.householdId, ctx.params.device_id ?? '');
      if (!d) return fail(404, 'not_found', 'Device not found');
      const { signature, pendant_id } = (ctx.body ?? {}) as Partial<ActivateIn>;
      if (!pendant_id || !signature?.startsWith('sim:'))
        return fail(422, 'invalid_device_signature', 'Signature does not match');
      d.claim_state = 'verified';
      const { householdId: _h, ...out } = d;
      return { status: 200, body: out };
    },
  },
  // PENDING BACKEND: C5 / D3, replace the emergency contacts (name and number only). Not in docs/openapi.json yet.
  {
    method: 'PUT',
    path: `${API}/households/{household_id}/contacts`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const list = (ctx.body as Partial<ContactsIn> | undefined)?.contacts;
      if (!Array.isArray(list)) return fail(422, 'validation_error', 'Invalid request');
      for (const c of list) {
        const n = readNumber(c);
        if ('error' in n) return n.error;
        if (!c.name?.trim()) return fail(422, 'validation_error', 'Invalid request');
      }
      const contacts = list.map((c) => ({
        name: c.name.trim(),
        relationship: c.relationship?.trim() || null,
        country_code: c.country_code,
        mobile_number: c.mobile_number,
      }));
      setupOf(h.householdId).contacts = contacts;
      return { status: 200, body: { contacts } satisfies ContactsIn };
    },
  },
  // PENDING BACKEND: C7, invite someone to help. Expires in 24 hours. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households/{household_id}/invites`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const role = (ctx.body as Partial<InviteIn> | undefined)?.role;
      if (role !== 'admin' && role !== 'viewer') return fail(422, 'invite_role_invalid', 'Invalid role');
      const code = newInviteCode();
      const invite: InviteOut = {
        code,
        url: `https://svaraa.ai/i/${code}`,
        role,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      };
      setupOf(h.householdId).invites = [invite];
      return { status: 200, body: invite };
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
  // PENDING BACKEND: C8, start an SOS drill. Not in docs/openapi.json yet.
  {
    method: 'POST',
    path: `${API}/households/{household_id}/drills`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      return { status: 200, body: startDrillFor(h.householdId) satisfies DrillOut };
    },
  },
  // PENDING BACKEND: C8, the drill's status. Not in docs/openapi.json yet.
  {
    method: 'GET',
    path: `${API}/households/{household_id}/drills/{drill_id}`,
    respond: (ctx) => {
      const h = inHousehold(ctx);
      if ('error' in h) return h.error;
      const d = drillNow(h.householdId, ctx.params.drill_id ?? '');
      return d ? { status: 200, body: d } : fail(404, 'drill_not_found', 'Drill not found');
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
