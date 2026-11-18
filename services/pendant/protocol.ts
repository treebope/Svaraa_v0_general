/**
 * BLE wire contract between the pendant (the Python simulator now, firmware later) and this app.
 * It mirrors device-simulator/simulator/transports/ble_protocol.py byte for byte: change both together.
 * Full description: docs/pendant-ble-protocol.md.
 *
 * GATT (custom 128-bit UUIDs):
 *   AUDIO_TX  pendant -> phone  notify                    [2B seq BE][encoded frame]
 *   AUDIO_RX  phone -> pendant  write without response    [2B seq BE][encoded frame]
 *   CONTROL   both ways         write + notify            [1B opcode][fields...]
 *
 * Control messages are turned into the same objects the backend speaks as JSON ({ type: 'hello', ... }),
 * so the relay only forwards them. The codec is named in the pendant's hello: the app never decodes audio.
 */
import { decodeUtf8, encodeUtf8 } from './bytes';

export const SERVICE_UUID = '96b07100-79ac-407f-88a5-23fae7871e06';
export const AUDIO_TX_UUID = '96b07101-79ac-407f-88a5-23fae7871e06';
export const AUDIO_RX_UUID = '96b07102-79ac-407f-88a5-23fae7871e06';
export const CONTROL_UUID = '96b07103-79ac-407f-88a5-23fae7871e06';

/** Notification payload = ATT MTU - 3. */
export const ATT_HEADER_BYTES = 3;
/** ATT MTU 23, the BLE minimum: every control packet fits in it. */
export const MAX_CONTROL_BYTES = 20;

/** Stable ids for the hello codec field. Append only; never renumber. Same table as CODEC_IDS in Python. */
export const CODEC_IDS: Record<string, number> = { pcm16: 0, opus: 1, adpcm: 2, lc3: 3 };
const CODEC_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(CODEC_IDS).map(([name, id]) => [id, name]),
);

export const Op = {
  HELLO: 0x01,
  WAKE_DETECTED: 0x02,
  UTTERANCE_END: 0x03,
  PLAYBACK_INTERRUPT: 0x04,
  LINK_READY: 0x80,
  HELLO_ACK: 0x81,
  PLAYBACK_END: 0x82,
  ERROR: 0x83,
} as const;

/** The pendant's audio format, sent once per link. Field names match the backend's JSON hello. */
export type HelloMessage = {
  type: 'hello';
  codec: string;
  rate: number;
  channels: number;
  frame_ms: number;
  bitrate: number;
};

export type ControlMessage =
  // pendant -> phone
  | HelloMessage
  | { type: 'wake_detected' }
  | { type: 'utterance_end'; frames: number }
  | { type: 'playback_interrupt' }
  // phone -> pendant
  | { type: 'link_ready'; mtu: number }
  | { type: 'hello_ack' }
  | { type: 'playback_end' }
  | { type: 'error'; message: string };

/** One encoded audio frame, either direction. */
export type AudioPacket = { type: 'audio'; seq: number; payload: Uint8Array };

export type PendantMessage = ControlMessage | AudioPacket;

const BARE: Partial<Record<ControlMessage['type'], number>> = {
  wake_detected: Op.WAKE_DETECTED,
  playback_interrupt: Op.PLAYBACK_INTERRUPT,
  hello_ack: Op.HELLO_ACK,
  playback_end: Op.PLAYBACK_END,
};
const BARE_BY_OP = new Map(Object.entries(BARE).map(([type, op]) => [op, type]));

const u16 = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const readU16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];

/** Control object -> compact BLE packet. Throws for messages that have no BLE form. */
export function encodeControl(msg: ControlMessage): Uint8Array {
  const bare = BARE[msg.type];
  if (bare !== undefined) return Uint8Array.of(bare);
  switch (msg.type) {
    case 'hello': {
      const id = CODEC_IDS[msg.codec];
      if (id === undefined) throw new Error(`codec ${msg.codec} has no BLE id; add it to CODEC_IDS`);
      return Uint8Array.of(
        Op.HELLO,
        id,
        ...u16(msg.rate),
        msg.channels,
        msg.frame_ms,
        ...u16(Math.floor(msg.bitrate / 100)),
      );
    }
    case 'utterance_end':
      return Uint8Array.of(Op.UTTERANCE_END, ...u16(Math.min(Math.max(0, msg.frames), 0xffff)));
    case 'link_ready':
      return Uint8Array.of(Op.LINK_READY, ...u16(msg.mtu));
    case 'error': {
      const text = truncateUtf8(encodeUtf8(msg.message), MAX_CONTROL_BYTES - 1);
      return Uint8Array.of(Op.ERROR, ...text);
    }
    default:
      throw new Error(`control message ${msg.type} has no BLE encoding`);
  }
}

/** BLE control packet -> control object. Throws for malformed packets. */
export function decodeControl(data: Uint8Array): ControlMessage {
  if (data.length === 0) throw new Error('empty control packet');
  const op = data[0];
  const body = data.subarray(1);
  const expect = (size: number, what: string) => {
    if (body.length !== size) throw new Error(`${what}: expected ${size} payload bytes, got ${body.length}`);
  };
  const bare = BARE_BY_OP.get(op);
  if (bare) {
    expect(0, bare);
    return { type: bare } as ControlMessage;
  }
  switch (op) {
    case Op.HELLO: {
      expect(7, 'hello');
      const codec = CODEC_NAMES[body[0]];
      if (!codec) throw new Error(`hello: unknown codec id ${body[0]}`);
      return {
        type: 'hello',
        codec,
        rate: readU16(body, 1),
        channels: body[3],
        frame_ms: body[4],
        bitrate: readU16(body, 5) * 100,
      };
    }
    case Op.UTTERANCE_END:
      expect(2, 'utterance_end');
      return { type: 'utterance_end', frames: readU16(body, 0) };
    case Op.LINK_READY:
      expect(2, 'link_ready');
      return { type: 'link_ready', mtu: readU16(body, 0) };
    case Op.ERROR:
      return { type: 'error', message: decodeUtf8(body) };
    default:
      throw new Error(`unknown control opcode 0x${op.toString(16)}`);
  }
}

/** [2B seq BE][frame]. */
export function packAudio(seq: number, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(2 + payload.length);
  out.set(u16(seq & 0xffff), 0);
  out.set(payload, 2);
  return out;
}

export function unpackAudio(data: Uint8Array): AudioPacket {
  if (data.length < 3) throw new Error('audio packet too short');
  return { type: 'audio', seq: readU16(data, 0), payload: data.slice(2) };
}

/** Cut UTF-8 bytes to `max` without leaving half a character at the end. */
function truncateUtf8(bytes: Uint8Array, max: number): Uint8Array {
  if (bytes.length <= max) return bytes;
  let end = max;
  // Step back over continuation bytes (10xxxxxx) to the start of the last character, and drop it if incomplete.
  let start = end - 1;
  while (start > 0 && (bytes[start] & 0xc0) === 0x80) start--;
  const lead = bytes[start];
  const need = lead >= 0xf0 ? 4 : lead >= 0xe0 ? 3 : lead >= 0xc0 ? 2 : 1;
  if (start + need > end) end = start;
  return bytes.slice(0, end);
}
