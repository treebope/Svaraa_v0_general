import { canEncode, createEncoder, type AudioFormat } from '@/services/audio/codecs';
import { pcmFromBytes, resample } from '@/services/audio/pcm';
import type { PendantMessage } from '@/services/pendant';
import type { ReplyAudio, ReplyPlayer } from './replyPlayerTypes';
import { VOICE_RATE } from './voiceChannel';

/**
 * Plays Svaraa's reply on the pendant instead of the phone: asks the server for 16-bit PCM, then
 *   PCM -> pendant's rate -> frames of the pendant's frame length -> pendant's codec (hello) -> AUDIO_RX, numbered
 * sent at about real time (a little ahead, so the pendant's buffer does not run dry). pendantVoice.ts sends
 * PLAYBACK_END when play() resolves, as for the phone.
 *
 * Replies the pendant cannot take go to `fallback` (the phone): MP3 from an older server that ignores reply_format,
 * or a pendant codec with no encoder here. New pendant codecs = registerEncoder() in services/audio/codecs.ts.
 */
export type PendantReplyPlayerOptions = {
  /** Sends one message to the pendant. Writes stay in order. */
  send: (m: PendantMessage) => Promise<void>;
  /** The pendant's audio format from its hello; undefined until then. */
  format: () => AudioFormat | undefined;
  /** Plays replies the pendant cannot take. Not set = they are skipped. */
  fallback?: ReplyPlayer;
  /** Audio sent ahead of real time. */
  leadMs?: number;
  /** Called after each frame written to the pendant (stats). */
  onFrame?: () => void;
  /** Called when a reply goes to the fallback instead, with the reason (logs). */
  onFallback?: (reason: string) => void;
  now?: () => number;
};

export const PENDANT_REPLY_LEAD_MS = 200;

export function createPendantReplyPlayer(options: PendantReplyPlayerOptions): ReplyPlayer {
  const { send, fallback } = options;
  const leadMs = options.leadMs ?? PENDANT_REPLY_LEAD_MS;
  const now = options.now ?? Date.now;
  let cancelCurrent: (() => void) | undefined;

  const stop = () => {
    cancelCurrent?.();
    fallback?.stop();
  };

  const toFallback = (reply: ReplyAudio, reason: string) => {
    options.onFallback?.(reason);
    return fallback ? fallback.play(reply) : Promise.resolve();
  };

  const play = (reply: ReplyAudio): Promise<void> => {
    stop();
    const format = options.format();
    if (!format) return toFallback(reply, 'no pendant format yet');
    if (reply.format !== 'pcm16') return toFallback(reply, `the server sent ${reply.format}, not pcm16`);
    if (!canEncode(format.codec)) return toFallback(reply, `no encoder for ${format.codec}`);

    const pcm = resample(pcmFromBytes(joined(reply.chunks)), reply.rate ?? VOICE_RATE, format.rate);
    const frameSamples = Math.max(1, Math.round((format.rate * format.frameMs) / 1000));
    const frameCount = Math.ceil(pcm.length / frameSamples);
    if (!frameCount) return Promise.resolve();
    const encoder = createEncoder(format);

    return new Promise<void>((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (cancelCurrent === finish) cancelCurrent = undefined;
        resolve();
      };
      cancelCurrent = finish;

      const start = now();
      let next = 0;
      const pump = async () => {
        if (done) return;
        const due = Math.min(frameCount, Math.floor((now() - start + leadMs) / format.frameMs) + 1);
        while (next < due) {
          const frame = new Int16Array(frameSamples); // the last frame is padded with silence
          frame.set(pcm.subarray(next * frameSamples, (next + 1) * frameSamples));
          await send({
            type: 'audio',
            seq: next & 0xffff,
            payload: encoder.encode(toChannels(frame, format.channels)),
          });
          if (done) return;
          next++;
          options.onFrame?.();
        }
        // All sent: the pendant still has about `leadMs` buffered, so "played" is a little later.
        timer =
          next >= frameCount ? setTimeout(finish, leadMs) : setTimeout(() => void pump(), format.frameMs);
      };
      void pump();
    });
  };

  return { wants: { format: 'pcm16', rate: VOICE_RATE }, play, stop };
}

function joined(chunks: ArrayBuffer[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(new Uint8Array(c), at);
    at += c.byteLength;
  }
  return out;
}

/** Mono -> interleaved copies for a pendant with more than one channel. */
function toChannels(mono: Int16Array, channels: number): Int16Array {
  if (channels <= 1) return mono;
  const out = new Int16Array(mono.length * channels);
  for (let i = 0; i < mono.length; i++) for (let c = 0; c < channels; c++) out[i * channels + c] = mono[i];
  return out;
}
