import { wavFromPcm } from '@/services/audio/wav';
import { bytesToBase64 } from '@/services/pendant/bytes';
import type { ReplyPlayer } from './replyPlayerTypes';
import { VOICE_RATE } from './voiceChannel';

export type { ReplyAudio, ReplyFormat, ReplyFormatRequest, ReplyPlayer } from './replyPlayerTypes';

/** The little of expo-audio used here, loaded on first use (like features/games/sound.native.ts). */
interface Player {
  play(): void;
  pause(): void;
  remove(): void;
  addListener(
    event: 'playbackStatusUpdate',
    cb: (s: { didJustFinish?: boolean }) => void,
  ): { remove(): void };
}
interface AudioApi {
  createAudioPlayer(source: { uri: string }): Player;
  setAudioModeAsync(mode: { playsInSilentMode: boolean }): Promise<void>;
}

/** Longest reply we wait for before giving up on a "finished" event. */
const MAX_REPLY_MS = 120_000;

let api: AudioApi | null | undefined;
const audio = (): AudioApi | undefined => {
  if (api !== undefined) return api ?? undefined;
  try {
    api = require('expo-audio') as AudioApi;
    void api.setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  } catch {
    api = null;
  }
  return api ?? undefined;
};

/**
 * Phone speaker. Plays MP3 replies, and PCM replies wrapped in a WAV header. The file is handed to expo-audio as a data: URI (Android's player reads those directly), so no file
 * is written. PENDING: check data: URIs on iOS; if they do not play there, write a cache file instead.
 */
export function createReplyPlayer(): ReplyPlayer {
  let current: { player: Player; done: () => void } | undefined;

  const stop = () => current?.done();

  return {
    stop,
    play: (reply) =>
      new Promise<void>((resolve) => {
        stop();
        const a = audio();
        const { chunks } = reply;
        const size = chunks.reduce((n, c) => n + c.byteLength, 0);
        if (!a || !size) return resolve();
        let bytes: Uint8Array;
        let mime: string;
        if (reply.format === 'pcm16') {
          bytes = wavFromPcm(chunks, reply.rate ?? VOICE_RATE);
          mime = 'audio/wav';
        } else {
          bytes = new Uint8Array(size);
          let at = 0;
          for (const c of chunks) {
            bytes.set(new Uint8Array(c), at);
            at += c.byteLength;
          }
          mime = 'audio/mpeg';
        }
        let player: Player;
        try {
          player = a.createAudioPlayer({ uri: `data:${mime};base64,${bytesToBase64(bytes)}` });
        } catch {
          return resolve();
        }
        let finished = false;
        const timer = setTimeout(() => done(), MAX_REPLY_MS);
        const sub = player.addListener('playbackStatusUpdate', (s) => s.didJustFinish && done());
        const done = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          sub.remove();
          try {
            player.pause();
            player.remove();
          } catch {
            /* already released */
          }
          if (current?.player === player) current = undefined;
          resolve();
        };
        current = { player, done };
        player.play();
      }),
  };
}
