"""Makes the small sound files the games play on the phone (same notes as the web version).

Run: python3 scripts/make-game-sounds.py   (writes assets/sounds/*.wav; no extra packages needed)
"""
import math
import struct
import wave

RATE = 22050


def render(length_s, notes, wrap=False):
    """notes: (start_s, dur_s, freq, to_freq or None, volume, shape)."""
    n = int(length_s * RATE)
    buf = [0.0] * n
    for start, dur, freq, to, vol, shape in notes:
        count = int(dur * RATE)
        phase = 0.0
        for i in range(count):
            t = i / RATE
            f = freq if not to else freq * (to / freq) ** (t / dur)
            phase += 2 * math.pi * f / RATE
            if shape == "triangle":
                s = (2 / math.pi) * math.asin(math.sin(phase))
            else:
                s = math.sin(phase)
            attack = min(1.0, t / 0.02)
            decay = math.exp(-4.5 * t / dur)
            idx = int(start * RATE) + i
            if idx >= n:
                if not wrap:
                    break
                idx %= n
            buf[idx] += s * attack * decay * vol
    return buf


def save(name, buf, peak=0.8):
    top = max(abs(x) for x in buf) or 1.0
    scale = min(1.0, peak / top) if top > peak else 1.0
    with wave.open(f"assets/sounds/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * scale)) * 32767)) for x in buf))


save("collect", render(0.6, [(0, 0.16, 880, None, 0.45, "sine"), (0.08, 0.28, 1320, None, 0.4, "sine"), (0.16, 0.3, 1760, None, 0.25, "triangle")]))
save("jump", render(0.2, [(0, 0.14, 330, 620, 0.4, "sine")]))
save("over", render(0.9, [(0, 0.3, 392, 196, 0.45, "triangle"), (0.28, 0.5, 262, 110, 0.4, "triangle")]))

SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33]
BASS = [130.81, 98, 110, 87.31]
MELODY = [0, 2, 4, 2, 3, 4, 5, 4, 2, 3, 1, 2, 4, 5, 6, 5]
beat = 60 / 90 / 2
steps = len(MELODY) * 2
notes = []
for step in range(steps):
    i = step % len(MELODY)
    notes.append((step * beat, beat * 1.6, SCALE[MELODY[i]], None, 0.16, "triangle"))
    if i % 4 == 0:
        notes.append((step * beat, beat * 3.6, BASS[(step // 4) % len(BASS)], None, 0.22, "sine"))
save("music", render(steps * beat, notes, wrap=True), peak=0.6)
