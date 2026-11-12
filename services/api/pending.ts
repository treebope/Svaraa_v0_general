/**
 * Two kinds of hand-written types:
 * 1. The app's own shapes for household setup (role, wearer profile, pendant, contacts, invite, drill). The screens
 *    use these; services/household maps them to and from the real API (/circles, /devices, /me), so the screens did
 *    not change when setup moved to the real backend.
 * 2. PENDING BACKEND: endpoints the app needs that the live server does not have yet (PendingPaths below), written
 *    in the same shape as schema.d.ts so the client stays typed. When one reaches the server: run
 *    `npm run api:generate`, then delete it here.
 */
type Json<T> = { 'application/json': T };
type NoHeaders = { [name: string]: unknown };

export type Role = 'wearer' | 'caregiver';
export type HouseholdCreateIn = { role: Role };
export type HouseholdOut = { id: string; role: Role };
export type PushTokenIn = { token: string; platform: 'ios' | 'android' | 'web' };

/** C1 (and D2): the wearer's basics. `call_as` is how the voice assistant addresses them. No address in v0. */
export type WearerProfileIn = {
  name: string;
  call_as?: string | null;
  /** ISO date, YYYY-MM-DD. Required. */
  date_of_birth: string;
  /** Language ids, e.g. ['en', 'ta']. */
  languages: string[];
  health_notes?: string | null;
  pacemaker: boolean;
};
export type WearerProfileOut = WearerProfileIn;
/** A consent record. `version` is the version of the consent text the person agreed to. */
export type ConsentIn = { version: string; via: 'app' | 'link' };
/** C2: the one-time code from the card in the box (from the QR, or typed). */
export type ClaimIn = { code: string };
export type ClaimState = 'unverified' | 'verified';
export type DeviceOut = { id: string; serial: string; claim_state: ClaimState; is_owner: boolean };
/** C3: a random challenge the pendant signs to prove it is genuine. */
export type ChallengeOut = { challenge: string };
/** C3: the signed challenge, and the Bluetooth id of the pendant this phone paired with (the gateway). */
export type ActivateIn = { signature: string; pendant_id: string };
/** C5, C6 (and D3): an emergency contact. Needs no account; how they are alerted is decided by Svaraa. */
export type ContactIn = {
  name: string;
  relationship?: string | null;
  /** With the plus, e.g. "+91". */
  country_code: string;
  mobile_number: string;
};
/** The whole list, in alert order. Saving replaces the list. */
export type ContactsIn = { contacts: ContactIn[] };
export type ContactsOut = ContactsIn;
/** C7: invite someone to help, as Admin (sees status, edits settings) or Viewer (sees alerts only). */
export type InviteRole = 'admin' | 'viewer';
export type InviteIn = { role: InviteRole };
export type InviteOut = { code: string; url: string; role: InviteRole; expires_at: string };
/** News: the top five stories for a region, found by an AI web search on the backend. */
export type NewsRegion = 'world' | 'IN' | 'US' | 'CA';
export type NewsItem = {
  id: string;
  /** 1 to 5, most important first. */
  rank: number;
  title: string;
  /** Two or three plain sentences, in the language the app is in. */
  summary: string;
  source: string;
  url: string;
  published_at: string;
};
export type NewsOut = { region: NewsRegion; generated_at: string; items: NewsItem[] };

/** C8: an SOS drill. Alerts go to the emergency contacts marked DRILL; it passes when one of them answers. */
export type DrillStatus = 'waiting' | 'passed' | 'expired';
export type DrillOut = {
  id: string;
  status: DrillStatus;
  started_at: string;
  /** The drill fails if nobody answers by then (five minutes after the start). */
  expires_at: string;
  /** Name of the contact who answered, once passed. */
  acknowledged_by?: string | null;
};

/** POST /chat/. Leave out session_id on the first message; send back the one the server returns. */
export type ChatIn = { session_id?: string | null; message: string };
/** The server starts a new session (new id) when the old one expired: idle for 4 hours, or a server restart. */
export type ChatOut = { session_id: string; response: string; expires_at: string };

/** Path parameters such as `{ region: string }`. */
type WithPath<P> = { query?: never; header?: never; path: P; cookie?: never };
type NewsPath = { region: NewsRegion };
type Empty = { headers: NoHeaders; content?: never };
/** An operation on a path with parameters. `In = void` means no body; `Out = void` means 204 No Content. */
type PathOperation<P, In, Out> = {
  parameters: WithPath<P>;
  responses: Out extends void ? { 204: Empty } : { 200: { headers: NoHeaders; content: Json<Out> } };
} & ([In] extends [void] ? { requestBody?: never } : { requestBody: { content: Json<In> } });
type NoMethods = {
  get?: never;
  put?: never;
  post?: never;
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
};
type PathItem<P, Ops extends Partial<Record<keyof NoMethods, unknown>>> = { parameters: WithPath<P> } & Omit<
  NoMethods,
  keyof Ops
> &
  Ops;

export type PendingPaths = {
  '/api/v1/news/{region}': PathItem<NewsPath, { get: PathOperation<NewsPath, void, NewsOut> }>;
};
