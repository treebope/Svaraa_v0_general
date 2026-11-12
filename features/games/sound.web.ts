import type { GameSound } from '@/features/games/soundTypes';

/** The few Web Audio parts used here, so no DOM types are needed. */
interface Param {
  setValueAtTime: (v: number, t: number) => void;
  linearRampToValueAtTime: (v: number, t: number) => void;
  exponentialRampToValueAtTime: (v: number, t: number) => void;
}
interface AudioNodeLike {
  connect: (n: AudioNodeLike) => void;
}
interface Osc extends AudioNodeLike {
  type: string;
  frequency: Param;
  start: (t: number) => void;
  stop: (t: number) => void;
}
interface Gain extends AudioNodeLike {
  gain: Param;
}
interface Ctx {
  currentTime: number;
  destination: AudioNodeLike;
  state: string;
  resume(): Promise<void>;
  createOscillator: () => Osc;
  createGain: () => Gain;
}

let ctx: Ctx | undefined;
let master: Gain | undefined;
let muted = false;
let timer: ReturnType<typeof setInterval> | undefined;
let nextAt = 0;
let step = 0;
let speed = 30;

const open = (): Ctx | undefined => {
  if (ctx) return ctx;
  const g = globalThis as unknown as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  const Make = g.AudioContext ?? g.webkitAudioContext;
  if (!Make) return undefined;
  ctx = new Make();
  master = ctx.createGain();
  master.gain.setValueAtTime(muted ? 0 : 0.8, ctx.currentTime);
  master.connect(ctx.destination);
  return ctx;
};

/** One note: a soft attack, then a fade. `to` slides the pitch. */
function tone(freq: number, at: number, dur: number, type: string, vol: number, to?: number) {
  const c = open();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(master);
  o.start(at);
  o.stop(at + dur + 0.05);
}

// A calm major pentatonic tune: a bass note on each bar and a gentle melody above it.
const SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
const BASS = [130.81, 98, 110, 87.31];
const MELODY = [0, 2, 4, 2, 3, 4, 5, 4, 2, 3, 1, 2, 4, 5, 6, 5];

function schedule() {
  const c = open();
  if (!c) return;
  const beat = 60 / (84 + (speed - 30) * 1.4) / 2; // an eighth note
  while (nextAt < c.currentTime + 0.4) {
    const i = step % MELODY.length;
    if (nextAt < c.currentTime) nextAt = c.currentTime;
    tone(SCALE[MELODY[i] ?? 0] ?? 261, nextAt, beat * 1.6, 'triangle', 0.07);
    if (i % 4 === 0) tone(BASS[((step / 4) % BASS.length) | 0] ?? 98, nextAt, beat * 3.6, 'sine', 0.1);
    nextAt += beat;
    step += 1;
  }
}

export const sound: GameSound = {
  unlock: () => {
    const c = open();
    if (c && c.state !== 'running') void c.resume();
  },
  jump: () => {
    const c = open();
    if (c) tone(330, c.currentTime, 0.14, 'sine', 0.16, 620);
  },
  collect: () => {
    const c = open();
    if (!c) return;
    tone(880, c.currentTime, 0.16, 'sine', 0.2);
    tone(1320, c.currentTime + 0.08, 0.28, 'sine', 0.18);
    tone(1760, c.currentTime + 0.16, 0.3, 'triangle', 0.1);
  },
  over: () => {
    const c = open();
    if (!c) return;
    tone(392, c.currentTime, 0.3, 'triangle', 0.18, 196);
    tone(262, c.currentTime + 0.28, 0.5, 'triangle', 0.16, 110);
  },
  startMusic: () => {
    const c = open();
    if (!c || timer) return;
    nextAt = c.currentTime + 0.05;
    step = 0;
    timer = setInterval(schedule, 120);
    schedule();
  },
  stopMusic: () => {
    if (timer) clearInterval(timer);
    timer = undefined;
  },
  setSpeed: (s) => {
    speed = s;
  },
  setMuted: (m) => {
    muted = m;
    if (ctx && master) master.gain.setValueAtTime(m ? 0 : 0.8, ctx.currentTime);
  },
};
