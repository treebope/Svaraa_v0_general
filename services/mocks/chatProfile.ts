/**
 * PENDING BACKEND: phrase → chat events for profile / settings when the real LLM tools are not on the mock.
 * Mirrors backend settings_tool + profile_tool event shapes so the app can be tried end to end offline.
 */
import i18n from '@/i18n';
import type { components } from '@/services/api/schema';

type ChatResponse = components['schemas']['ChatResponse'];

type Parsed = { response: string; events: ChatResponse['events'] };

const SCHEME: Record<string, 'light' | 'dark' | 'system'> = {
  light: 'light',
  dark: 'dark',
  system: 'system',
};

const LANG: Record<string, string> = {
  english: 'en',
  en: 'en',
  hindi: 'hi',
  hi: 'hi',
  tamil: 'ta',
  ta: 'ta',
  chinese: 'zh',
  zh: 'zh',
  korean: 'ko',
  ko: 'ko',
  japanese: 'ja',
  ja: 'ja',
};

const BG: Record<string, 'rose' | 'sand' | 'mist'> = {
  rose: 'rose',
  'soft rose': 'rose',
  sand: 'sand',
  'warm sand': 'sand',
  mist: 'mist',
  'cool mist': 'mist',
};

/**
 * If the message looks like a profile/settings ask, return a reply + events.
 * Otherwise null (caller keeps the generic sample reply).
 */
export function mockProfileChat(message: string): Parsed | null {
  const text = message.trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  const scheme =
    matchScheme(lower) ??
    (/\b(dark|light)\s+mode\b/.test(lower)
      ? /dark/.test(lower)
        ? 'dark'
        : 'light'
      : /\bfollow\s+(the\s+)?phone\b|\bsystem\s+(theme|display)\b/.test(lower)
        ? 'system'
        : undefined);
  const language = matchLanguage(lower);
  const home_background = matchBackground(lower);
  const display_scale = matchDisplayScale(lower);

  if (scheme || language || home_background || display_scale) {
    const event: Record<string, unknown> = { type: 'settings', action: 'update' };
    const bits: string[] = [];
    if (scheme) {
      event.scheme = scheme;
      bits.push(i18n.t(`chat.mock.settings.scheme.${scheme}`));
    }
    if (language) {
      event.language = language;
      bits.push(i18n.t(`chat.mock.settings.language`, { code: language }));
    }
    if (home_background) {
      event.home_background = home_background;
      bits.push(i18n.t(`profile.backgroundOptions.${home_background}`));
    }
    if (display_scale) {
      event.display_scale = display_scale;
      bits.push(i18n.t(`chat.mock.settings.displayScale`, { scale: display_scale }));
    }
    return {
      response: i18n.t('chat.mock.settings.done', { changes: bits.join('; ') }),
      events: [event],
    };
  }

  const pendantCallAs =
    /\bon the pendant\b/i.test(text) || /\bsvaraa(?:'s)?\s+call(?:s)?\s+me\b/i.test(lower);
  const callAs = text.match(
    /\b(?:svaraa(?:'s)?\s+call(?:s)?\s+me|call me)\s+([A-Za-z][\w'-]{0,40})(?:\s+on the pendant)?/i,
  );
  const wearerName = text.match(
    /\b(?:wearer's name is|change (?:my|the) wearer(?:'s)? name to|my (?:legal |full )?name is)\s+([A-Za-z][\w .'-]{0,40})/i,
  );
  const langs = matchWearerLanguages(lower);
  if ((callAs?.[1] && pendantCallAs) || wearerName?.[1] || langs) {
    const event: Record<string, unknown> = { type: 'profile', action: 'wearer' };
    const bits: string[] = [];
    if (wearerName?.[1]) {
      const name = wearerName[1].trim().replace(/[.!?]+$/, '');
      event.name = name;
      bits.push(i18n.t('chat.mock.wearer.name', { name }));
    }
    if (callAs?.[1] && pendantCallAs) {
      const call_as = callAs[1].trim().replace(/[.!?]+$/, '');
      event.call_as = call_as;
      bits.push(i18n.t('chat.mock.wearer.callAs', { name: call_as }));
    }
    if (langs) {
      event.languages = langs;
      bits.push(i18n.t('chat.mock.wearer.languages', { list: langs.join(', ') }));
    }
    if (!bits.length) return null;
    return {
      response: i18n.t('chat.mock.wearer.done', { changes: bits.join('; ') }),
      events: [event],
    };
  }

  const display = text.match(
    /\b(?:call me|change my (?:name|display name) to|my (?:account )?name is)\s+([A-Za-z][\w .'-]{0,40})/i,
  );
  if (display?.[1]) {
    const display_name = display[1].trim().replace(/[.!?]+$/, '');
    return {
      response: i18n.t('chat.mock.displayName', { name: display_name }),
      events: [{ type: 'profile', action: 'display_name', display_name }],
    };
  }

  const contact = text.match(
    /\badd\s+([A-Za-z][\w .'-]{0,40})\s+as\s+(?:an?\s+)?(?:emergency|sos)\s+contact\b(?:.*?(\+\d{1,4})\s*[- ]?(\d{6,15}))?/i,
  );
  if (contact?.[1]) {
    const name = contact[1].trim();
    const country_code = contact[2] ?? '+91';
    const mobile_number = (contact[3] ?? '9812344410').replace(/\D/g, '');
    const relationship = lower.includes('daughter') ? 'Daughter' : lower.includes('son') ? 'Son' : undefined;
    return {
      response: i18n.t('chat.mock.contact', { name, phone: `${country_code} ${mobile_number}` }),
      events: [
        {
          type: 'contacts',
          action: 'added',
          contact: {
            name,
            relationship: relationship ?? null,
            country_code,
            mobile_number,
            mobile: `${country_code}${mobile_number}`,
          },
        },
      ],
    };
  }

  return null;
}

function matchScheme(lower: string): 'light' | 'dark' | 'system' | undefined {
  const m = lower.match(/\b(?:switch to|use|set)\s+(light|dark|system)(?:\s+(?:mode|theme|display))?\b/);
  if (m?.[1] && SCHEME[m[1]]) return SCHEME[m[1]];
  if (/\bdark\s+mode\b|\bswitch to dark\b/.test(lower)) return 'dark';
  if (/\blight\s+mode\b|\bswitch to light\b/.test(lower)) return 'light';
  return undefined;
}

function matchLanguage(lower: string): string | undefined {
  const m = lower.match(
    /\b(?:language|ui|app)\s*(?:to|in)?\s*(english|hindi|tamil|chinese|korean|japanese|en|hi|ta|zh|ko|ja)\b|\b(?:speak|use|switch to)\s+(english|hindi|tamil|chinese|korean|japanese)\b/,
  );
  const key = m?.[1] ?? m?.[2];
  return key ? LANG[key] : undefined;
}

function matchBackground(lower: string): 'rose' | 'sand' | 'mist' | undefined {
  const m = lower.match(
    /\b(?:home\s+)?background\s*(?:to|is)?\s*(soft rose|warm sand|cool mist|rose|sand|mist)\b|\b(?:soft rose|warm sand|cool mist)\b/,
  );
  const key = m?.[1] ?? m?.[0];
  return key ? BG[key.trim()] : undefined;
}

function matchWearerLanguages(lower: string): string[] | undefined {
  if (!/\b(?:i speak|languages?|speak)\b/.test(lower)) return undefined;
  const found: string[] = [];
  for (const [name, code] of Object.entries({
    english: 'en',
    hindi: 'hi',
    tamil: 'ta',
    gujarati: 'gu',
    bengali: 'bn',
  })) {
    if (lower.includes(name)) found.push(code);
  }
  return found.length ? found : undefined;
}

/** 1× / 2× / 3× text and apps size (Profile accessibility). */
function matchDisplayScale(lower: string): 1 | 2 | 3 | undefined {
  if (/\b3\s*[x×]\b|\bthree\s*x\b|\btriple\s+(?:size|text|scale)\b/.test(lower)) return 3;
  if (/\b2\s*[x×]\b|\btwo\s*x\b|\bdouble\s+(?:size|text|scale)\b/.test(lower)) return 2;
  if (
    /\b1\s*[x×]\b|\bone\s*x\b|\bnormal (?:size|text|scale)\b|\bdefault size\b|\bmake (?:the )?(?:text|apps?) (?:normal|smaller)\b/.test(
      lower,
    )
  )
    return 1;
  if (
    /\b(?:make (?:the )?(?:text|apps?|font|everything) (?:bigger|larger)|bigger text|larger text|easier to read|low vision)\b/.test(
      lower,
    )
  )
    return 2;
  const m = lower.match(
    /\b(?:text|apps?|font|display)\s*(?:and apps? )?(?:size|scale)\s*(?:to\s*)?([123])(?:\s*[x×])?\b/,
  );
  if (m?.[1] === '1' || m?.[1] === '2' || m?.[1] === '3') return Number(m[1]) as 1 | 2 | 3;
  return undefined;
}
