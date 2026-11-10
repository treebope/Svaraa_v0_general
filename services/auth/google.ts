import type { GoogleResult } from './googleTypes';

/**
 * Google sign-in: get a Google ID token for `POST /auth/google`.
 * Phones: not wired yet. Needs a development build (not Expo Go), the iOS and Android client IDs and
 * @react-native-google-signin/google-signin (see docs/backend-integration-handoff.md, "Google sign-in plan").
 * The browser version is google.web.ts.
 */
export async function getRealGoogleCredential(): Promise<GoogleResult> {
  throw new Error('Google sign-in on phones is not wired yet');
}
