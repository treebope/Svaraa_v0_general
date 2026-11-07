import {
  api,
  call,
  type ContactIn,
  type DeviceOut,
  type InviteRole,
  type WearerProfileIn,
} from '@/services/api';

export type { ContactIn, DeviceOut, InviteRole, WearerProfileIn };

/** Version of the consent text on C1's "Details" sheet. Change it whenever that text changes. */
export const CONSENT_VERSION = '2026-11-v0';

const path = (householdId: string) => ({ params: { path: { household_id: householdId } } });

/**
 * C1: save the wearer's basics.
 * PENDING BACKEND: PATCH /api/v1/households/{household_id}/wearer is not in docs/openapi.json yet; answered by services/mocks.
 */
export const saveWearerProfile = (householdId: string, profile: WearerProfileIn) =>
  call(api.PATCH('/api/v1/households/{household_id}/wearer', { ...path(householdId), body: profile }));

/**
 * C1 checkbox: record that the wearer agreed, with the version of the text they saw.
 * PENDING BACKEND: POST /api/v1/households/{household_id}/consent is not in docs/openapi.json yet.
 */
export const giveConsent = (householdId: string, via: 'app' | 'link' = 'app') =>
  call(
    api.POST('/api/v1/households/{household_id}/consent', {
      ...path(householdId),
      body: { version: CONSENT_VERSION, via },
    }),
  );

/**
 * C2: claim the pendant with the one-time code from the box. Makes this household the owner.
 * Fails with `invalid_claim_code`, or `device_already_claimed` (details.owner_hint is a masked initial).
 * PENDING BACKEND: POST /api/v1/households/{household_id}/claim is not in docs/openapi.json yet.
 */
export const claimPendant = (householdId: string, code: string) =>
  call(api.POST('/api/v1/households/{household_id}/claim', { ...path(householdId), body: { code } }));

const device = (householdId: string, deviceId: string) => ({
  params: { path: { household_id: householdId, device_id: deviceId } },
});

/**
 * C3: a fresh random challenge for the pendant to sign.
 * PENDING BACKEND: POST /api/v1/households/{household_id}/devices/{device_id}/challenge is not in docs/openapi.json yet.
 */
export const getPairingChallenge = (householdId: string, deviceId: string) =>
  call(
    api.POST(
      '/api/v1/households/{household_id}/devices/{device_id}/challenge',
      device(householdId, deviceId),
    ),
  );

/**
 * C3: send the pendant's signature. The claim becomes "verified" and is locked to this household; this phone is the gateway.
 * Fails with `invalid_device_signature` for a pendant that is not genuine.
 * PENDING BACKEND: POST /api/v1/households/{household_id}/devices/{device_id}/activate is not in docs/openapi.json yet.
 */
export const activatePendant = (
  householdId: string,
  deviceId: string,
  signature: string,
  pendantId: string,
) =>
  call(
    api.POST('/api/v1/households/{household_id}/devices/{device_id}/activate', {
      ...device(householdId, deviceId),
      body: { signature, pendant_id: pendantId },
    }),
  );

/** Most emergency contacts setup takes. More can be added later in My Profile. */
export const MAX_SETUP_CONTACTS = 2;
/** Most emergency contacts in My Profile. PENDING BACKEND: confirm the real limit. */
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
 * C5: save the emergency contacts, in alert order. Replaces the whole list.
 * PENDING BACKEND: PUT /api/v1/households/{household_id}/contacts is not in docs/openapi.json yet.
 */
export const saveContacts = (householdId: string, contacts: ContactIn[]) =>
  call(api.PUT('/api/v1/households/{household_id}/contacts', { ...path(householdId), body: { contacts } }));

/**
 * C7: create an invite link and code (expires in 24 hours; the owner approves joiners). Creating a new one
 * cancels the earlier open invite.
 * PENDING BACKEND: POST /api/v1/households/{household_id}/invites is not in docs/openapi.json yet.
 */
export const createInvite = (householdId: string, role: InviteRole) =>
  call(api.POST('/api/v1/households/{household_id}/invites', { ...path(householdId), body: { role } }));

/**
 * C8: start an SOS drill. Contacts get alerts marked DRILL.
 * PENDING BACKEND: POST /api/v1/households/{household_id}/drills is not in docs/openapi.json yet.
 */
export const startDrill = (householdId: string) =>
  call(api.POST('/api/v1/households/{household_id}/drills', path(householdId)));

/**
 * C8: how the drill is going. Ask again every few seconds while it is "waiting".
 * PENDING BACKEND: GET /api/v1/households/{household_id}/drills/{drill_id} is not in docs/openapi.json yet.
 */
export const getDrill = (householdId: string, drillId: string) =>
  call(
    api.GET('/api/v1/households/{household_id}/drills/{drill_id}', {
      params: { path: { household_id: householdId, drill_id: drillId } },
    }),
  );
