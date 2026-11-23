import type { Storage } from './storage';

/**
 * Web: persist tokens and private keys in localStorage so a reload keeps the person signed in.
 * (Mobile uses SecureStore via secureStorage.native.ts. The default secureStorage.ts stays in-memory for tests/SSR.)
 */
export const secureStorage: Storage = {
  get: async (key) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set: async (key, value) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* storage blocked: keep going without it */
    }
  },
  remove: async (key) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
