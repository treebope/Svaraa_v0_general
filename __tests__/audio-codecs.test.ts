import { decodeAdpcmFrame, encodeAdpcmFrame } from '@/services/audio/adpcm';
import { canDecode, createDecoder, decoderNames, registerDecoder } from '@/services/audio/codecs';
import { Chunker, pcmBytes, pcmFromBytes, resample, toMono } from '@/services/audio/pcm';

const fromHex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));
const tone = (n: number, offset = 0) =>
  Int16Array.from({ length: n }, (_, i) =>
    Math.trunc(12000 * Math.sin((2 * Math.PI * 440 * (i + offset)) / 16000)),
  );

describe('IMA ADPCM', () => {
  it('decodes a frame made by the Python simulator to the same samples Python gets', () => {
    // Second 20 ms frame of a 440 Hz tone, from _AdpcmEncoder in simulator/codecs.py.
    const frame = fromHex(
      'e4d1360077050110809098a9bbcbbbbbab8a28534434342433220190caccbcbcacbbaa9918323635342433221290c9ebcbcbcbbaaa8a08314435344333321280b9cddbcbcbbaab9a08304444434332321281a9ebdbcbcbbaabaa0920343634342423120198dbbcbdcbbbbbab9911635334433343120190bbcdbcbcacbbaa9910424434344323231190caccdbbbbcbbbb9908424444333433331280babecdbbbccbaa9908',
    );
    const python = [
      -9401, -4248, 3855, 4933, 7874, 8765, 9575, 11784, 12453, 11845, 12398, 10889, 10432, 9186, 8052, 6335,
      4150, 2162, 355, -1757, -3745, -5552, -7194, -8686, -10044, -10925, -11726, -11871, -12003, -11402,
      -10636, -9542, -8231, -6644, -4724, -2917, -805, 1183, 3507, 5068, 7056, 8863, 10036, 11102, 11684,
      11860, 12020, 11584, 10922, 9839, 8528, 6941, 5021, 3214, 1102, -886, -3210, -4771, -6759, -8566, -9739,
      -10805, -11387, -11915, -12075, -11639, -10977, -10136, -8713, -7355, -5416, -3609, -1497, 491, 2815,
      4376, 6364, 8171, 9344, 10410, 11380, 11908, 12068, 11632, 11235, 10152, 9133, 7411, 5769, 3849, 2042,
      -70, -2058, -4382, -5943, -7931, -9222, -10395, -11461, -11655, -11831, -11671, -11235, -10308, -9225,
      -7914, -5975, -4168, -2056, -68, 1739, 3851, 5839, 7646, 8819, 10311, 11281, 11809, 11969, 11824, 11427,
      10586, 9382, 7940, 6582, 4643, 2836, 724, -1264, -3588, -5149, -7137, -8944, -10117, -11183, -11765,
      -11941, -11781, -11636, -10709, -9626, -8315, -6728, -4808, -3001, -889, 1099, 3423, 4984, 6972, 8263,
      9905, 10971, 11553, 12081, 11921, 11485, 10823, 9982, 8559, 7201, 5262, 3455, 1343, -645, -2969, -4530,
      -6518, -8325, -9498, -10564, -11534, -12062, -11902, -11757, -11095, -10012, -8993, -7271, -5629, -3709,
      -1902, 210, 2198, 4522, 6083, 8071, 9362, 10535, 11174, 11756, 11932, 11772, 11336, 10409, 9086, 7499,
      6007, 3873, 1885, 78, -2034, -4022, -5829, -7471, -8963, -10321, -11202, -11682, -12118, -11721, -11361,
      -10595, -9302, -8069, -6307, -4195, -2207, -400, 1712, 3700, 5507, 7149, 9069, 10360, 11063, 11702,
      11896, 12072, 11592, 10573, 9646, 8323, 6736, 4816, 3009, 897, -1091, -3415, -4976, -6964, -8771, -9944,
      -11010, -11592, -12120, -11960, -11524, -10862, -9779, -8468, -6881, -4961, -3154, -1042, 946, 2753,
      4865, 6853, 8144, 9786, 10852, 11434, 11962, 12122, 11686, 11024, 9941, 8630, 7043, 5551, 3417, 1429,
      -378, -2490, -4478, -6285, -7927, -9419, -10777, -11305, -11785, -11930, -11798, -11197, -10212, -9020,
      -7578, -5832, -3720, -1732, 75, 2187, 4175, 5982, 7624, 9116, 10474, 11355, 11835, 11980, 11848, 11247,
      10481, 9188, 7955, 6193, 4081, 2093, 286, -1826, -3814, -5621, -7733, -9153, -10444, -11147, -11786,
      -11980, -11804,
    ];
    expect(frame.length).toBe(164);
    expect(Array.from(decodeAdpcmFrame(frame))).toEqual(python);
  });

  it('round-trips a tone closely and keeps state across frames', () => {
    const state = { predictor: 0, index: 0 };
    let worst = 0;
    for (let f = 0; f < 5; f++) {
      const pcm = tone(320, f * 320);
      const frame = encodeAdpcmFrame(pcm, state);
      expect(frame.length).toBe(164);
      const out = decodeAdpcmFrame(frame);
      if (f > 0) for (let i = 0; i < pcm.length; i++) worst = Math.max(worst, Math.abs(out[i] - pcm[i]));
    }
    expect(worst).toBeLessThan(1500);
  });
});

describe('PCM helpers', () => {
  it('converts to little-endian bytes and back', () => {
    const pcm = Int16Array.of(0, 1, -1, 32767, -32768);
    const bytes = new Uint8Array(pcmBytes(pcm));
    expect(Array.from(bytes.slice(0, 6))).toEqual([0, 0, 1, 0, 0xff, 0xff]);
    expect(pcmFromBytes(bytes)).toEqual(pcm);
  });

  it('downmixes and resamples', () => {
    expect(toMono(Int16Array.of(10, 20, -10, -30), 2)).toEqual(Int16Array.of(15, -20));
    expect(resample(new Int16Array(480), 48000, 16000)).toHaveLength(160);
    expect(resample(Int16Array.of(0, 100), 8000, 16000)).toEqual(Int16Array.of(0, 50, 100, 100));
    const same = Int16Array.of(1, 2);
    expect(resample(same, 16000, 16000)).toBe(same);
  });

  it('chunks into fixed sizes and flushes the rest', () => {
    const out: number[][] = [];
    const c = new Chunker(4, (chunk) => out.push(Array.from(chunk)));
    c.push(Int16Array.of(1, 2, 3));
    c.push(Int16Array.of(4, 5, 6, 7, 8, 9));
    c.flush();
    expect(out).toEqual([[1, 2, 3, 4], [5, 6, 7, 8], [9]]);
  });
});

describe('decoder registry', () => {
  it('has pcm16 and adpcm built in, not opus', () => {
    expect(decoderNames()).toEqual(expect.arrayContaining(['adpcm', 'pcm16']));
    expect(canDecode('opus')).toBe(false);
    expect(() => createDecoder({ codec: 'opus', rate: 16000, channels: 1, frameMs: 20 })).toThrow(
      /no decoder/,
    );
  });

  it('takes new codecs without other changes', () => {
    registerDecoder('test-silence', () => ({
      decode: (f) => new Int16Array(f.length),
      reset: () => undefined,
    }));
    const d = createDecoder({ codec: 'test-silence', rate: 16000, channels: 1, frameMs: 20 });
    expect(d.decode(new Uint8Array(3))).toHaveLength(3);
  });
});
