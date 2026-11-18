import { decodeAdpcmFrame } from '@/services/audio/adpcm';
import { canEncode, createEncoder, encoderNames } from '@/services/audio/codecs';
import { wavFromPcm } from '@/services/audio/wav';
import type { PendantMessage } from '@/services/pendant';
import { createPendantReplyPlayer } from '@/services/voice/pendantReplyPlayer';
import type { ReplyPlayer } from '@/services/voice/replyPlayer';

const FORMAT = { codec: 'adpcm', rate: 16000, channels: 1, frameMs: 20 };
const tone = (samples: number) => new Int16Array(samples).map((_, i) => Math.round(8000 * Math.sin(i / 8)));

describe('reply encoders', () => {
  it('has the codecs the pendant decodes', () => {
    expect(encoderNames()).toEqual(['adpcm', 'pcm16']);
    expect(canEncode('opus')).toBe(false);
  });

  it('adpcm frames decode back close to the original, and alone', () => {
    const encoder = createEncoder(FORMAT);
    const a = tone(320);
    const b = tone(640).subarray(320);
    encoder.encode(a);
    const frame = encoder.encode(b); // carries the state from frame a in its header
    const back = decodeAdpcmFrame(frame);
    expect(back).toHaveLength(320);
    const worst = Math.max(...Array.from(back, (v, i) => Math.abs(v - b[i])));
    expect(worst).toBeLessThan(1500);
  });

  it('pcm16 frames are the little-endian samples', () => {
    expect(Array.from(createEncoder({ ...FORMAT, codec: 'pcm16' }).encode(Int16Array.from([1, -2])))).toEqual(
      [1, 0, 0xfe, 0xff],
    );
  });
});

describe('wavFromPcm', () => {
  it('wraps PCM in a 44-byte WAV header', () => {
    const wav = wavFromPcm([new Int16Array([1, 2]).buffer, new Int16Array([3]).buffer], 16000);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(wav).toHaveLength(50);
  });
});

describe('pendant reply player', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** `null` = the pendant has not sent its hello yet. */
  function make(pendantFormat: typeof FORMAT | null = FORMAT) {
    const format = pendantFormat ?? undefined;
    const sent: PendantMessage[] = [];
    const fallbackPlayed: string[] = [];
    const fallback: ReplyPlayer = {
      play: async (r) => void fallbackPlayed.push(r.format),
      stop: () => undefined,
    };
    const reasons: string[] = [];
    const player = createPendantReplyPlayer({
      send: async (m) => void sent.push(m),
      format: () => format,
      fallback,
      onFallback: (r) => reasons.push(r),
    });
    return { player, sent, fallbackPlayed, reasons };
  }
  const reply = (ms: number, rate = 16000) => ({
    format: 'pcm16' as const,
    rate,
    chunks: [tone((rate * ms) / 1000).buffer],
  });

  it('asks the server for 16 kHz PCM', () => {
    expect(make().player.wants).toEqual({ format: 'pcm16', rate: 16000 });
  });

  it('sends about real time, a little ahead, and resolves after the last frame has had time to play', async () => {
    const { player, sent } = make();
    let done = false;
    void player.play(reply(1000)).then(() => (done = true)); // 50 frames
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(11); // 200 ms lead + the current frame
    await jest.advanceTimersByTimeAsync(400);
    expect(sent.length).toBeGreaterThanOrEqual(30);
    expect(sent.length).toBeLessThanOrEqual(32);
    await jest.advanceTimersByTimeAsync(400); // t = 800: the last frame went out at 780 (200 ms ahead)
    expect(sent).toHaveLength(50);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(200); // t = 1000: the pendant has played it
    expect(done).toBe(true);
    expect(sent.map((m) => m.type === 'audio' && m.seq)).toEqual([...Array(50).keys()]);
  });

  it('resamples to the pendant rate and pads the last frame', async () => {
    const { player, sent } = make({ ...FORMAT, rate: 8000 });
    void player.play(reply(50)); // 800 samples at 16 kHz -> 400 at 8 kHz -> 160 per frame -> 3 frames
    await jest.advanceTimersByTimeAsync(0);
    expect(sent).toHaveLength(3);
    expect(sent.every((m) => m.type === 'audio' && m.payload.length === 4 + 80)).toBe(true);
  });

  it('hands MP3, unknown codecs and a missing format to the phone', async () => {
    const mp3 = make();
    await mp3.player.play({ format: 'mp3', chunks: [new ArrayBuffer(4)] });
    expect(mp3.fallbackPlayed).toEqual(['mp3']);
    expect(mp3.reasons[0]).toContain('mp3');

    const opus = make({ ...FORMAT, codec: 'opus' });
    await opus.player.play(reply(20));
    expect(opus.fallbackPlayed).toEqual(['pcm16']);

    const none = make(null);
    await none.player.play(reply(20));
    expect(none.fallbackPlayed).toEqual(['pcm16']);
    expect(none.sent).toHaveLength(0);
  });

  it('stop() ends the reply at once', async () => {
    const { player, sent } = make();
    let done = false;
    void player.play(reply(1000)).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(0);
    player.stop();
    await jest.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
    const count = sent.length;
    await jest.advanceTimersByTimeAsync(2000);
    expect(sent).toHaveLength(count);
  });
});
