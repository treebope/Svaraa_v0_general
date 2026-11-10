import type { Dictation, DictationHandlers } from './dictationTypes';

export type { Dictation, DictationError, DictationHandlers } from './dictationTypes';

/**
 * Speech to text in the browser, with the Web Speech API (Chrome, Edge, Safari; not Firefox).
 * The browser asks for the microphone the first time. Chrome sends the audio to Google to recognise it.
 */
type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative; length: number };
type RecognitionEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isDictationAvailable(): boolean {
  return !!recognitionClass();
}

/** App language → speech language. Indian English and Hindi. */
const SPEECH_LANG: Record<string, string> = { en: 'en-IN', hi: 'hi-IN' };

export function startDictation(language: string, handlers: DictationHandlers): Dictation {
  const Recognition = recognitionClass();
  if (!Recognition) {
    handlers.onError('failed');
    handlers.onEnd();
    return { stop: () => {} };
  }
  const r = new Recognition();
  r.lang = SPEECH_LANG[language] ?? 'en-IN';
  r.interimResults = true; // show words while the person is still speaking
  r.continuous = false; // stop after a pause, like a voice message

  r.onresult = (e) => {
    let text = '';
    for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
    handlers.onText(text.trim());
  };
  r.onerror = (e) => {
    // 'no-speech' and 'aborted' are not errors for the person: listening just ends.
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    handlers.onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'blocked' : 'failed');
  };
  r.onend = () => handlers.onEnd();
  try {
    r.start();
  } catch {
    handlers.onError('failed');
    handlers.onEnd();
  }
  return { stop: () => r.stop() };
}
