/**
 * IMA ADPCM, 4 bits per sample (4:1 against 16-bit PCM). Cheap enough for any microcontroller and simple to decode
 * in JavaScript, and a 20 ms frame at 16 kHz (164 bytes) fits one BLE notification at MTU 185.
 *
 * Frame layout, shared with the Python simulator (`adpcm` in simulator/codecs.py):
 *   [int16 LE predictor][u8 step index][u8 reserved = 0][nibbles: low nibble = earlier sample]
 * The header is the coder state before the frame's first sample, so every frame decodes on its own
 * (a lost frame does not corrupt the next one). Samples per frame = 2 × (length − 4).
 */
const STEPS = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97,
  107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724,
  796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026,
  4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500,
  20350, 22385, 24623, 27086, 29794, 32767,
];
const INDEX_STEP = [-1, -1, -1, -1, 2, 4, 6, 8];
export const ADPCM_HEADER_BYTES = 4;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** One 4-bit code -> next sample, updating the state in place. */
function step(state: { predictor: number; index: number }, code: number): number {
  const s = STEPS[state.index];
  let diff = s >> 3;
  if (code & 4) diff += s;
  if (code & 2) diff += s >> 1;
  if (code & 1) diff += s >> 2;
  state.predictor = clamp(state.predictor + (code & 8 ? -diff : diff), -32768, 32767);
  state.index = clamp(state.index + INDEX_STEP[code & 7], 0, 88);
  return state.predictor;
}

export function decodeAdpcmFrame(frame: Uint8Array): Int16Array {
  if (frame.length < ADPCM_HEADER_BYTES) throw new Error('adpcm frame too short');
  const raw = frame[0] | (frame[1] << 8);
  const state = { predictor: raw >= 0x8000 ? raw - 0x10000 : raw, index: clamp(frame[2], 0, 88) };
  const out = new Int16Array((frame.length - ADPCM_HEADER_BYTES) * 2);
  for (let i = ADPCM_HEADER_BYTES, o = 0; i < frame.length; i++) {
    out[o++] = step(state, frame[i] & 0x0f);
    out[o++] = step(state, frame[i] >> 4);
  }
  return out;
}

/** PCM -> one frame, starting from (and updating) `state`. An odd last sample is dropped. Used for replies sent to the pendant. */
export function encodeAdpcmFrame(
  pcm: Int16Array,
  state: { predictor: number; index: number } = { predictor: 0, index: 0 },
): Uint8Array {
  const n = pcm.length & ~1;
  const out = new Uint8Array(ADPCM_HEADER_BYTES + n / 2);
  const p = state.predictor & 0xffff;
  out[0] = p & 0xff;
  out[1] = p >> 8;
  out[2] = state.index;
  for (let i = 0; i < n; i++) {
    const s = STEPS[state.index];
    let diff = pcm[i] - state.predictor;
    let code = 0;
    if (diff < 0) {
      code = 8;
      diff = -diff;
    }
    if (diff >= s) {
      code |= 4;
      diff -= s;
    }
    if (diff >= s >> 1) {
      code |= 2;
      diff -= s >> 1;
    }
    if (diff >= s >> 2) code |= 1;
    step(state, code);
    const byte = ADPCM_HEADER_BYTES + (i >> 1);
    out[byte] |= i & 1 ? code << 4 : code;
  }
  return out;
}
