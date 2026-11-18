import {
  startVoiceSession as startScripted,
  type VoiceHandlers,
  type VoiceScript,
  type VoiceSession,
  type VoiceState,
} from './voiceScripted';
import { activePendantVoice, type PendantVoice, type PendantVoiceState } from './pendantVoice';

/**
 * A voice conversation with Svaraa (the call button beside the mic in chat).
 * Phones: through the pendant when the pendant voice is running (EXPO_PUBLIC_PENDANT_VOICE=svaraa, pendantVoice.ts),
 * otherwise the scripted demo (voiceScripted.ts). The phone's own microphone is not wired yet.
 * The browser version is voiceSession.web.ts.
 */
export {
  HEAR_MS,
  LISTEN_MS,
  SPEAK_MS,
  THINK_MS,
  type VoiceError,
  type VoiceHandlers,
  type VoiceScript,
  type VoiceSession,
  type VoiceState,
  type VoiceTurn,
} from './voiceScripted';

export function startVoiceSession(script: VoiceScript, handlers: VoiceHandlers): VoiceSession {
  const voice = activePendantVoice();
  return voice ? pendantCall(voice, handlers) : startScripted(script, handlers);
}

/** True when calls talk to the real server (no text comes back), false for the scripted demo. */
export const isVoiceLive = (): boolean => !!activePendantVoice();

const STATES: Record<PendantVoiceState, VoiceState> = {
  waiting: 'connecting',
  ready: 'listening',
  hearing: 'hearing',
  thinking: 'thinking',
  speaking: 'speaking',
  muted: 'muted',
  unsupported: 'connecting',
};

/** The voice view mirrors the pendant: it does not own the conversation, which goes on when the view closes. */
function pendantCall(voice: PendantVoice, handlers: VoiceHandlers): VoiceSession {
  const show = (s: PendantVoiceState) => {
    if (s === 'unsupported') handlers.onError?.('failed');
    else handlers.onState(STATES[s]);
  };
  show(voice.getState());
  const off = voice.subscribe({ onState: show });
  return {
    setMuted: (muted) => voice.setMuted(muted),
    stop: () => {
      off();
      voice.setMuted(false);
    },
  };
}
