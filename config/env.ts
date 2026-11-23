import Constants from 'expo-constants';
import { areaOf, flags } from './flags';

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.svaraa.example').replace(/\/$/, '');

/** Environment settings. Set EXPO_PUBLIC_* in .env (see .env.example). */
export const env = {
  /** Backend host, without /api/v1 (the generated paths already include it). */
  apiUrl,
  /** Voice socket host (wss:// for an https server). Empty in .env = derived from the API host. */
  wsUrl: (process.env.EXPO_PUBLIC_WS_URL || apiUrl.replace(/^http/, 'ws')).replace(/\/$/, ''),
  /** Use mock responses instead of the real backend. On until the backend URL is live. */
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true') === 'true',
  /**
   * Endpoints that go to the real backend even while mocks are on, e.g.
   * "POST /api/v1/auth/otp/request,GET /api/v1/users/me". "*" means all of them.
   */
  realEndpoints: (process.env.EXPO_PUBLIC_REAL_ENDPOINTS ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean),
  /** Google OAuth Web client ID (public, not a secret). Also in the backend's GOOGLE_CLIENT_IDS. */
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  /** Google OAuth iOS client ID (bundle ai.svaraa). Public. app.config.ts also makes it the iOS URL scheme. */
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  /** Show "use this demo code" hints (OTP, claim). Never true in prod builds. */
  showDevOtpHint: (process.env.EXPO_PUBLIC_SHOW_DEV_OTP_HINT ?? 'false') === 'true',
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
};

/**
 * True when this endpoint is answered by the mock backend.
 * Mocks are off for it when: mocks are off for the whole app, or its endpoint is listed in EXPO_PUBLIC_REAL_ENDPOINTS,
 * or its area is switched to 'real' in config/flags.ts.
 */
export function isMocked(method: string, path: string): boolean {
  if (!env.useMocks) return false;
  if (env.realEndpoints.includes('*') || env.realEndpoints.includes(`${method} ${path}`)) return false;
  const area = areaOf(path);
  return !(area && flags[area] === 'real');
}
