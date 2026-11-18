import { decodeAdpcmFrame, encodeAdpcmFrame } from './adpcm';
import { pcmBytes, pcmFromBytes } from './pcm';

/**
 * Decoders for the pendant's audio, by the codec name in its hello. Each one turns one encoded frame into 16-bit PCM.
 * Built in: `pcm16` and `adpcm` (pure TypeScript, so they run in Hermes, Jest and the browser).
 *
 * Opus is not built in: Hermes has no WebAssembly, so it needs a native decoder module. When one is added, register
 * it here (registerDecoder('opus', ...)) and nothing else in the app changes.
 */
export type AudioFormat = { codec: string; rate: number; channels: number; frameMs: number };

export interface AudioDecoder {
  /** One encoded frame -> interleaved 16-bit samples at the format's rate and channel count. */
  decode(frame: Uint8Array): Int16Array;
  /** Forget state between utterances. */
  reset(): void;
}

export type DecoderFactory = (format: AudioFormat) => AudioDecoder;

const registry = new Map<string, DecoderFactory>();

export function registerDecoder(codec: string, factory: DecoderFactory) {
  registry.set(codec, factory);
}

export function canDecode(codec: string): boolean {
  return registry.has(codec);
}

export function decoderNames(): string[] {
  return [...registry.keys()].sort();
}

export function createDecoder(format: AudioFormat): AudioDecoder {
  const factory = registry.get(format.codec);
  if (!factory) throw new Error(`no decoder for ${format.codec}; available: ${decoderNames().join(', ')}`);
  return factory(format);
}

registerDecoder('pcm16', () => ({ decode: pcmFromBytes, reset: () => undefined }));
registerDecoder('adpcm', () => ({ decode: decodeAdpcmFrame, reset: () => undefined }));

/**
 * Encoders, the other direction: Svaraa's reply (16-bit PCM) -> the pendant's codec, one frame at a time, so the
 * reply can be played on the pendant. Same names as the decoders.
 */
export interface AudioEncoder {
  /** One frame of interleaved 16-bit samples at the format's rate and channel count -> one encoded frame. */
  encode(pcm: Int16Array): Uint8Array;
  /** Forget state between replies. */
  reset(): void;
}

export type EncoderFactory = (format: AudioFormat) => AudioEncoder;

const encoders = new Map<string, EncoderFactory>();

export function registerEncoder(codec: string, factory: EncoderFactory) {
  encoders.set(codec, factory);
}

export function canEncode(codec: string): boolean {
  return encoders.has(codec);
}

export function encoderNames(): string[] {
  return [...encoders.keys()].sort();
}

export function createEncoder(format: AudioFormat): AudioEncoder {
  const factory = encoders.get(format.codec);
  if (!factory) throw new Error(`no encoder for ${format.codec}; available: ${encoderNames().join(', ')}`);
  return factory(format);
}

registerEncoder('pcm16', () => ({ encode: (pcm) => new Uint8Array(pcmBytes(pcm)), reset: () => undefined }));
registerEncoder('adpcm', () => {
  // The coder state carries over between frames (smoother audio); each frame's header still lets it decode alone.
  let state = { predictor: 0, index: 0 };
  return {
    encode: (pcm) => encodeAdpcmFrame(pcm, state),
    reset: () => {
      state = { predictor: 0, index: 0 };
    },
  };
});
