import { env } from '@/config/env';
import type { ReplyFormat, ReplyFormatRequest } from './replyPlayerTypes';

/**
 * The voice socket itself, WS /api/v1/voice/ws (frontend-api-contract, section 5.3), without any microphone or
 * speaker. Shared by the browser call (voiceSocket.ts, browser microphone) and the pendant (pendantVoice.ts, audio
 * from Bluetooth), so both talk to the server the same way:
 *  - the app may ask for a reply format: ?reply_format=pcm16&reply_rate=16000 (default: MP3);
 *  - the server first sends a text frame {"type":"session","session_id","reply_format",...};
 *  - the app sends 16-bit PCM, 16 kHz, mono, little-endian, in small binary chunks (~100 ms);
 *  - the server decides when the person stopped talking (~1 s of silence) and answers:
 *    {"type":"reply_start","format",...}, the audio chunks, {"type":"reply_end"}.
 * Older servers ignore reply_format (the session frame then has none, and replies are MP3) and send no reply_start or
 * reply_end: there, ~1 s with no new chunk = the reply is complete.
 * PENDING BACKEND: no sign-in on the socket yet; transcript frames are planned.
 */
export const VOICE_RATE = 16_000;
/** Chunk length the server expects. */
export const VOICE_CHUNK_MS = 100;
/** No new reply chunk for this long = the reply is complete. */
export const REPLY_GAP_MS = 1000;
/** Servers that send reply_end: no new chunk for this long = reply_end was lost, end the reply anyway. */
export const REPLY_STALL_MS = 15_000;
/** Render's free tier can take 30-60 s to wake up. */
export const CONNECT_MS = 60_000;

/** Kept for this app run, so a new call continues the same conversation (the server keeps it for 30 idle minutes). */
let lastSessionId: string | undefined;

/** The part of WebSocket used here (browser, React Native and test fakes all fit). */
export type VoiceSocket = {
  binaryType: string;
  readonly readyState: number;
  send(data: ArrayBuffer | ArrayBufferView): void;
  close(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: unknown) => void) | null;
  onerror?: ((e: unknown) => void) | null;
};

export type VoiceChannelHandlers = {
  /** The server opened a session: audio can be sent. */
  onReady?: (sessionId: string) => void;
  /** One piece of the spoken reply, in `info.format`. */
  onReplyChunk?: (chunk: ArrayBuffer, info: ReplyInfo) => void;
  /**
   * Set this to be told when a reply is complete (the server's reply_end, or REPLY_GAP_MS without a new chunk from
   * an older server). Gets the whole reply.
   */
  onReplyEnd?: (chunks: ArrayBuffer[], info: ReplyInfo) => void;
  /** The server refused the connection with an error frame (e.g. 'unsupported_reply_format'); it closes next. */
  onServerError?: (code: string) => void;
  /** The socket closed or never opened in time. Not called after close(). */
  onClose?: (reason: 'timeout' | 'closed') => void;
};

/** The format of the reply being received. `rate` is set for 'pcm16'. */
export type ReplyInfo = { format: ReplyFormat; rate?: number };

export type VoiceChannelOptions = {
  url?: string;
  createSocket?: (url: string) => VoiceSocket;
  connectMs?: number;
  replyGapMs?: number;
  /** Ask the server for this reply format. Not set = the server's default (MP3), as before. */
  replyFormat?: ReplyFormatRequest;
};

export type VoiceChannel = {
  /** True once the server's session frame arrived and until the socket closes. */
  isReady(): boolean;
  /** Little-endian 16-bit PCM at 16 kHz mono. Dropped while not ready. */
  send(pcm: ArrayBuffer | ArrayBufferView): boolean;
  close(): void;
};

export const voiceSocketUrl = (
  base = env.wsUrl,
  sessionId = lastSessionId,
  replyFormat?: ReplyFormatRequest,
) =>
  withReplyFormat(
    `${base}/api/v1/voice/ws${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`,
    replyFormat,
  );

/** Adds ?reply_format=…&reply_rate=… for anything but the default (MP3), so default URLs stay as they were. */
function withReplyFormat(url: string, replyFormat?: ReplyFormatRequest): string {
  if (!replyFormat || replyFormat.format === 'mp3') return url;
  const params = [`reply_format=${replyFormat.format}`];
  if (replyFormat.rate) params.push(`reply_rate=${replyFormat.rate}`);
  return `${url}${url.includes('?') ? '&' : '?'}${params.join('&')}`;
}

type ServerFrame = {
  type?: string;
  session_id?: string;
  reply_format?: string;
  format?: string;
  rate?: number;
  code?: string;
};

const isReplyFormat = (f: unknown): f is ReplyFormat => f === 'mp3' || f === 'pcm16';

const OPEN = 1;

export function openVoiceChannel(
  handlers: VoiceChannelHandlers,
  options: VoiceChannelOptions = {},
): VoiceChannel {
  const create = options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as VoiceSocket);
  const replyGapMs = options.replyGapMs ?? REPLY_GAP_MS;
  let ready = false;
  let closed = false;
  let reply: ArrayBuffer[] = [];
  let replyTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the server said it sends (session frame); older servers say nothing and send MP3. */
  let sessionFormat: ReplyFormat = 'mp3';
  /** The reply being received. Set by reply_start; until then the session's format. */
  let info: ReplyInfo = { format: 'mp3' };
  /** True once the server marks replies (reply_start): reply_end ends them, not the gap timer. */
  let marked = false;

  const requestedRate = options.replyFormat?.rate ?? VOICE_RATE;
  const socket = create(
    options.url
      ? withReplyFormat(options.url, options.replyFormat)
      : voiceSocketUrl(env.wsUrl, lastSessionId, options.replyFormat),
  );
  socket.binaryType = 'arraybuffer';

  const endReply = () => {
    clearTimeout(replyTimer);
    const all = reply;
    const done = info;
    reply = [];
    info = { format: sessionFormat, rate: sessionFormat === 'pcm16' ? requestedRate : undefined };
    handlers.onReplyEnd?.(all, done);
  };

  const onText = (frame: ServerFrame) => {
    switch (frame.type) {
      case 'session':
        if (!frame.session_id) return;
        lastSessionId = frame.session_id;
        clearTimeout(connectTimer);
        if (isReplyFormat(frame.reply_format)) sessionFormat = frame.reply_format;
        info = { format: sessionFormat, rate: sessionFormat === 'pcm16' ? requestedRate : undefined };
        if (!ready) {
          ready = true;
          handlers.onReady?.(frame.session_id);
        }
        return;
      case 'reply_start':
        marked = true;
        if (reply.length) endReply(); // a previous reply that never got its reply_end
        if (isReplyFormat(frame.format))
          info = {
            format: frame.format,
            rate: frame.format === 'pcm16' ? (frame.rate ?? requestedRate) : undefined,
          };
        return;
      case 'reply_end':
        marked = true;
        endReply();
        return;
      case 'error':
        handlers.onServerError?.(frame.code ?? 'unknown');
        return;
      default:
        return;
    }
  };

  const finish = (reason: 'timeout' | 'closed') => {
    if (closed) return;
    closed = true;
    ready = false;
    clearTimeout(connectTimer);
    clearTimeout(replyTimer);
    try {
      socket.close();
    } catch {
      /* already closed */
    }
    handlers.onClose?.(reason);
  };
  const connectTimer = setTimeout(() => !ready && finish('timeout'), options.connectMs ?? CONNECT_MS);

  socket.onmessage = (e) => {
    if (closed) return;
    if (typeof e.data === 'string') {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(e.data) as ServerFrame;
      } catch {
        return; // not JSON: ignore
      }
      onText(frame);
      return;
    }
    if (!(e.data instanceof ArrayBuffer)) return;
    handlers.onReplyChunk?.(e.data, info);
    if (handlers.onReplyEnd) {
      reply.push(e.data);
      clearTimeout(replyTimer);
      // Older servers do not mark the end of a reply: a pause in the chunks stands in for reply_end. Newer ones do,
      // and a much longer pause only guards against a lost reply_end.
      replyTimer = setTimeout(endReply, marked ? REPLY_STALL_MS : replyGapMs);
    }
  };
  socket.onclose = () => finish('closed');

  return {
    isReady: () => ready && !closed && socket.readyState === OPEN,
    send: (pcm) => {
      if (!ready || closed || socket.readyState !== OPEN) return false;
      socket.send(pcm);
      return true;
    },
    close: () => {
      if (closed) return;
      closed = true;
      ready = false;
      clearTimeout(connectTimer);
      clearTimeout(replyTimer);
      socket.onmessage = socket.onclose = null;
      try {
        socket.close();
      } catch {
        /* already closed */
      }
    },
  };
}
