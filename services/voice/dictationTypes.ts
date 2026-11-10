/** Shared by dictation.ts and dictation.web.ts (a file cannot import './dictation' on web: that resolves to itself). */

/** Why dictation stopped early. `blocked` = no microphone permission; `failed` = anything else (network, no mic). */
export type DictationError = 'blocked' | 'failed';

export type DictationHandlers = {
  /** Everything heard so far in this session, updated while the person speaks. */
  onText: (text: string) => void;
  /** Listening stopped: silence, `stop()`, or an error (after `onError`). */
  onEnd: () => void;
  onError: (error: DictationError) => void;
};

export type Dictation = { stop: () => void };
