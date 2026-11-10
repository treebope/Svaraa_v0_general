import { env } from '@/config/env';
import { ApiError } from '@/services/api';
import { GoogleCancelled, type GoogleResult } from './googleTypes';

/**
 * Google sign-in in the browser, with Google Identity Services (https://accounts.google.com/gsi/client).
 * Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and this page's address (e.g. http://localhost:5173) in that
 * client's "Authorized JavaScript origins" in Google Cloud Console.
 *
 * Shows Google's own sign-in button in a small window over the page; it opens Google's account chooser.
 * (Google's automatic prompt is not used: browsers hide it without telling the page.)
 */
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

type Credential = { credential: string };
type Gsi = {
  initialize: (options: { client_id: string; callback: (response: Credential) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: Gsi } };
  }
}

let loading: Promise<Gsi> | null = null;

function loadGsi(): Promise<Gsi> {
  loading ??= new Promise<Gsi>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('gsi'));
    script.onerror = () => reject(new ApiError('network_error'));
    document.head.appendChild(script);
  }).catch((e: unknown) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** The name in the ID token, only for the greeting. The server checks the token itself. */
function nameFrom(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(decodeURIComponent(escape(atob(payload)))) as { name?: string };
    return json.name || undefined;
  } catch {
    return undefined;
  }
}

/** Google's sign-in button in a small window over the page, for when the prompt is not shown. */
function showButton(gsi: Gsi, onClose: () => void): () => void {
  const backdrop = document.createElement('div');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999';
  const box = document.createElement('div');
  box.style.cssText =
    'background:#fff;border-radius:16px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;min-width:280px';
  const slot = document.createElement('div');
  const close = document.createElement('button');
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close');
  close.style.cssText =
    'align-self:flex-end;border:0;background:none;font-size:24px;line-height:1;cursor:pointer;padding:0 4px;color:#444';
  box.append(close, slot);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
  gsi.renderButton(slot, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
  });

  const remove = () => backdrop.remove();
  close.onclick = () => {
    remove();
    onClose();
  };
  backdrop.onclick = (e) => {
    if (e.target === backdrop) close.click();
  };
  return remove;
}

export async function getRealGoogleCredential(): Promise<GoogleResult> {
  if (!env.googleWebClientId) throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set in .env');
  const gsi = await loadGsi();

  return new Promise<GoogleResult>((resolve, reject) => {
    let removeButton: (() => void) | undefined;
    gsi.initialize({
      client_id: env.googleWebClientId,
      callback: ({ credential }) => {
        removeButton?.();
        if (!credential) return reject(new ApiError('invalid_google_token'));
        resolve({ idToken: credential, name: nameFrom(credential) });
      },
    });
    removeButton = showButton(gsi, () => reject(new GoogleCancelled()));
  });
}
