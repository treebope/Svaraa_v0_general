import '@/i18n';

// Tests always use the mock backend, whatever the local .env switches to the real server.
process.env.EXPO_PUBLIC_REAL_AREAS = '';
process.env.EXPO_PUBLIC_REAL_ENDPOINTS = '';

// expo-secure-store has no native module in Jest: keep values in memory instead.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: async (k: string) => store.get(k) ?? null,
    setItemAsync: async (k: string, v: string) => void store.set(k, v),
    deleteItemAsync: async (k: string) => void store.delete(k),
    /** Tests only: forget everything saved. */
    __reset: () => store.clear(),
  };
});
