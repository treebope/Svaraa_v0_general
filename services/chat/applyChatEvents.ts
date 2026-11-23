/**
 * Apply chat/voice tool events on this phone (same shapes as ChatResponse.events / voice WebSocket).
 * Settings live only on the device. Profile/contact writes refresh the local wearer store (and PATCH account name).
 */
import { updateProfile } from '@/services/auth/authApi';
import { setAppDisplayScale } from '@/features/settings/displayScale';
import { setAppLanguage } from '@/features/settings/language';
import { HOME_BACKGROUNDS, type HomeBackgroundId } from '@/features/settings/homeBackground';
import {
  DISPLAY_SCALES,
  useSettings,
  type DisplayScale,
  type SchemePreference,
} from '@/features/settings/store';
import { LANGUAGES, type Language } from '@/i18n';
import { WEARER_LANGUAGES, type WearerLanguage } from '@/features/wearer/languages';
import { useWearer, type EmergencyContact } from '@/features/wearer/store';
import { useMusicPlayer } from '@/features/music/player';
import { useYouTubePlayer } from '@/features/music/youtubePlayer';
import type { Track } from '@/services/music/musicApi';

const SCHEMES: readonly SchemePreference[] = ['light', 'dark', 'system'];

const LANG_NAME_TO_CODE: Record<string, WearerLanguage> = {
  english: 'en',
  hindi: 'hi',
  tamil: 'ta',
  gujarati: 'gu',
  bengali: 'bn',
  en: 'en',
  hi: 'hi',
  ta: 'ta',
  gu: 'gu',
  bn: 'bn',
};

export type ChatEvent = Record<string, unknown>;

export async function applyChatEvents(events: ChatEvent[] | undefined | null): Promise<void> {
  if (!events?.length) return;
  for (const event of events) {
    try {
      await applyOne(event);
    } catch {
      /* one bad event must not block the rest */
    }
  }
}

async function applyOne(event: ChatEvent): Promise<void> {
  const type = typeof event.type === 'string' ? event.type : '';
  const action = typeof event.action === 'string' ? event.action : '';

  if (type === 'settings' && action === 'update') {
    await applySettings(event);
    return;
  }
  if (type === 'profile' && action === 'display_name') {
    await applyDisplayName(event);
    return;
  }
  if (type === 'profile' && action === 'wearer') {
    await applyWearer(event);
    return;
  }
  if (type === 'contacts' && action === 'added') {
    await applyContactAdded(event);
    return;
  }
  if (type === 'music') {
    await applyMusic(event, action);
    return;
  }
  if (type === 'youtube') {
    applyYoutube(event, action);
  }
}

async function applySettings(event: ChatEvent): Promise<void> {
  const settings = useSettings.getState();
  const scheme = event.scheme;
  if (typeof scheme === 'string' && (SCHEMES as readonly string[]).includes(scheme)) {
    settings.setScheme(scheme as SchemePreference);
  }
  const language = event.language;
  if (typeof language === 'string' && (LANGUAGES as readonly string[]).includes(language)) {
    await setAppLanguage(language as Language);
  }
  const bg = event.home_background;
  if (typeof bg === 'string' && (HOME_BACKGROUNDS as readonly string[]).includes(bg)) {
    settings.setHomeBackground(bg as HomeBackgroundId);
  }
  const scale = event.display_scale;
  const n = typeof scale === 'number' ? scale : typeof scale === 'string' ? Number(scale) : NaN;
  if ((DISPLAY_SCALES as readonly number[]).includes(n)) {
    await setAppDisplayScale(n as DisplayScale);
  }
}

async function applyDisplayName(event: ChatEvent): Promise<void> {
  const name = typeof event.display_name === 'string' ? event.display_name.trim() : '';
  if (!name) return;
  try {
    await updateProfile({ display_name: name });
  } catch {
    /* offline / PENDING BACKEND: name change waits until the profile API works */
  }
}

async function applyWearer(event: ChatEvent): Promise<void> {
  const wearer = useWearer.getState();
  const prev = wearer.profile;
  if (!prev) {
    /* no local profile yet — nothing to merge into */
    return;
  }
  const patch = { ...prev };
  if (typeof event.name === 'string' && event.name.trim()) patch.name = event.name.trim();
  if (typeof event.call_as === 'string') patch.call_as = event.call_as.trim() || null;
  if (Array.isArray(event.languages)) {
    const codes = event.languages
      .map((l) => (typeof l === 'string' ? LANG_NAME_TO_CODE[l.trim().toLowerCase()] : undefined))
      .filter((c): c is WearerLanguage => !!c && (WEARER_LANGUAGES as readonly string[]).includes(c));
    if (codes.length) patch.languages = [...new Set(codes)];
  }
  await wearer.save({ profile: patch });
}

async function applyContactAdded(event: ChatEvent): Promise<void> {
  const raw = event.contact;
  if (!raw || typeof raw !== 'object') return;
  const c = raw as Record<string, unknown>;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name) return;

  let countryCode = typeof c.country_code === 'string' ? c.country_code : '';
  let mobile = typeof c.mobile_number === 'string' ? c.mobile_number.replace(/\D/g, '') : '';
  if ((!countryCode || !mobile) && typeof c.mobile === 'string') {
    const split = splitE164(c.mobile);
    countryCode = countryCode || split.countryCode;
    mobile = mobile || split.mobile;
  }
  if (!countryCode || !mobile) return;

  const next: EmergencyContact = {
    name,
    relationship:
      typeof c.relationship === 'string' && c.relationship.trim() ? c.relationship.trim() : undefined,
    countryCode,
    mobile,
  };
  const wearer = useWearer.getState();
  const exists = wearer.contacts.some((p) => p.countryCode === next.countryCode && p.mobile === next.mobile);
  if (exists) return;
  await wearer.save({ contacts: [...wearer.contacts, next] });
}

function splitE164(e164: string): { countryCode: string; mobile: string } {
  const digits = e164.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length >= 12) {
    return { countryCode: '+91', mobile: digits.slice(2) };
  }
  if (digits.length > 10) {
    return { countryCode: `+${digits.slice(0, digits.length - 10)}`, mobile: digits.slice(-10) };
  }
  return { countryCode: '+91', mobile: digits };
}

async function applyMusic(event: ChatEvent, action: string): Promise<void> {
  const player = useMusicPlayer.getState();
  if (action === 'play') {
    const tracks = event.tracks;
    const first = Array.isArray(tracks) ? tracks[0] : undefined;
    if (first && typeof first === 'object' && first !== null && 'id' in first) {
      await player.play(first as Track);
    }
    return;
  }
  if (action === 'pause') player.pause();
  else if (action === 'resume') player.resume();
  else if (action === 'stop') player.stop();
}

function applyYoutube(event: ChatEvent, action: string): void {
  const yt = useYouTubePlayer.getState();
  if (action === 'play') {
    const id = typeof event.video_id === 'string' ? event.video_id : '';
    if (id) {
      void useMusicPlayer.getState().stop();
      yt.play(id);
    }
    return;
  }
  if (action === 'pause') yt.pause();
  else if (action === 'stop') yt.stop();
  else if (action === 'next') yt.next();
}
