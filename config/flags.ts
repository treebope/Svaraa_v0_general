/** 'mock' = answered by the mock backend. 'real' = sent to the real backend. */
export type Source = 'mock' | 'real';

type Flags = {
  music: boolean;
  news: boolean;
  reminders: boolean;
  /** 'simulator' now; 'ble' once real Bluetooth is wired. */
  pendantTransport: 'simulator' | 'ble';
  /** 'mock' until a development build and the Google client IDs exist; then 'native'. */
  googleSignIn: 'mock' | 'native';
  /** One switch per API area. To connect an area to the real backend, change its value to 'real' (see docs/integration.md). */
  auth: Source;
  household: Source;
  notifications: Source;
};

/** Feature flags. New features (music, news, reminders) = a new folder in features/ + a flag here. */
export const flags: Flags = {
  music: false,
  news: true,
  reminders: false,
  pendantTransport: 'simulator',
  googleSignIn: 'mock',
  auth: 'mock',
  household: 'mock',
  notifications: 'mock',
};

/** Which area an API path belongs to. Paths of no listed area are not switched here. */
export function areaOf(path: string): 'auth' | 'household' | 'notifications' | undefined {
  if (path.startsWith('/api/v1/auth/') || path.startsWith('/api/v1/users/')) return 'auth';
  if (path.startsWith('/api/v1/households')) return 'household';
  if (path.startsWith('/api/v1/devices/')) return 'notifications';
  return undefined;
}
