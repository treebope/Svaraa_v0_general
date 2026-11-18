import { base64ToBytes, bytesToBase64, decodeUtf8, encodeUtf8 } from '@/services/pendant/bytes';
import {
  CODEC_IDS,
  MAX_CONTROL_BYTES,
  decodeControl,
  encodeControl,
  packAudio,
  unpackAudio,
  type HelloMessage,
} from '@/services/pendant/protocol';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const HELLO: HelloMessage = {
  type: 'hello',
  codec: 'opus',
  rate: 16000,
  channels: 1,
  frame_ms: 20,
  bitrate: 24000,
};

describe('BLE control packets (same bytes as the Python simulator)', () => {
  it('encodes like ble_protocol.py', () => {
    expect(hex(encodeControl(HELLO))).toBe('01013e80011400f0');
    expect(hex(encodeControl({ type: 'link_ready', mtu: 185 }))).toBe('8000b9');
    expect(hex(encodeControl({ type: 'utterance_end', frames: 203 }))).toBe('0300cb');
    expect(hex(encodeControl({ type: 'hello_ack' }))).toBe('81');
    expect(hex(encodeControl({ type: 'playback_end' }))).toBe('82');
  });

  it('decodes what it encodes', () => {
    for (const m of [
      HELLO,
      { type: 'wake_detected' } as const,
      { type: 'utterance_end', frames: 65535 } as const,
      { type: 'playback_interrupt' } as const,
      { type: 'hello_ack' } as const,
      { type: 'error', message: 'oops' } as const,
    ])
      expect(decodeControl(encodeControl(m))).toEqual(m);
  });

  it('keeps error text inside 20 bytes without splitting a character', () => {
    const packet = encodeControl({ type: 'error', message: 'é'.repeat(30) });
    expect(packet.length).toBeLessThanOrEqual(MAX_CONTROL_BYTES);
    expect(decodeControl(packet)).toEqual({ type: 'error', message: 'é'.repeat(9) });
  });

  it.each([[[]], [[0x7f]], [[0x01, 0x01]], [[0x82, 0x00]], [[0x80, 0x00]], [[0x01, 99, 0, 0, 0, 0, 0, 0]]])(
    'rejects malformed packet %j',
    (bytes) => expect(() => decodeControl(Uint8Array.from(bytes))).toThrow(),
  );

  it('refuses a codec with no id, and keeps the ids stable', () => {
    expect(() => encodeControl({ ...HELLO, codec: 'nope' })).toThrow(/CODEC_IDS/);
    expect(CODEC_IDS).toEqual({ pcm16: 0, opus: 1, adpcm: 2, lc3: 3 });
  });
});

describe('BLE audio packets', () => {
  it('are [2B seq BE][frame] and wrap at 16 bits', () => {
    const p = packAudio(258, Uint8Array.of(9, 8));
    expect(hex(p)).toBe('01020908');
    expect(unpackAudio(p)).toEqual({ type: 'audio', seq: 258, payload: Uint8Array.of(9, 8) });
    expect(unpackAudio(packAudio(65537, Uint8Array.of(1))).seq).toBe(1);
    expect(() => unpackAudio(Uint8Array.of(0, 1))).toThrow();
  });
});

describe('byte helpers', () => {
  it('round-trips base64 of every length', () => {
    for (let n = 0; n < 10; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 200) & 0xff);
      expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    }
    expect(bytesToBase64(Uint8Array.of(0x01, 0x01, 0x3e))).toBe('AQE+');
  });

  it('round-trips UTF-8 including Hindi', () => {
    const s = 'नमस्ते hi é 😀';
    expect(decodeUtf8(encodeUtf8(s))).toBe(s);
  });
});
