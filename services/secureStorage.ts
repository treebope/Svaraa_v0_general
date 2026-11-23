import type { Storage } from './storage';

/**
 * Storage for tokens and other private values. In-memory fallback for tests and SSR.
 * Web uses secureStorage.web.ts (localStorage); mobile uses secureStorage.native.ts (SecureStore).
 */
const memory = new Map<string, string>();

export const secureStorage: Storage = {
  get: async (key) => memory.get(key) ?? null,
  set: async (key, value) => {
    memory.set(key, value);
  },
  remove: async (key) => {
    memory.delete(key);
  },
};
