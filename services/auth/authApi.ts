import { api, call } from '@/services/api';
import { flags } from '@/config/flags';
import { getRealGoogleCredential } from './google';
import { GoogleCancelled, type GoogleResult } from './googleTypes';
import { useSession } from './session';

/** A phone number is two fields on the backend: the dialling code and the number without it. */
export type PhoneNumber = { countryCode: string; mobile: string };
const body = (p: PhoneNumber) => ({ country_code: p.countryCode, mobile_number: p.mobile });
export const formatPhone = (p: PhoneNumber) => `${p.countryCode} ${p.mobile}`;

export const requestOtp = (p: PhoneNumber) => call(api.POST('/api/v1/auth/otp/request', { body: body(p) }));

/** Verify the code and sign in. Saves the session. Returns whether the account is new. */
export async function verifyOtpAndSignIn(p: PhoneNumber, code: string): Promise<{ isNew: boolean }> {
  const out = await call(api.POST('/api/v1/auth/otp/verify', { body: { ...body(p), code } }));
  await useSession.getState().signIn(out, { method: 'phone', mobile: p.countryCode + p.mobile });
  return { isNew: out.is_new };
}

export async function signInWithGoogleToken(idToken: string, name?: string): Promise<{ isNew: boolean }> {
  const out = await call(api.POST('/api/v1/auth/google', { body: { id_token: idToken } }));
  await useSession.getState().signIn(out, { method: 'google', googleName: name });
  await saveGoogleName(name);
  return { isNew: out.is_new };
}

/**
 * After Google sign-in, save the name Google gave us as the profile name, but only if the profile has none.
 * A name the person already saved is never overwritten. Best effort: if this fails, sign-in still succeeds
 * and the greeting falls back to the Google name kept on the phone.
 */
async function saveGoogleName(name?: string): Promise<void> {
  const googleName = name?.trim();
  if (!googleName) return;
  try {
    const profile = await getProfile();
    if (!profile.display_name?.trim()) await updateProfile({ display_name: googleName });
  } catch {
    /* ignore: see above */
  }
}

/** Add a mobile number to a Google account: send the code, then confirm it. */
export const requestMobile = (p: PhoneNumber) =>
  call(api.POST('/api/v1/auth/mobile/request', { body: body(p) }));

export async function verifyMobile(p: PhoneNumber, code: string): Promise<void> {
  await call(api.POST('/api/v1/auth/mobile/verify', { body: { ...body(p), code } }));
  await useSession.getState().setMobile(p.countryCode + p.mobile);
}

/** End this session on the server, then on this phone. The phone is signed out even if the server cannot be reached. */
export async function logout(): Promise<void> {
  try {
    await call(api.POST('/api/v1/auth/logout'));
  } catch {
    /* signing out must always work */
  }
  await useSession.getState().clear();
}

export const getProfile = () => call(api.GET('/api/v1/users/me'));
export const updateProfile = (patch: { display_name?: string; avatar_url?: string }) =>
  call(api.PATCH('/api/v1/users/me', { body: patch }));
export const skipProfile = () => call(api.POST('/api/v1/users/me/profile/skip'));

export { GoogleCancelled, type GoogleResult };

/**
 * Google sign-in. With flags.googleSignIn = 'mock': a fake ID token. With 'real': Google's sign-in
 * (browser: google.web.ts; phones: not wired yet, see google.ts). Throws GoogleCancelled if the person closes it.
 */
export async function getGoogleCredential(): Promise<GoogleResult> {
  if (flags.googleSignIn === 'mock') return { idToken: 'mock-google-id-token' }; // no name: the greeting is then just "Hello"
  return getRealGoogleCredential();
}
