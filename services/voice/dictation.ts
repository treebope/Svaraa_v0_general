import type { Dictation, DictationHandlers } from './dictationTypes';

export type { Dictation, DictationError, DictationHandlers } from './dictationTypes';

/**
 * Speech to text for the chat mic (speak, and the words fill the message box).
 * Phones: not available yet. Needs a speech library such as expo-speech-recognition and a development build.
 * The browser version is dictation.web.ts.
 */
export function isDictationAvailable(): boolean {
  return false;
}

export function startDictation(_language: string, handlers: DictationHandlers): Dictation {
  handlers.onError('failed');
  handlers.onEnd();
  return { stop: () => {} };
}
