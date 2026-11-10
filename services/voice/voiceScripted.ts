/**
 * A voice conversation with Svaraa (the call button beside the mic in chat): the scripted demo.
 *
 * Used on phones (no microphone streaming yet), in tests, and on web while flags.ai is 'mock'. It plays a scripted
 * conversation with the timings of a real one: listening, hearing you, thinking, speaking.
 * The real conversation over WS /voice/ws is voiceSocket.ts (web), chosen in voiceSession.web.ts.
 */
export type VoiceState = 'connecting' | 'listening' | 'hearing' | 'thinking' | 'speaking' | 'muted';
export type VoiceTurn = { role: 'user' | 'assistant'; text: string };
/** What the person asks and what Svaraa answers, already translated. */
export type VoiceScript = { ask: string; answer: string }[];
/** Why a call ended early. `blocked` = no microphone permission; `failed` = no connection or the server closed it. */
export type VoiceError = 'blocked' | 'failed';

export type VoiceHandlers = {
  onState: (state: VoiceState) => void;
  /** What was said, as text. The real server does not send text yet, so only the demo calls this. */
  onTurn: (turn: VoiceTurn) => void;
  /** The call cannot go on. The session has already stopped itself. */
  onError?: (error: VoiceError) => void;
};
export type VoiceSession = { setMuted: (muted: boolean) => void; stop: () => void };

/** True when calls talk to the real server (no text comes back), false for the scripted demo. */
export const isVoiceLive = (): boolean => false;

export const LISTEN_MS = 1800;
export const HEAR_MS = 1800;
export const THINK_MS = 1200;
export const SPEAK_MS = 3200;

export function startVoiceSession(script: VoiceScript, handlers: VoiceHandlers): VoiceSession {
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let muted = false;

  const after = (ms: number, then: () => void) => {
    timer = setTimeout(() => {
      if (!stopped && !muted) then();
    }, ms);
  };

  const turn = () => {
    const entry = script[next % script.length];
    if (!entry) return;
    handlers.onState('listening');
    after(LISTEN_MS, () => {
      handlers.onState('hearing');
      after(HEAR_MS, () => {
        next += 1;
        handlers.onTurn({ role: 'user', text: entry.ask });
        handlers.onState('thinking');
        after(THINK_MS, () => {
          handlers.onTurn({ role: 'assistant', text: entry.answer });
          handlers.onState('speaking');
          after(SPEAK_MS, turn);
        });
      });
    });
  };

  turn();

  return {
    setMuted: (value) => {
      if (value === muted || stopped) return;
      muted = value;
      clearTimeout(timer);
      if (value) handlers.onState('muted');
      else turn();
    },
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
