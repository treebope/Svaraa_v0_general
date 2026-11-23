import { env } from '@/config/env';
import { useSettings } from '@/features/settings/store';
import i18n from '@/i18n';
import { ApiError } from '@/services/api';
import { darkColors, lightColors } from '@/ui/tokens';
import { GoogleCancelled, type GoogleResult } from './googleTypes';

/**
 * Google sign-in in the browser, with Google Identity Services (https://accounts.google.com/gsi/client).
 * Needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, and this page's address (e.g. http://localhost:8081) in that
 * client's "Authorized JavaScript origins" in Google Cloud Console.
 *
 * Shows Google's own sign-in button in a small window over the page; it opens Google's account chooser.
 * (Google's automatic prompt is not used: browsers hide it without telling the page.)
 */
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';
/** Lotus mark only (same assets as `ui/LogoMark`). Metro turns these into web URLs. */
const MARK = {
  light: require('../../assets/brand/mark-light.png') as unknown,
  dark: require('../../assets/brand/mark-dark.png') as unknown,
} as const;

function assetUrl(mod: unknown): string {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object') {
    const o = mod as { default?: unknown; uri?: unknown };
    if (typeof o.default === 'string') return o.default;
    if (typeof o.uri === 'string') return o.uri;
  }
  return String(mod);
}

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

function resolvedScheme(): 'light' | 'dark' {
  const preference = useSettings.getState().scheme;
  if (preference === 'light' || preference === 'dark') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Google's sign-in button in a small branded window over the page. */
function showButton(gsi: Gsi, onClose: () => void): () => void {
  const dark = resolvedScheme() === 'dark';
  const c = dark ? darkColors : lightColors;
  const t = (key: string) => i18n.t(key);

  const backdrop = document.createElement('div');
  backdrop.setAttribute('role', 'presentation');
  backdrop.style.cssText = [
    'position:fixed',
    'inset:0',
    `background:${c.scrim}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'z-index:9999',
    'box-sizing:border-box',
  ].join(';');

  const box = document.createElement('div');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'svaraa-google-title');
  box.style.cssText = [
    `background:${c.surfaceSolid}`,
    `border:1px solid ${c.borderSubtle}`,
    'border-radius:24px',
    'padding:28px 28px 24px',
    'display:flex',
    'flex-direction:column',
    'align-items:stretch',
    'gap:20px',
    'width:min(100%,360px)',
    'box-sizing:border-box',
    'box-shadow:0 18px 48px rgba(74,21,50,0.22)',
    'position:relative',
  ].join(';');

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', t('auth.welcome.googleModal.close'));
  close.style.cssText = [
    'position:absolute',
    'top:12px',
    'right:12px',
    'width:40px',
    'height:40px',
    'border:0',
    `background:${c.sunken}`,
    `color:${c.textSecondary}`,
    'border-radius:999px',
    'font-size:22px',
    'line-height:1',
    'cursor:pointer',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';');

  const header = document.createElement('div');
  header.style.cssText =
    'display:flex;flex-direction:column;align-items:center;gap:12px;padding:8px 12px 0;text-align:center';

  const brand = document.createElement('img');
  brand.src = assetUrl(MARK[dark ? 'dark' : 'light']);
  brand.alt = t('auth.welcome.logo');
  brand.style.cssText = [
    'height:56px',
    'width:56px',
    'object-fit:contain',
    'display:block',
    'margin:0 auto',
  ].join(';');

  const title = document.createElement('h2');
  title.id = 'svaraa-google-title';
  title.textContent = t('auth.welcome.googleModal.title');
  title.style.cssText = [
    'margin:0',
    `color:${c.heading}`,
    'font-family:Newsreader_400Regular, Newsreader, Georgia, serif',
    'font-size:26px',
    'font-weight:400',
    'line-height:1.25',
  ].join(';');

  const subtitle = document.createElement('p');
  subtitle.textContent = t('auth.welcome.googleModal.subtitle');
  subtitle.style.cssText = [
    'margin:0',
    `color:${c.textSecondary}`,
    'font-family:Inter_400Regular, Inter, system-ui, sans-serif',
    'font-size:14px',
    'line-height:1.45',
    'max-width:28em',
  ].join(';');

  header.append(brand, title, subtitle);

  // Google only allows outline / filled_blue / filled_black on its button, so we draw a Svaraa
  // gold control and stretch their invisible button on top to keep the real click + account chooser.
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;height:48px;border-radius:999px;overflow:hidden';

  const face = document.createElement('div');
  face.setAttribute('aria-hidden', 'true');
  face.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:10px',
    'background:#E2BD72',
    'color:#22180C',
    'border-radius:999px',
    'font-family:Inter_500Medium, Inter, system-ui, sans-serif',
    'font-size:15px',
    'font-weight:500',
    'pointer-events:none',
  ].join(';');
  face.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8A4.1 4.1 0 0 1 9 14.2c-2.5 0-4.6-1.7-5.3-4H.5v3.1A9 9 0 0 0 9 18c4.8 0 8.6-3.4 8.6-8.8z"/>
      <path fill="#34A853" d="M3.7 10.2A5.4 5.4 0 0 1 3.4 9c0-.4 0-.8.1-1.2V4.7H.5A9 9 0 0 0 0 9c0 1.5.4 2.8 1 4l2.7-2.8z"/>
      <path fill="#FBBC05" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.5-2.5A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .5 4.7l3.2 2.5C4.4 5.3 6.5 3.6 9 3.6z"/>
      <path fill="#EA4335" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.5-1.9.9-3.1.9-2.5 0-4.6-1.7-5.3-4H.5v3.1A9 9 0 0 0 9 18z"/>
    </svg>
    <span>${t('auth.welcome.google')}</span>
  `;

  const slot = document.createElement('div');
  slot.style.cssText = [
    'position:absolute',
    'inset:0',
    'opacity:0.01',
    'overflow:hidden',
    'display:flex',
    'align-items:center',
    'justify-content:center',
  ].join(';');

  wrap.append(face, slot);
  box.append(close, header, wrap);
  backdrop.appendChild(box);
  document.body.appendChild(backdrop);

  gsi.renderButton(slot, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: wrap.clientWidth || 300,
    locale: i18n.language === 'hi' ? 'hi' : 'en',
  });
  // Stretch Google's iframe/button to cover the gold face so the whole pill is clickable.
  const gBtn = slot.firstElementChild as HTMLElement | null;
  if (gBtn) {
    gBtn.style.cssText = 'width:100%!important;height:48px!important;max-width:none!important';
    const iframe = gBtn.querySelector('iframe');
    if (iframe) {
      iframe.style.cssText = 'width:100%!important;height:48px!important;max-width:none!important';
    }
  }

  const remove = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
  };
  const finishClose = () => {
    remove();
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') finishClose();
  };
  document.addEventListener('keydown', onKey);
  close.onclick = finishClose;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) finishClose();
  };
  close.focus();
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
