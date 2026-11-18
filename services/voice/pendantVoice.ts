import { Chunker, pcmBytes, resample, toMono } from '@/services/audio/pcm';
import {
  canDecode,
  canEncode,
  createDecoder,
  decoderNames,
  encoderNames,
  type AudioDecoder,
  type AudioFormat,
} from '@/services/audio/codecs';
import type { HelloMessage, PendantMessage, PendantTransport } from '@/services/pendant';
import { createPendantReplyPlayer } from './pendantReplyPlayer';
import { createReplyPlayer, type ReplyAudio, type ReplyFormatRequest, type ReplyPlayer } from './replyPlayer';
import {
  VOICE_CHUNK_MS,
  VOICE_RATE,
  openVoiceChannel,
  type VoiceChannel,
  type VoiceChannelHandlers,
} from './voiceChannel';

/**
 * Talking to Svaraa through the pendant. The pendant (or the Python simulator) streams encoded audio over Bluetooth;
 * this turns it into what the voice socket expects and plays the reply on the phone:
 *
 *   pendant hello (format)  -> pick a decoder (services/audio/codecs.ts); HELLO_ACK if we can decode it, else ERROR
 *   wake                    -> open the voice socket if it is not open (it stays open between utterances)
 *   audio frames            -> decode -> mono -> 16 kHz -> 100 ms chunks of 16-bit PCM -> voice socket
 *   utterance end           -> send a little silence, so the server's ~1 s end-of-speech check fires at once
 *   reply                   -> collected until reply_end (or ~1 s without a chunk, older servers), then played:
 *                                replyTo 'phone'   = MP3 on the phone's speaker (default)
 *                                replyTo 'pendant' = PCM from the server, re-encoded and sent to the pendant
 *                              -> PLAYBACK_END
 *
 * Each step can be swapped: a new codec = registerDecoder() / registerEncoder(); a different backend = pass
 * `openChannel`; a different speaker = pass `player` (it says which reply format it wants from the server).
 */

export type PendantVoiceState =
  /** No pendant format yet (not connected, or waiting for its hello). */
  | 'waiting'
  /** Pendant accepted; waiting for it to hear the wake word. */
  | 'ready'
  /** The pendant is sending speech. */
  | 'hearing'
  /** Speech ended; waiting for the reply. */
  | 'thinking'
  /** Playing the reply. */
  | 'speaking'
  /** Audio is ignored (muted from the voice view). */
  | 'muted'
  /** The pendant's format cannot be decoded here. */
  | 'unsupported';

export type PendantVoiceStats = {
  framesIn: number;
  chunksSent: number;
  dropped: number;
  replies: number;
  /** Reply frames written to the pendant (replyTo 'pendant'). */
  framesOut: number;
};

/** Where Svaraa's reply is heard. */
export type ReplyTarget = 'phone' | 'pendant';

export type PendantVoiceListener = {
  onState?: (state: PendantVoiceState) => void;
  onLog?: (line: string) => void;
  onError?: (message: string) => void;
  /** At most every 250 ms. */
  onStats?: (stats: PendantVoiceStats) => void;
};

export type PendantVoiceOptions = {
  transport: PendantTransport;
  /** The backend. Default: Svaraa's voice socket (voiceChannel.ts), asking for the reply format the player wants. */
  openChannel?: (
    handlers: VoiceChannelHandlers,
    options: { replyFormat?: ReplyFormatRequest },
  ) => VoiceChannel;
  /** Where the reply is heard. Default 'phone'. 'pendant' falls back to the phone for replies it cannot take. */
  replyTo?: ReplyTarget;
  /** The phone-side player (the speaker). Default: the phone's speaker. */
  player?: ReplyPlayer;
  /** Silence sent after the pendant's utterance end (the server needs ~1 s to decide the person stopped). */
  trailingSilenceMs?: number;
  /** No reply this long after speech: give up and tell the pendant playback ended. */
  noReplyMs?: number;
  /** Audio kept while the socket opens (Render can take up to a minute to wake). Oldest dropped. */
  maxQueueChunks?: number;
};

export type PendantVoice = {
  getState(): PendantVoiceState;
  getStats(): PendantVoiceStats;
  getFormat(): AudioFormat | undefined;
  subscribe(listener: PendantVoiceListener): () => void;
  setMuted(muted: boolean): void;
  stop(): void;
};

let active: PendantVoice | undefined;
/** The running pendant voice, if any (the voice view uses it on phones). */
export const activePendantVoice = () => active;

export function startPendantVoice(options: PendantVoiceOptions): PendantVoice {
  const { transport } = options;
  const openChannel =
    options.openChannel ??
    ((h: VoiceChannelHandlers, o: { replyFormat?: ReplyFormatRequest }) => openVoiceChannel(h, o));
  const phonePlayer = options.player ?? createReplyPlayer();
  const replyTo: ReplyTarget = options.replyTo ?? 'phone';
  const trailingSilenceMs = options.trailingSilenceMs ?? 1200;
  const noReplyMs = options.noReplyMs ?? 20_000;
  const maxQueue = options.maxQueueChunks ?? 600;

  const listeners = new Set<PendantVoiceListener>();
  const stats: PendantVoiceStats = { framesIn: 0, chunksSent: 0, dropped: 0, replies: 0, framesOut: 0 };
  let state: PendantVoiceState = 'waiting';
  let format: AudioFormat | undefined;
  let decoder: AudioDecoder | undefined;
  let channel: VoiceChannel | undefined;
  let queue: ArrayBuffer[] = [];
  let muted = false;
  let stopped = false;
  let noReplyTimer: ReturnType<typeof setTimeout> | undefined;
  let lastStats = 0;
  /** Counts utterances, so a reply that finishes after the next utterance started does not end that one. */
  let turn = 0;

  const each = (fn: (l: PendantVoiceListener) => void) => listeners.forEach(fn);
  const log = (line: string) => each((l) => l.onLog?.(line));
  const error = (message: string) => {
    log(`error: ${message}`);
    each((l) => l.onError?.(message));
  };
  const setState = (next: PendantVoiceState) => {
    if (next === state || stopped) return;
    state = next;
    each((l) => l.onState?.(next));
  };
  const reportStats = (force = false) => {
    const now = Date.now();
    if (!force && now - lastStats < 250) return;
    lastStats = now;
    each((l) => l.onStats?.({ ...stats }));
  };
  const toPendant = (m: PendantMessage) =>
    Promise.resolve()
      .then(() => transport.send(m))
      .catch((e: unknown) => error(`pendant write failed: ${e instanceof Error ? e.message : String(e)}`));

  const player: ReplyPlayer =
    replyTo === 'pendant'
      ? createPendantReplyPlayer({
          send: toPendant,
          format: () => format,
          fallback: phonePlayer,
          onFrame: () => {
            stats.framesOut++;
            reportStats();
          },
          onFallback: (reason) => log(`reply on the phone: ${reason}`),
        })
      : phonePlayer;

  // ------------------------------------------------------------------ backend side

  const flushQueue = () => {
    if (!channel?.isReady()) return;
    const pending = queue;
    queue = [];
    for (const chunk of pending) if (channel.send(chunk)) stats.chunksSent++;
    if (pending.length) log(`voice socket: sent ${pending.length} queued chunks`);
  };

  const ensureChannel = () => {
    if (channel || stopped) return;
    log(`voice socket: connecting (reply ${player.wants?.format ?? 'mp3'})`);
    const c = openChannel(
      {
        onReady: (sessionId) => {
          if (channel !== c) return;
          log(`voice socket: session ${sessionId}`);
          flushQueue();
        },
        onReplyChunk: () => {
          clearTimeout(noReplyTimer);
        },
        onReplyEnd: (chunks, info) => {
          if (channel !== c) return;
          void playReply({ format: info.format, rate: info.rate, chunks });
        },
        onServerError: (code) => {
          if (channel !== c) return;
          error(`voice socket refused: ${code}`);
        },
        onClose: (reason) => {
          if (channel !== c) return;
          channel = undefined;
          log(`voice socket: ${reason === 'timeout' ? 'no answer from the server' : 'closed'}`);
          if (state === 'thinking') endTurn();
        },
      },
      { replyFormat: player.wants },
    );
    channel = c;
  };

  const sendChunk = (pcm: Int16Array) => {
    const bytes = pcmBytes(pcm);
    if (channel?.isReady() && channel.send(bytes)) {
      stats.chunksSent++;
      return;
    }
    queue.push(bytes);
    if (queue.length > maxQueue) {
      queue.shift();
      stats.dropped++;
    }
    ensureChannel();
  };

  const chunker = new Chunker((VOICE_RATE * VOICE_CHUNK_MS) / 1000, sendChunk);

  const playReply = async (reply: ReplyAudio) => {
    clearTimeout(noReplyTimer);
    stats.replies++;
    reportStats(true);
    const bytes = reply.chunks.reduce((n, c) => n + c.byteLength, 0);
    log(
      `reply: ${reply.format}, ${reply.chunks.length} chunks, ${Math.round(bytes / 1024)} KB, to ${replyTo}`,
    );
    const thisTurn = turn;
    if (!muted) {
      setState('speaking');
      await player.play(reply);
    }
    if (turn === thisTurn) endTurn();
  };

  /** The turn is over (reply played, or none came): free the pendant to listen again. */
  const endTurn = () => {
    clearTimeout(noReplyTimer);
    if (stopped) return;
    if (format) void toPendant({ type: 'playback_end' });
    setState(muted ? 'muted' : format ? 'ready' : 'waiting');
  };

  // ------------------------------------------------------------------ pendant side

  const onHello = (hello: HelloMessage) => {
    const next: AudioFormat = {
      codec: hello.codec,
      rate: hello.rate,
      channels: hello.channels,
      frameMs: hello.frame_ms,
    };
    log(`pendant: ${next.codec}, ${next.rate} Hz, ${next.channels} ch, ${next.frameMs} ms frames`);
    if (!canDecode(next.codec)) {
      format = undefined;
      decoder = undefined;
      error(`cannot decode ${next.codec} on this phone (can: ${decoderNames().join(', ')})`);
      void toPendant({ type: 'error', message: `codec ${next.codec} unsupported` });
      setState('unsupported');
      return;
    }
    format = next;
    decoder = createDecoder(next);
    if (replyTo === 'pendant' && !canEncode(next.codec))
      log(`replies will play on the phone: no encoder for ${next.codec} (can: ${encoderNames().join(', ')})`);
    void toPendant({ type: 'hello_ack' });
    setState(muted ? 'muted' : 'ready');
    ensureChannel(); // warm up: the server may need a while to wake
  };

  const startUtterance = () => {
    turn++;
    decoder?.reset();
    chunker.clear();
    clearTimeout(noReplyTimer);
    player.stop();
    setState('hearing');
    ensureChannel();
  };

  const onAudio = (payload: Uint8Array) => {
    stats.framesIn++;
    if (muted || !decoder || !format) {
      stats.dropped++;
      return;
    }
    if (state !== 'hearing') startUtterance();
    try {
      const pcm = resample(toMono(decoder.decode(payload), format.channels), format.rate, VOICE_RATE);
      chunker.push(pcm);
    } catch (e) {
      stats.dropped++;
      log(`bad frame: ${e instanceof Error ? e.message : String(e)}`);
    }
    reportStats();
  };

  const onUtteranceEnd = (frames: number) => {
    if (state !== 'hearing') return;
    log(`pendant: utterance end (${frames} frames)`);
    chunker.flush();
    const silence = new Int16Array((VOICE_RATE * VOICE_CHUNK_MS) / 1000);
    for (let ms = 0; ms < trailingSilenceMs; ms += VOICE_CHUNK_MS) sendChunk(silence);
    setState('thinking');
    reportStats(true);
    noReplyTimer = setTimeout(() => {
      log('no reply from the server');
      endTurn();
    }, noReplyMs);
  };

  const onMessage = (m: PendantMessage) => {
    if (stopped) return;
    switch (m.type) {
      case 'hello':
        return onHello(m);
      case 'wake_detected':
        log('pendant: wake');
        if (!muted && format) startUtterance();
        return;
      case 'audio':
        return onAudio(m.payload);
      case 'utterance_end':
        return onUtteranceEnd(m.frames);
      case 'playback_interrupt':
        log('pendant: interrupt');
        player.stop();
        return;
      case 'error':
        return error(`pendant: ${m.message}`);
      default:
        return;
    }
  };

  const reset = () => {
    clearTimeout(noReplyTimer);
    channel?.close();
    channel = undefined;
    queue = [];
    format = undefined;
    decoder = undefined;
    chunker.clear();
    player.stop();
    setState(muted ? 'muted' : 'waiting');
  };

  const offMessage = transport.onMessage(onMessage);
  const offStatus = transport.onStatus((s) => {
    if (s.connection !== 'connected' && format) {
      log('pendant: disconnected');
      reset();
    }
  });

  const voice: PendantVoice = {
    getState: () => state,
    getStats: () => ({ ...stats }),
    getFormat: () => format,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    setMuted: (value) => {
      if (value === muted) return;
      muted = value;
      if (value) {
        chunker.clear();
        player.stop();
        setState('muted');
      } else setState(format ? 'ready' : 'waiting');
    },
    stop: () => {
      reset();
      stopped = true;
      offMessage();
      offStatus();
      listeners.clear();
      if (active === voice) active = undefined;
    },
  };
  active = voice;
  return voice;
}
