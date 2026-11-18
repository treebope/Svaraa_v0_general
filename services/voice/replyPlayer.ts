import { wavFromPcm } from '@/services/audio/wav';
import type { ReplyPlayer } from './replyPlayerTypes';
import { VOICE_RATE } from './voiceChannel';

export type { ReplyAudio, ReplyFormat, ReplyFormatRequest, ReplyPlayer } from './replyPlayerTypes';

/** Browser: an <audio> element on a Blob URL (the same way voiceSocket.ts plays replies). MP3, or PCM as WAV. */
export function createReplyPlayer(): ReplyPlayer {
  let current: (() => void) | undefined;
  return {
    stop: () => current?.(),
    play: (reply) =>
      new Promise<void>((resolve) => {
        current?.();
        if (typeof Audio === 'undefined' || !reply.chunks.length) return resolve();
        const blob =
          reply.format === 'pcm16'
            ? new Blob([wavFromPcm(reply.chunks, reply.rate ?? VOICE_RATE) as BlobPart], {
                type: 'audio/wav',
              })
            : new Blob(reply.chunks, { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        const done = () => {
          el.pause();
          URL.revokeObjectURL(url);
          current = undefined;
          resolve();
        };
        current = done;
        el.onended = done;
        el.onerror = done;
        el.play().catch(done);
      }),
  };
}
