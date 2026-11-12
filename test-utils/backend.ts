import * as SecureStore from 'expo-secure-store';
import { useHousehold } from '@/features/household/store';
import { useSession } from '@/services/auth/session';
import { DRAFT_HOUSEHOLD_ID, realHouseholdId } from '@/services/household/householdApi';
import {
  activatePendant,
  claimPendant,
  getPairingChallenge,
  saveWearerProfile,
  type DeviceOut,
} from '@/services/household/wearerApi';
import { resetMockDb } from '@/services/mocks/db';
import { createMockFetch } from '@/services/mocks/fetchMock';

/** Every request the app made through the mock backend, newest last. */
export const requests: { method: string; path: string }[] = [];

const unhandled = (async () => {
  throw new Error('unhandled request');
}) as typeof fetch;

/** The mock backend as global fetch, with a record of the calls. Call in beforeEach. */
export async function useMockBackend(wrap?: (f: typeof fetch) => typeof fetch) {
  resetMockDb();
  // The mock hands out the same user ids after every reset, so saved values must not leak between tests.
  (SecureStore as unknown as { __reset: () => void }).__reset();
  requests.length = 0;
  const mock = createMockFetch(unhandled);
  const recording: typeof fetch = async (input, init) => {
    // Clone, so reading the request here does not use up its body.
    const req = input instanceof Request ? input.clone() : new Request(input as RequestInfo, init);
    requests.push({ method: req.method, path: new URL(req.url).pathname });
    return mock(input, init);
  };
  globalThis.fetch = wrap ? wrap(recording) : recording;
  await useSession.getState().clear();
  useHousehold.getState().unload();
}

export const calls = (path: string) => requests.filter((r) => r.path === path).length;

export const INDIA = { countryCode: '+91', mobile: '9876543210' };

/** The signed-in person's household on the mock server, as after C1 (POST /circles). Returns its id. */
export async function createWearerHousehold(): Promise<string> {
  await saveWearerProfile(DRAFT_HOUSEHOLD_ID, {
    name: 'Asha Rao',
    date_of_birth: '1950-07-05',
    languages: ['en'],
    pacemaker: false,
  });
  return realHouseholdId(DRAFT_HOUSEHOLD_ID);
}

/** Claim and pair a pendant on the mock server (C2 and C3), so the household can become active. */
export async function verifyTestPendant(householdId: string, code = 'SVRA-2041-7K3P'): Promise<DeviceOut> {
  const device = await claimPendant(householdId, code);
  await getPairingChallenge(householdId, device.id);
  return activatePendant(householdId, device.id, 'sim:test', 'pendant-test');
}
