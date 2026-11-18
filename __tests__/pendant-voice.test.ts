import { encodeAdpcmFrame } from '@/services/audio/adpcm';
import { SIMULATED_PENDANT, SimulatorTransport, simulatorTiming } from '@/services/pendant';
import {
  activePendantVoice,
  startPendantVoice,
  type PendantVoiceState,
  type ReplyTarget,
} from '@/services/voice/pendantVoice';
import type { ReplyPlayer } from '@/services/voice/replyPlayer';
import {
  REPLY_STALL_MS,
  openVoiceChannel,
  voiceSocketUrl,
  type VoiceSocket,
} from '@/services/voice/voiceChannel';
import { isVoiceLive, startVoiceSession, type VoiceState } from '@/services/voice/voiceSession';

class FakeSocket implements VoiceSocket {
  binaryType = 'blob';
  readyState = 1;
  sent: ArrayBuffer[] = [];
  closed = false;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  constructor(readonly url: string) {}
  send(d: ArrayBuffer | ArrayBufferView) {
    this.sent.push(d instanceof ArrayBuffer ? d : (d.buffer as ArrayBuffer));
  }
  close() {
    this.closed = true;
  }
  session(id = 's1') {
    this.onmessage?.({ data: JSON.stringify({ type: 'session', session_id: id }) });
  }
  reply(bytes: number[]) {
    this.onmessage?.({ data: Uint8Array.from(bytes).buffer });
  }
  text(frame: object) {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }
}

/** `ms` of 16 kHz PCM as the server's pcm16 reply chunks (a steady tone, so ADPCM has something to encode). */
const pcmReply = (ms: number) => {
  const samples = new Int16Array(16 * ms).map((_, i) => (i % 32 < 16 ? 4000 : -4000));
  // Copied through Uint8Array.from, like reply(): a typed array's own buffer fails `instanceof ArrayBuffer` in Jest.
  return Uint8Array.from(new Uint8Array(samples.buffer)).buffer;
};

const HELLO = {
  type: 'hello',
  codec: 'adpcm',
  rate: 16000,
  channels: 1,
  frame_ms: 20,
  bitrate: 64000,
} as const;
const adpcmFrame = () => encodeAdpcmFrame(new Int16Array(320).fill(1000));

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  activePendantVoice()?.stop();
  jest.useRealTimers();
});

async function setup(options: { replyTo?: ReplyTarget } = {}) {
  Object.assign(simulatorTiming, { connect: 0 });
  const transport = new SimulatorTransport();
  const connected = transport.connect(SIMULATED_PENDANT.id);
  jest.advanceTimersByTime(0);
  await connected;
  const sockets: FakeSocket[] = [];
  const played: ArrayBuffer[][] = [];
  const playedFormats: string[] = [];
  let finishPlay: (() => void) | undefined;
  const player: ReplyPlayer = {
    play: (reply) => {
      played.push(reply.chunks);
      playedFormats.push(reply.format);
      return new Promise((r) => (finishPlay = r));
    },
    stop: () => finishPlay?.(),
  };
  const states: PendantVoiceState[] = [];
  const voice = startPendantVoice({
    transport,
    player,
    replyTo: options.replyTo,
    trailingSilenceMs: 300,
    openChannel: (h, o) =>
      openVoiceChannel(h, {
        ...o,
        url: 'ws://test/api/v1/voice/ws',
        createSocket: (url) => {
          const s = new FakeSocket(url);
          sockets.push(s);
          return s;
        },
      }),
  });
  voice.subscribe({ onState: (s) => states.push(s) });
  const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  return {
    transport,
    voice,
    sockets,
    played,
    playedFormats,
    states,
    flush,
    endPlayback: () => finishPlay?.(),
  };
}

/** HELLO, session, one utterance; leaves the voice thinking, waiting for the reply. */
async function speakOnce(ctx: Awaited<ReturnType<typeof setup>>, sessionFrame: object = {}) {
  ctx.transport.simulateMessage(HELLO);
  ctx.sockets[0].text({ type: 'session', session_id: 's1', ...sessionFrame });
  ctx.transport.simulateMessage({ type: 'wake_detected' });
  ctx.transport.simulateMessage({ type: 'audio', seq: 0, payload: adpcmFrame() });
  ctx.transport.simulateMessage({ type: 'utterance_end', frames: 1 });
  await ctx.flush();
}

describe('voice channel', () => {
  it('builds the socket URL with the last session id', () => {
    expect(voiceSocketUrl('wss://x', undefined)).toBe('wss://x/api/v1/voice/ws');
    expect(voiceSocketUrl('wss://x', 'a b')).toBe('wss://x/api/v1/voice/ws?session_id=a%20b');
  });

  it('is ready only after the session frame, and reports a whole reply after the gap', () => {
    let socket!: FakeSocket;
    const replies: number[] = [];
    const channel = openVoiceChannel(
      { onReplyEnd: (chunks) => replies.push(chunks.length) },
      { url: 'ws://t', createSocket: (u) => (socket = new FakeSocket(u)) },
    );
    expect(socket.binaryType).toBe('arraybuffer');
    expect(channel.send(new ArrayBuffer(2))).toBe(false);
    socket.session();
    expect(channel.send(new ArrayBuffer(2))).toBe(true);
    socket.reply([1]);
    jest.advanceTimersByTime(500);
    socket.reply([2]);
    jest.advanceTimersByTime(999);
    expect(replies).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(replies).toEqual([2]);
  });

  it('gives up when the server never opens a session', () => {
    const onClose = jest.fn();
    openVoiceChannel({ onClose }, { url: 'ws://t', connectMs: 1000, createSocket: (u) => new FakeSocket(u) });
    jest.advanceTimersByTime(1000);
    expect(onClose).toHaveBeenCalledWith('timeout');
  });

  it('asks for a reply format only when it is not the default', () => {
    expect(voiceSocketUrl('wss://x', '', { format: 'mp3' })).toBe('wss://x/api/v1/voice/ws');
    expect(voiceSocketUrl('wss://x', 's', { format: 'pcm16', rate: 16000 })).toBe(
      'wss://x/api/v1/voice/ws?session_id=s&reply_format=pcm16&reply_rate=16000',
    );
    let socket!: FakeSocket;
    openVoiceChannel(
      {},
      { url: 'ws://t', replyFormat: { format: 'pcm16' }, createSocket: (u) => (socket = new FakeSocket(u)) },
    );
    expect(socket.url).toBe('ws://t?reply_format=pcm16');
  });

  it('ends a marked reply on reply_end, in the format the server announced', () => {
    let socket!: FakeSocket;
    const replies: { chunks: number; format: string; rate?: number }[] = [];
    openVoiceChannel(
      { onReplyEnd: (chunks, info) => replies.push({ chunks: chunks.length, ...info }) },
      {
        url: 'ws://t',
        replyFormat: { format: 'pcm16', rate: 16000 },
        createSocket: (u) => (socket = new FakeSocket(u)),
      },
    );
    socket.text({ type: 'session', session_id: 's1', reply_format: 'pcm16' });
    socket.text({ type: 'reply_start', format: 'pcm16', rate: 16000 });
    socket.reply([1, 0]);
    jest.advanceTimersByTime(5000); // no gap timer once replies are marked
    socket.reply([2, 0]);
    expect(replies).toEqual([]);
    socket.text({ type: 'reply_end' });
    expect(replies).toEqual([{ chunks: 2, format: 'pcm16', rate: 16000 }]);
  });

  it('treats replies as MP3 when an older server ignores the requested format', () => {
    let socket!: FakeSocket;
    const formats: string[] = [];
    openVoiceChannel(
      { onReplyEnd: (_c, info) => formats.push(info.format) },
      { url: 'ws://t', replyFormat: { format: 'pcm16' }, createSocket: (u) => (socket = new FakeSocket(u)) },
    );
    socket.session(); // no reply_format in the session frame
    socket.reply([0xff, 0xfb]);
    jest.advanceTimersByTime(1000);
    expect(formats).toEqual(['mp3']);
  });

  it('ends a marked reply whose reply_end was lost, and reports server errors', () => {
    let socket!: FakeSocket;
    const onReplyEnd = jest.fn();
    const onServerError = jest.fn();
    openVoiceChannel(
      { onReplyEnd, onServerError },
      { url: 'ws://t', createSocket: (u) => (socket = new FakeSocket(u)) },
    );
    socket.text({ type: 'session', session_id: 's1', reply_format: 'mp3' });
    socket.text({ type: 'reply_start', format: 'mp3' });
    socket.reply([1]);
    jest.advanceTimersByTime(REPLY_STALL_MS);
    expect(onReplyEnd).toHaveBeenCalledTimes(1);
    socket.text({ type: 'error', code: 'unsupported_reply_format' });
    expect(onServerError).toHaveBeenCalledWith('unsupported_reply_format');
  });
});

describe('pendant voice, reply on the pendant', () => {
  it('asks the server for PCM and sends the reply to the pendant as numbered ADPCM frames', async () => {
    const ctx = await setup({ replyTo: 'pendant' });
    await speakOnce(ctx, { reply_format: 'pcm16' });
    expect(ctx.sockets[0].url).toContain('reply_format=pcm16');

    ctx.sockets[0].text({ type: 'reply_start', format: 'pcm16', rate: 16000 });
    ctx.sockets[0].onmessage?.({ data: pcmReply(100) }); // 100 ms = five 20 ms frames
    ctx.sockets[0].text({ type: 'reply_end' });
    await jest.advanceTimersByTimeAsync(500);

    const audio = ctx.transport.sent.filter((m) => m.type === 'audio');
    expect(audio.map((m) => m.type === 'audio' && m.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(audio.every((m) => m.type === 'audio' && m.payload.length === 164)).toBe(true); // 4 + 320 / 2
    expect(ctx.transport.sent.at(-1)).toEqual({ type: 'playback_end' });
    expect(ctx.voice.getStats().framesOut).toBe(5);
    expect(ctx.played).toHaveLength(0); // not on the phone
  });

  it('plays the reply on the phone when the server only sends MP3', async () => {
    const ctx = await setup({ replyTo: 'pendant' });
    await speakOnce(ctx); // older server: no reply_format in the session frame
    ctx.sockets[0].reply([0xff, 0xfb]);
    jest.advanceTimersByTime(1000);
    expect(ctx.playedFormats).toEqual(['mp3']);
    expect(ctx.transport.sent.some((m) => m.type === 'audio')).toBe(false);
  });

  it('stops sending when the pendant interrupts', async () => {
    const ctx = await setup({ replyTo: 'pendant' });
    await speakOnce(ctx, { reply_format: 'pcm16' });
    ctx.sockets[0].text({ type: 'reply_start', format: 'pcm16', rate: 16000 });
    ctx.sockets[0].onmessage?.({ data: pcmReply(2000) }); // 100 frames
    ctx.sockets[0].text({ type: 'reply_end' });
    await jest.advanceTimersByTimeAsync(100);
    ctx.transport.simulateMessage({ type: 'playback_interrupt' });
    const sentAtInterrupt = ctx.voice.getStats().framesOut;
    await jest.advanceTimersByTimeAsync(2000);
    expect(sentAtInterrupt).toBeLessThan(100);
    expect(ctx.voice.getStats().framesOut).toBe(sentAtInterrupt);
  });

  it('keeps the phone as the default', async () => {
    const ctx = await setup();
    await speakOnce(ctx);
    expect(ctx.sockets[0].url).not.toContain('reply_format');
  });
});

describe('pendant voice', () => {
  it('accepts a format it can decode, acks the pendant and warms up the socket', async () => {
    const { transport, sockets, states, flush } = await setup();
    transport.simulateMessage(HELLO);
    await flush();
    expect(transport.sent).toEqual([{ type: 'hello_ack' }]);
    expect(sockets).toHaveLength(1);
    expect(states).toEqual(['ready']);
  });

  it('refuses a format it cannot decode', async () => {
    const { transport, sockets, states, flush } = await setup();
    transport.simulateMessage({ ...HELLO, codec: 'opus' });
    await flush();
    expect(transport.sent).toEqual([{ type: 'error', message: 'codec opus unsupported' }]);
    expect(sockets).toHaveLength(0);
    expect(states).toEqual(['unsupported']);
  });

  it('streams one utterance as 100 ms PCM chunks, plays the reply, then frees the pendant', async () => {
    const { transport, voice, sockets, played, states, flush, endPlayback } = await setup();
    transport.simulateMessage(HELLO);
    sockets[0].session();
    transport.simulateMessage({ type: 'wake_detected' });
    for (let i = 0; i < 10; i++) transport.simulateMessage({ type: 'audio', seq: i, payload: adpcmFrame() });
    transport.simulateMessage({ type: 'utterance_end', frames: 10 });

    // 10 × 20 ms = two 100 ms chunks of 3200 bytes, then 300 ms of silence = three more.
    expect(sockets[0].sent.map((b) => b.byteLength)).toEqual([3200, 3200, 3200, 3200, 3200]);
    const tail = new Int16Array(sockets[0].sent[4]);
    expect(tail.every((v) => v === 0)).toBe(true);
    expect(voice.getStats()).toMatchObject({ framesIn: 10, chunksSent: 5, dropped: 0 });

    sockets[0].reply([0xff, 0xfb]);
    jest.advanceTimersByTime(1000);
    expect(played).toHaveLength(1);
    endPlayback();
    await flush();
    expect(transport.sent.at(-1)).toEqual({ type: 'playback_end' });
    expect(states).toEqual(['ready', 'hearing', 'thinking', 'speaking', 'ready']);
  });

  it('keeps audio while the server wakes up and sends it once the session opens', async () => {
    const { transport, sockets } = await setup();
    transport.simulateMessage(HELLO);
    for (let i = 0; i < 5; i++) transport.simulateMessage({ type: 'audio', seq: i, payload: adpcmFrame() });
    expect(sockets[0].sent).toHaveLength(0);
    sockets[0].session();
    expect(sockets[0].sent).toHaveLength(1);
  });

  it('frees the pendant when no reply comes', async () => {
    const { transport, sockets, flush } = await setup();
    transport.simulateMessage(HELLO);
    sockets[0].session();
    transport.simulateMessage({ type: 'audio', seq: 0, payload: adpcmFrame() });
    transport.simulateMessage({ type: 'utterance_end', frames: 1 });
    jest.advanceTimersByTime(20_000);
    await flush();
    expect(transport.sent.at(-1)).toEqual({ type: 'playback_end' });
  });

  it('reopens the socket for the next utterance after it closed', async () => {
    const { transport, sockets } = await setup();
    transport.simulateMessage(HELLO);
    sockets[0].session();
    sockets[0].onclose?.({});
    transport.simulateMessage({ type: 'wake_detected' });
    expect(sockets).toHaveLength(2);
  });

  it('drops audio while muted, and resets when the pendant disconnects', async () => {
    const { transport, voice, sockets, states } = await setup();
    transport.simulateMessage(HELLO);
    sockets[0].session();
    voice.setMuted(true);
    transport.simulateMessage({ type: 'audio', seq: 0, payload: adpcmFrame() });
    expect(voice.getStats().dropped).toBe(1);
    voice.setMuted(false);
    await transport.disconnect();
    expect(sockets[0].closed).toBe(true);
    expect(states.at(-1)).toBe('waiting');
  });

  it('drives the voice view on phones while it runs', async () => {
    const { transport, sockets } = await setup();
    expect(isVoiceLive()).toBe(true);
    const seen: VoiceState[] = [];
    const call = startVoiceSession([], { onState: (s) => seen.push(s), onTurn: jest.fn() });
    transport.simulateMessage(HELLO);
    sockets[0].session();
    transport.simulateMessage({ type: 'wake_detected' });
    call.stop();
    expect(seen).toEqual(['connecting', 'listening', 'hearing']);
  });
});
