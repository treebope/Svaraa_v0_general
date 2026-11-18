/**
 * Formats the voice socket can send a reply in (`?reply_format=` on WS /voice/ws). 'mp3' is the server's default;
 * 'pcm16' is 16-bit little-endian mono PCM at `rate`, for players that re-encode the reply (the pendant).
 */
export type ReplyFormat = 'mp3' | 'pcm16';

export type ReplyFormatRequest = { format: ReplyFormat; rate?: number };

/** One whole reply as it came from the socket. `rate` is set for 'pcm16'. */
export type ReplyAudio = { format: ReplyFormat; rate?: number; chunks: ArrayBuffer[] };

/** Plays Svaraa's spoken reply. Shared by replyPlayer.ts, replyPlayer.native.ts and pendantReplyPlayer.ts. */
export interface ReplyPlayer {
  /** The format this player wants the server to send. Not set = the server's default (MP3). */
  readonly wants?: ReplyFormatRequest;
  /** Resolves when the reply finished (or failed) playing. */
  play(reply: ReplyAudio): Promise<void>;
  /** Stop a reply that is playing (resolves its play()). */
  stop(): void;
}
