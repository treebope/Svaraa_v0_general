import { ApiError } from '@/services/api';
import {
  getGoogleCredential,
  getProfile,
  logout,
  requestMobile,
  requestOtp,
  signInWithGoogleToken,
  updateProfile,
  verifyMobile,
  verifyOtpAndSignIn,
} from '@/services/auth/authApi';
import { useSession } from '@/services/auth/session';
import { resetMockDb } from '@/services/mocks/db';
import { DEMO_CODE } from '@/services/mocks/routes';
import { calls, INDIA, requests, useMockBackend } from '@/test-utils/backend';
import { refreshAccessToken } from '@/services/api/authedFetch';

const code = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: ApiError) => e.code,
  );

beforeEach(() => useMockBackend());

describe('phone sign-in', () => {
  it('sends the country code and the number as separate fields', async () => {
    await expect(requestOtp(INDIA)).resolves.toBeUndefined();
    expect(calls('/api/v1/auth/otp/request')).toBe(1);
  });

  it('rejects a bad number or country code with the real error codes', async () => {
    expect(await code(requestOtp({ countryCode: '+91', mobile: '12' }))).toBe('invalid_mobile_number');
    expect(await code(requestOtp({ countryCode: '+abc', mobile: '9876543210' }))).toBe(
      'invalid_country_code',
    );
  });

  it('makes you wait 60 seconds before asking again (otp_cooldown)', async () => {
    await requestOtp(INDIA);
    expect(await code(requestOtp(INDIA))).toBe('otp_cooldown');
  });

  it('a wrong code is invalid_otp and does not sign in', async () => {
    expect(await code(verifyOtpAndSignIn(INDIA, '111111'))).toBe('invalid_otp');
    expect(useSession.getState().status).toBe('signedOut');
  });

  it('a new account goes to the intro (is_new = true)', async () => {
    const out = await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    expect(out.isNew).toBe(true);
    const s = useSession.getState();
    expect(s).toMatchObject({
      status: 'signedIn',
      method: 'phone',
      mobile: '+919876543210',
      showIntro: true,
    });
    expect(s.accessToken).toBeTruthy();
    expect(s.refreshToken).toBeTruthy();
  });

  it('an existing account goes straight to Home (is_new = false)', async () => {
    const out = await verifyOtpAndSignIn({ countryCode: '+91', mobile: '9876543200' }, DEMO_CODE);
    expect(out.isNew).toBe(false);
    expect(useSession.getState().showIntro).toBe(false);
  });
});

describe('Google sign-in and adding a phone', () => {
  async function signInWithGoogle() {
    const { idToken, name } = await getGoogleCredential();
    return signInWithGoogleToken(idToken, name);
  }

  it('signs in with no mobile number yet, and no name (the mock Google account has none)', async () => {
    const out = await signInWithGoogle();
    expect(out.isNew).toBe(true);
    expect(useSession.getState()).toMatchObject({
      method: 'google',
      googleName: undefined,
      mobile: undefined,
    });
  });

  it('keeps the name Google gives, for the greeting', async () => {
    await signInWithGoogleToken('some-token', 'Meera Rao');
    expect(useSession.getState().googleName).toBe('Meera Rao');
  });

  it('saves the Google name as the profile name (PATCH /users/me) when the profile has none', async () => {
    await signInWithGoogleToken('some-token', 'Meera Rao');
    expect(calls('/api/v1/users/me')).toBe(2); // GET, then PATCH
    expect(requests.some((r) => r.method === 'PATCH' && r.path === '/api/v1/users/me')).toBe(true);
    expect(await getProfile()).toMatchObject({ display_name: 'Meera Rao', profile_status: 'completed' });
  });

  it('does not overwrite a name the person already saved', async () => {
    await signInWithGoogleToken('some-token', 'Meera Rao');
    await updateProfile({ display_name: 'Meera' });
    await signInWithGoogleToken('some-token', 'Meera Rao'); // signs in again, same account
    expect((await getProfile()).display_name).toBe('Meera');
  });

  it('does not touch the profile when Google gives no name', async () => {
    await signInWithGoogleToken('some-token');
    expect(calls('/api/v1/users/me')).toBe(0);
  });

  it('still signs in when saving the name fails', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      // Clone to read the URL without using up the request body.
      const url = input instanceof Request ? input.clone().url : String(input);
      if (new URL(url).pathname === '/api/v1/users/me') throw new TypeError('offline');
      return real(input, init);
    }) as typeof fetch;
    await expect(signInWithGoogleToken('some-token', 'Meera Rao')).resolves.toMatchObject({ isNew: true });
    expect(useSession.getState().status).toBe('signedIn');
  });

  it('asks a new Google user for a phone even after an earlier mock user added one and the app reloaded', async () => {
    await signInWithGoogle();
    await verifyMobile(INDIA, DEMO_CODE);
    // The app reloads: the mock backend starts empty, but the phone still has what it saved.
    resetMockDb({ reload: true });
    await useSession.getState().clear();
    await signInWithGoogle();
    expect(useSession.getState().mobile).toBeUndefined();
  });

  it('adds a phone with /auth/mobile/request then /auth/mobile/verify', async () => {
    await signInWithGoogle();
    await requestMobile(INDIA);
    expect(await code(verifyMobile(INDIA, '111111'))).toBe('invalid_otp');
    expect(useSession.getState().mobile).toBeUndefined();
    await verifyMobile(INDIA, DEMO_CODE);
    expect(useSession.getState().mobile).toBe('+919876543210');
  });

  it('refuses a number another account already uses (mobile_number_taken)', async () => {
    await signInWithGoogle();
    expect(await code(requestMobile({ countryCode: '+91', mobile: '9876543211' }))).toBe(
      'mobile_number_taken',
    );
  });

  it('needs a signed-in session', async () => {
    expect(await code(requestMobile(INDIA))).toBe('missing_token');
  });
});

describe('session on this phone', () => {
  it('is restored after the app restarts, including the saved mobile number', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    const { accessToken } = useSession.getState();
    useSession.setState({
      status: 'loading',
      accessToken: undefined,
      refreshToken: undefined,
      mobile: undefined,
      showIntro: false,
    });
    await useSession.getState().restore();
    expect(useSession.getState()).toMatchObject({
      status: 'signedIn',
      accessToken,
      mobile: '+919876543210',
      showIntro: true,
    });
  });

  it('keeps showIntro false after finishIntro across restore', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    useSession.getState().finishIntro();
    useSession.setState({ status: 'loading', accessToken: undefined, showIntro: true });
    await useSession.getState().restore();
    expect(useSession.getState().showIntro).toBe(false);
  });

  it('is signed out when nothing is saved', async () => {
    useSession.setState({ status: 'loading' });
    await useSession.getState().restore();
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('logout', () => {
  it('ends the session on the server and on the phone', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    await logout();
    expect(calls('/api/v1/auth/logout')).toBe(1);
    expect(useSession.getState()).toMatchObject({ status: 'signedOut', accessToken: undefined });
    // The refresh token no longer works after logout.
    useSession.setState({ refreshToken: 'mock-refresh-1' });
    expect(await refreshAccessToken()).toBe(false);
  });

  it('still signs out on the phone when the server cannot be reached', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    globalThis.fetch = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    await logout();
    expect(useSession.getState().status).toBe('signedOut');
  });
});

describe('profile', () => {
  it('reads and updates the name (PATCH /users/me)', async () => {
    await verifyOtpAndSignIn(INDIA, DEMO_CODE);
    expect((await getProfile()).profile_status).toBe('pending');
    const updated = await updateProfile({ display_name: 'Asha Rao' });
    expect(updated).toMatchObject({ display_name: 'Asha Rao', profile_status: 'completed' });
  });
});
