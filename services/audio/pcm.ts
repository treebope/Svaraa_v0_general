/** 16-bit PCM helpers. Everything here works on Int16Array samples, little-endian on the wire. */

/** Interleaved multi-channel -> mono (average). */
export function toMono(pcm: Int16Array, channels: number): Int16Array {
  if (channels <= 1) return pcm;
  const out = new Int16Array(Math.floor(pcm.length / channels));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += pcm[i * channels + c];
    out[i] = Math.round(sum / channels);
  }
  return out;
}

/** Linear resampling. Good enough for speech going to speech recognition; no-op when the rates match. */
export function resample(pcm: Int16Array, from: number, to: number): Int16Array {
  if (from === to || pcm.length === 0) return pcm;
  const out = new Int16Array(Math.max(1, Math.round((pcm.length * to) / from)));
  const ratio = from / to;
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const a = Math.floor(x);
    const b = Math.min(a + 1, pcm.length - 1);
    const t = x - a;
    out[i] = Math.round(pcm[Math.min(a, pcm.length - 1)] * (1 - t) + pcm[b] * t);
  }
  return out;
}

/** Samples -> the bytes of little-endian 16-bit PCM (what the voice socket expects). */
export function pcmBytes(pcm: Int16Array): ArrayBuffer {
  const out = new ArrayBuffer(pcm.length * 2);
  const view = new DataView(out);
  for (let i = 0; i < pcm.length; i++) view.setInt16(i * 2, pcm[i], true);
  return out;
}

/** Little-endian 16-bit PCM bytes -> samples. */
export function pcmFromBytes(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length >> 1);
  for (let i = 0; i < out.length; i++) {
    const v = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
    out[i] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

/** Collects samples and hands them on in fixed-size chunks (e.g. 100 ms for the voice socket). */
export class Chunker {
  private buffer: Int16Array;
  private filled = 0;

  constructor(
    readonly size: number,
    private readonly emit: (chunk: Int16Array) => void,
  ) {
    this.buffer = new Int16Array(size);
  }

  push(samples: Int16Array) {
    let i = 0;
    while (i < samples.length) {
      const take = Math.min(this.size - this.filled, samples.length - i);
      this.buffer.set(samples.subarray(i, i + take), this.filled);
      this.filled += take;
      i += take;
      if (this.filled === this.size) {
        this.emit(this.buffer);
        this.buffer = new Int16Array(this.size);
        this.filled = 0;
      }
    }
  }

  /** Send what is left (a short last chunk). */
  flush() {
    if (!this.filled) return;
    this.emit(this.buffer.slice(0, this.filled));
    this.buffer = new Int16Array(this.size);
    this.filled = 0;
  }

  clear() {
    this.filled = 0;
  }
}
