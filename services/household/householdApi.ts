import { api, call, type components, type HouseholdOut, type Role } from '@/services/api';
import { ApiError } from '@/services/api/errors';

export type { HouseholdOut, Role };
export type HomeHousehold = components['schemas']['HomeCircle'];

/**
 * The household before the server has it. The backend creates the household at C1, together with the wearer's
 * name, date of birth and consent (POST /circles, mode `wearer_first`), not at B1. So B1 keeps this placeholder,
 * and the first save at C1 creates the real household. Every call below accepts it and uses the real id once known.
 */
export const DRAFT_HOUSEHOLD_ID = 'draft';

/** The real id of the household this person wears, once it exists (set by C1, or found through GET /me/home). */
let createdId: string | undefined;
let onKnown: ((id: string) => void) | undefined;

/** Called with the real household id whenever it becomes known, so the setup store can keep it instead of the placeholder. */
export function onHouseholdKnown(listener: (id: string) => void) {
  onKnown = listener;
}

/** Called by C1 once the server created the household. */
export function rememberHousehold(id: string) {
  createdId = id;
  onKnown?.(id);
}

/** Forget the remembered household (sign-out, tests). */
export function forgetHousehold() {
  createdId = undefined;
}

/**
 * A4 · Home: the households this person belongs to, with their state and setup checklist. Empty until setup starts.
 * (Backend name: circles.)
 */
export const getHome = () => call(api.GET('/api/v1/me/home'));

/** The household this person wears, if the server has one. */
export async function findWornHousehold(): Promise<HomeHousehold | undefined> {
  const home = await getHome();
  const worn = home.circles.find((c) => c.my_role === 'wearer');
  if (worn) rememberHousehold(worn.id);
  return worn;
}

/** Like findWornHousehold, but a failing GET /me/home counts as "none found", so setup can go on without it. */
export const findWornHouseholdIfAny = () => findWornHousehold().catch(() => undefined);

/**
 * The real household id for `id`. The placeholder becomes the household C1 created; before C1 there is none yet,
 * which answers 404 like an unknown household.
 */
export async function realHouseholdId(id: string): Promise<string> {
  if (id !== DRAFT_HOUSEHOLD_ID) return id;
  if (createdId) return createdId;
  const worn = await findWornHousehold();
  if (worn) return worn.id;
  throw new ApiError('not_found', 'The household is created at C1');
}

/**
 * B1 · Who are you? Starts setup with the person's role. Someone who already wears a household (for example set
 * up on another phone) continues with it; otherwise setup starts with the placeholder until C1.
 * Caregivers join a household by the wearer's invite, so B1 only offers the wearer role.
 */
export async function createHousehold(role: Role): Promise<HouseholdOut> {
  const worn = role === 'wearer' ? await findWornHouseholdIfAny() : undefined;
  return { id: worn?.id ?? DRAFT_HOUSEHOLD_ID, role };
}
