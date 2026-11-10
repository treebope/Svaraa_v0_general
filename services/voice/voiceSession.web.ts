import { flags } from '@/config/flags';
import {
  startVoiceSession as startScripted,
  type VoiceHandlers,
  type VoiceScript,
  type VoiceSession,
} from './voiceScripted';
import { startSocketVoice } from './voiceSocket';

export * from './voiceScripted';

/**
 * Browser: the real conversation over WS /voice/ws when flags.ai is 'real' (EXPO_PUBLIC_REAL_AREAS=ai),
 * otherwise the scripted demo. Same shape either way, so the voice view does not change.
 */
export function startVoiceSession(script: VoiceScript, handlers: VoiceHandlers): VoiceSession {
  return isVoiceLive() ? startSocketVoice(handlers) : startScripted(script, handlers);
}

export const isVoiceLive = (): boolean => flags.ai === 'real';
