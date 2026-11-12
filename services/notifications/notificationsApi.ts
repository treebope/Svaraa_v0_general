import { Platform } from 'react-native';
import { api, call } from '@/services/api';
import { env } from '@/config/env';
import { flags } from '@/config/flags';
import { getDeviceToken } from './permissions';

export { getPermission, openSettings, requestPermission, type PermissionStatus } from './permissions';

/**
 * Get this phone's push token and save it for the signed-in person (POST /me/installations). Call again whenever
 * the token changes; a token that belonged to another account is taken over.
 * The server takes phones only (android, ios): in a web browser there is nothing to save, so this does nothing.
 * While the notifications switch is 'mock', a phone that cannot give a real token (Expo Go, no project id) uses a
 * placeholder token, so the rest of the flow can be tested.
 */
export async function savePushToken(): Promise<void> {
  const device = await getDeviceToken();
  const platform = device?.platform ?? Platform.OS;
  if (platform !== 'ios' && platform !== 'android') return;
  const token = device?.token ?? (flags.notifications === 'mock' ? `mock-push-token-${platform}` : undefined);
  if (!token) throw new Error('No push token on this device');
  await call(
    api.POST('/api/v1/me/installations', {
      body: { platform, push_token: token, app_version: env.appVersion },
    }),
  );
}
