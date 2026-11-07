/**
 * A voice conversation with Svaraa (the call button beside the mic in chat).
 *
 * PENDING BACKEND (FE-14): there is no voice relay yet, so this plays a scripted conversation with the timings of a
 * real one: listening, hearing you, thinking, speaking. When the relay's WebSocket format arrives, replace the body of
 * `startVoiceSession` (microphone in, spoken reply out) and keep this same shape, so no screen changes.
 */
export type VoiceState = 'listening' | 'hearing' | 'thinking' | 'speaking' | 'muted';
export type VoiceTurn = { role: 'user' | 'assistant'; text: string };
/** What the person asks and what Svaraa answers, already translated. */
export type VoiceScript = { ask: string; answer: string }[];

export type VoiceHandlers = {
  onState: (state: VoiceState) => void;
  onTurn: (turn: VoiceTurn) => void;
};
export type VoiceSession = { setMuted: (muted: boolean) => void; stop: () => void };

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
