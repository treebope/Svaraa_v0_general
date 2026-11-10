/** 'mock' = answered by the mock backend. 'real' = sent to the real backend. */
export type Source = 'mock' | 'real';

type Flags = {
  music: boolean;
  news: boolean;
  reminders: boolean;
  /** 'simulator' now; 'ble' once real Bluetooth is wired. */
  pendantTransport: 'simulator' | 'ble';
  /**
   * 'mock' = fake Google token. 'real' = Google's own sign-in, sent to POST /auth/google (needs auth: 'real').
   * Works in the browser today (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID); phones need a development build first.
   */
  googleSignIn: Source;
  /** One switch per API area. To connect an area to the real backend, change its value to 'real' (see docs/integration.md). */
  auth: Source;
  household: Source;
  notifications: Source;
  /** Svaraa's text chat (POST /chat/). */
  ai: Source;
};

/**
 * Areas switched to 'real' on this computer only, without changing the code below, e.g.
 * EXPO_PUBLIC_REAL_AREAS=auth,googleSignIn in .env. Tests never set it, so they keep the mocks.
 */
const realAreas = (process.env.EXPO_PUBLIC_REAL_AREAS ?? '').split(',').map((s: string) => s.trim());
const source = (area: string, value: Source): Source => (realAreas.includes(area) ? 'real' : value);

/** Feature flags. New features (music, news, reminders) = a new folder in features/ + a flag here. */
export const flags: Flags = {
  music: false,
  news: false,
  reminders: false,
  pendantTransport: 'simulator',
  googleSignIn: source('googleSignIn', 'mock'),
  auth: source('auth', 'mock'),
  household: source('household', 'mock'),
  notifications: source('notifications', 'mock'),
  ai: source('ai', 'mock'),
};

/** Which area an API path belongs to. Paths of no listed area are not switched here. */
export function areaOf(path: string): 'auth' | 'household' | 'notifications' | 'ai' | undefined {
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/api/v1/users/')) return 'auth';
  if (path.startsWith('/api/v1/chat/')) return 'ai';
  if (path.startsWith('/api/v1/households')) return 'household';
  if (path.startsWith('/api/v1/devices/')) return 'notifications';
  return undefined;
}
