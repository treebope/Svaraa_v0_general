import {
  api,
  call,
  type components,
  type ContactIn,
  type ContactsOut,
  type DeviceOut,
  type DrillOut,
  type InviteOut,
  type InviteRole,
  type WearerProfileIn,
  type WearerProfileOut,
} from '@/services/api';
import {
  DRAFT_HOUSEHOLD_ID,
  findWornHouseholdIfAny,
  realHouseholdId,
  rememberHousehold,
} from './householdApi';

export type { ContactIn, DeviceOut, InviteRole, WearerProfileIn };

type S = components['schemas'];

/**
 * Household setup on the real backend (flags.household). The backend calls a household a "circle"; the app keeps
 * its own names and shapes (services/api/pending.ts), and this file maps between the two.
 */

/**
 * Version of the consent text on C1's "Details" sheet. Change it whenever that text changes. The server answers
 * `409 consent_version_outdated` for a version it no longer accepts (2026-11-v0 is refused; 2026-11-v1 is current).
 */
export const CONSENT_VERSION = '2026-11-v1';

const circle = (id: string) => ({ params: { path: { circle_id: id } } });
const device = (id: string) => ({ params: { path: { device_id: id } } });

/**
 * C1 (and D2): save the wearer's basics. The first save creates the household on the server, with the wearer's
 * consent in the same call (POST /circles, mode `wearer_first`): C1 only saves once its consent box is ticked.
 * Later saves change it (PATCH /circles/{id}).
 * PENDING BACKEND: health notes and pacemaker are not on the server yet; they are kept on this phone (useWearer).
 */
export async function saveWearerProfile(
  householdId: string,
  profile: WearerProfileIn,
): Promise<WearerProfileOut> {
  const basics = {
    name: profile.name,
    date_of_birth: profile.date_of_birth,
    call_as: profile.call_as || null,
    languages: profile.languages,
  };
  let id = householdId;
  if (id === DRAFT_HOUSEHOLD_ID) id = (await findWornHouseholdIfAny())?.id ?? DRAFT_HOUSEHOLD_ID;
  const saved =
    id === DRAFT_HOUSEHOLD_ID
      ? await call(
          api.POST('/api/v1/circles', {
            body: { mode: 'wearer_first', ...basics, consent: { version: CONSENT_VERSION } },
          }),
        )
      : await call(api.PATCH('/api/v1/circles/{circle_id}', { ...circle(id), body: basics }));
  rememberHousehold(saved.id);
  return {
    name: saved.wearer_name ?? profile.name,
    date_of_birth: saved.wearer_date_of_birth ?? profile.date_of_birth,
    call_as: saved.call_as,
    languages: saved.languages,
    health_notes: profile.health_notes ?? null,
    pacemaker: profile.pacemaker,
  };
}

/**
 * C1 checkbox: record that the wearer agreed, with the version of the text they saw. The household was created
 * with this consent already; repeating it is harmless on the server. `409 consent_version_outdated` = old text.
 * PENDING BACKEND: `via` (app or setup link) is not recorded by the server yet.
 */
export async function giveConsent(householdId: string, _via: 'app' | 'link' = 'app'): Promise<void> {
  const id = await realHouseholdId(householdId);
  await call(
    api.POST('/api/v1/circles/{circle_id}/consent', { ...circle(id), body: { version: CONSENT_VERSION } }),
  );
}

/** The server's pendant in the app's shape. Only the household's own pendants come back, so it is the owner. */
const toDevice = (d: S['DeviceOut']): DeviceOut => ({
  id: d.id,
  serial: d.serial_no,
  claim_state: d.claim_state === 'claimed_verified' ? 'verified' : 'unverified',
  is_owner: true,
});

/**
 * C2: claim the pendant with the one-time code from the box. Makes this household the owner.
 * Fails with `device_already_claimed` (another household holds it), or not found for an unknown code.
 * In development the server accepts any code starting with MOCK (e.g. MOCK-0000-0001) as a test pendant.
 */
export async function claimPendant(householdId: string, code: string): Promise<DeviceOut> {
  const id = await realHouseholdId(householdId);
  return toDevice(await call(api.POST('/api/v1/devices/claim', { body: { circle_id: id, token: code } })));
}

/** Whether the server wants the pendant's signature, per device (a test pendant needs none). */
const needsSignature = new Map<string, boolean>();

/**
 * C3: a fresh random challenge for the pendant to sign. The pendant itself is still the simulator
 * (flags.pendantTransport); only these server calls are real.
 */
export async function getPairingChallenge(
  _householdId: string,
  deviceId: string,
): Promise<{ challenge: string }> {
  const out = await call(api.POST('/api/v1/devices/{device_id}/pairing/challenge', device(deviceId)));
  needsSignature.set(deviceId, out.requires_signature);
  return { challenge: out.nonce };
}

/**
 * C3: send the pendant's signature. The claim becomes verified and the household can become active.
 * A test pendant (MOCK code) verifies without a signature. Fails with `invalid_device_signature` for a pendant
 * that is not genuine.
 * PENDING BACKEND: the server does not take the pendant's Bluetooth id; it stays on this phone (useWearer).
 */
export async function activatePendant(
  _householdId: string,
  deviceId: string,
  signature: string,
  _pendantId: string,
): Promise<DeviceOut> {
  const body = { signature: needsSignature.get(deviceId) === false ? null : signature };
  return toDevice(
    await call(api.POST('/api/v1/devices/{device_id}/pairing/verify', { ...device(deviceId), body })),
  );
}

/** Most emergency contacts setup takes. More can be added later in My Profile. */
export const MAX_SETUP_CONTACTS = 2;
/** Most emergency contacts in My Profile (the server allows 5 per household). */
export const MAX_CONTACTS = 5;

/** An emergency contact as the API takes it. */
export const toContactIn = (c: {
  name: string;
  relationship?: string;
  countryCode: string;
  mobile: string;
}): ContactIn => ({
  name: c.name,
  relationship: c.relationship || null,
  country_code: c.countryCode,
  mobile_number: c.mobile,
});

/**
 * C5 (and D3): save the emergency contacts, in alert order. Replaces the whole list.
 * The server keeps contacts one by one and only shows masked numbers, so the old ones are removed and the new ones
 * added in order. When there is room, the new ones go in first, so the household never has no contact at all (an
 * active household with no contact drops back to pending).
 */
export async function saveContacts(householdId: string, contacts: ContactIn[]): Promise<ContactsOut> {
  const id = await realHouseholdId(householdId);
  const old = await call(api.GET('/api/v1/circles/{circle_id}/contacts', circle(id)));
  const add = async () => {
    for (const c of contacts)
      await call(api.POST('/api/v1/circles/{circle_id}/contacts', { ...circle(id), body: c }));
  };
  const remove = async () => {
    for (const c of old)
      await call(
        api.DELETE('/api/v1/circles/{circle_id}/contacts/{contact_id}', {
          params: { path: { circle_id: id, contact_id: c.id } },
        }),
      );
  };
  if (old.length + contacts.length <= MAX_CONTACTS) {
    await add();
    await remove();
  } else {
    await remove();
    await add();
  }
  return { contacts };
}

/**
 * The link put in the invite message. PENDING BACKEND: the server only gives the code; there is no join page yet,
 * so the link carries the code for the app to open (svaraa.ai/i/<code>).
 */
const inviteUrl = (code: string) => `https://svaraa.ai/i/${encodeURIComponent(code)}`;

/**
 * C7: create an invite code (single use, valid 24 hours; a wearer or admin approves whoever joins with it).
 * Up to 5 open invites per household.
 */
export async function createInvite(householdId: string, role: InviteRole): Promise<InviteOut> {
  const id = await realHouseholdId(householdId);
  const out = await call(
    api.POST('/api/v1/circles/{circle_id}/member-invites', { ...circle(id), body: { role } }),
  );
  return { code: out.code, url: inviteUrl(out.code), role: out.role, expires_at: out.expires_at };
}

/** The server's drill in the app's shape: `running` is the app's "waiting"; a cancelled drill counts as expired. */
const toDrill = (d: S['DrillOut']): DrillOut => ({
  id: d.id,
  status: d.status === 'running' ? 'waiting' : d.status === 'passed' ? 'passed' : 'expired',
  started_at: d.started_at,
  expires_at: d.expires_at,
  acknowledged_by: d.acknowledged_by,
});

/**
 * C8: start an SOS drill. The household must be active (a verified pendant and at least one contact), else 409.
 * Starting while one runs returns the running one.
 */
export async function startDrill(householdId: string): Promise<DrillOut> {
  const id = await realHouseholdId(householdId);
  return toDrill(await call(api.POST('/api/v1/circles/{circle_id}/drills', circle(id))));
}

/** C8: how the drill is going. Ask again every few seconds while it is "waiting". */
export async function getDrill(householdId: string, drillId: string): Promise<DrillOut> {
  const id = await realHouseholdId(householdId);
  return toDrill(
    await call(
      api.GET('/api/v1/circles/{circle_id}/drills/{drill_id}', {
        params: { path: { circle_id: id, drill_id: drillId } },
      }),
    ),
  );
}
