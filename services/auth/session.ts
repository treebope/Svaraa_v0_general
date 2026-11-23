import { create } from 'zustand';
import type { components } from '@/services/api/schema';
import { secureStorage } from '@/services/secureStorage';

type SignInOut = components['schemas']['SignInOut'];

const SESSION_KEY = 'svaraa.session';
/** pending backend: /users/me has no mobile_number yet, so the verified number is remembered on this phone. */
const mobileKey = (userId: string) => `svaraa.mobile.${userId}`;

export type SignInMethod = 'phone' | 'google';

type Saved = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  method: SignInMethod;
  /** The name Google gave us at sign-in, used for the greeting until the backend has a display name. */
  googleName?: string;
  /** Still on the post-signup intro (A3). Kept so a reload does not skip it. */
  showIntro?: boolean;
};

type SessionState = {
  /** `loading` until the saved session has been read. */
  status: 'loading' | 'signedOut' | 'signedIn';
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  method?: SignInMethod;
  googleName?: string;
  /** Verified mobile number. pending backend: mock field, kept on the device. */
  mobile?: string;
  /** True right after the account was created: shows the intro (A3) once. */
  showIntro: boolean;
  restore: () => Promise<void>;
  signIn: (
    out: SignInOut,
    extra: { method: SignInMethod; mobile?: string; googleName?: string },
  ) => Promise<void>;
  setAccessToken: (token: string) => Promise<void>;
  setMobile: (mobile: string) => Promise<void>;
  finishIntro: () => void;
  /** Forget this sign-in on this phone. Does not call the server (see authService.logout). */
  clear: () => Promise<void>;
};

async function save(s: SessionState): Promise<void> {
  if (!s.accessToken || !s.refreshToken || !s.userId || !s.method) return;
  const saved: Saved = {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    userId: s.userId,
    method: s.method,
    googleName: s.googleName,
    showIntro: s.showIntro,
  };
  await secureStorage.set(SESSION_KEY, JSON.stringify(saved));
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  showIntro: false,

  restore: async () => {
    try {
      const raw = await secureStorage.get(SESSION_KEY);
      const saved = raw ? (JSON.parse(raw) as Saved) : null;
      if (saved?.accessToken && saved.refreshToken && saved.userId) {
        const mobile = (await secureStorage.get(mobileKey(saved.userId))) ?? undefined;
        set({
          accessToken: saved.accessToken,
          refreshToken: saved.refreshToken,
          userId: saved.userId,
          method: saved.method,
          googleName: saved.googleName,
          showIntro: saved.showIntro ?? false,
          mobile,
          status: 'signedIn',
        });
        return;
      }
    } catch {
      /* unreadable saved session: treat as signed out */
    }
    set({ status: 'signedOut' });
  },

  signIn: async (out, extra) => {
    const stored = (await secureStorage.get(mobileKey(out.user_id))) ?? undefined;
    set({
      status: 'signedIn',
      accessToken: out.access_token,
      refreshToken: out.refresh_token,
      userId: out.user_id,
      method: extra.method,
      googleName: extra.googleName,
      mobile: extra.mobile ?? stored,
      showIntro: out.is_new,
    });
    if (extra.mobile) await secureStorage.set(mobileKey(out.user_id), extra.mobile);
    await save(get());
  },

  setAccessToken: async (accessToken) => {
    set({ accessToken });
    await save(get());
  },

  setMobile: async (mobile) => {
    const { userId } = get();
    set({ mobile });
    if (userId) await secureStorage.set(mobileKey(userId), mobile);
  },

  finishIntro: () => {
    set({ showIntro: false });
    void save(get());
  },

  clear: async () => {
    set({
      status: 'signedOut',
      accessToken: undefined,
      refreshToken: undefined,
      userId: undefined,
      method: undefined,
      googleName: undefined,
      mobile: undefined,
      showIntro: false,
    });
    await secureStorage.remove(SESSION_KEY);
  },
}));
