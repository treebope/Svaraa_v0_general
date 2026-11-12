/** Game rules with no screen code, so they can be tested on their own. */

// ---- Lotus Pulse: a gentle runner. Tap to leap the spikes on the heartbeat line. ----

export const RUN = {
  /** World size in "units"; the view scales units to pixels. */
  width: 100,
  playerX: 18,
  playerSize: 9,
  gravity: 260,
  jumpSpeed: 100,
  startSpeed: 30,
  maxSpeed: 55,
  spikeWidth: 6,
  spikeHeight: 9,
};

export type Spike = { x: number };
export type RunState = {
  y: number;
  vy: number;
  speed: number;
  spikes: Spike[];
  /** Golden lights to collect: each is worth `ORB_POINTS`. */
  orbs: Orb[];
  lights: number;
  score: number;
  over: boolean;
};
export type Orb = { x: number; y: number };
export const ORB_POINTS = 10;
export const ORB_HEIGHT = 15;

/** Does a spike starting at `x` touch the lotus between `left` and `right`? */
const overlaps = (x: number, left: number, right: number) =>
  right - x > 0 && x + RUN.spikeWidth * 0.7 - left > 0;

export const newRun = (): RunState => ({
  y: 0,
  vy: 0,
  speed: RUN.startSpeed,
  spikes: [],
  orbs: [],
  lights: 0,
  score: 0,
  over: false,
});

/** Advance the run by `dt` seconds. `jump` starts a leap if the lotus is on the line. `rand` is 0 to 1. */
export function stepRun(
  s: RunState,
  dt: number,
  jump: boolean,
  rand: () => number,
  worldW: number = RUN.width,
): RunState {
  if (s.over) return s;
  let { y, vy } = s;
  if (jump && y === 0) vy = RUN.jumpSpeed;
  vy -= RUN.gravity * dt;
  y = Math.max(0, y + vy * dt);
  if (y === 0) vy = 0;
  const speed = Math.min(RUN.maxSpeed, s.speed + dt * 0.8);
  let spikes = s.spikes.map((k) => ({ x: k.x - speed * dt })).filter((k) => k.x > -RUN.spikeWidth);
  let orbs = s.orbs.map((o) => ({ ...o, x: o.x - speed * dt })).filter((o) => o.x > -RUN.spikeWidth);
  const last = spikes[spikes.length - 1];
  // Always leave room to land and jump again: the gap grows with the speed.
  if (!last || last.x < worldW - (48 + rand() * 40) * (speed / RUN.startSpeed) ** 0.5) {
    spikes = [...spikes, { x: worldW + RUN.spikeWidth }];
    // A golden light hangs over most spikes: leaping the spike collects it.
    if (rand() < 0.75) orbs = [...orbs, { x: worldW + RUN.spikeWidth + 3, y: ORB_HEIGHT }];
  }
  const left = RUN.playerX;
  const right = RUN.playerX + RUN.playerSize * 0.7;
  const low = y < RUN.spikeHeight * 0.6;
  const hit = low && spikes.some((k) => overlaps(k.x, left, right));
  const cx = RUN.playerX + RUN.playerSize / 2;
  const cy = y + RUN.playerSize / 2;
  const taken = orbs.filter((o) => (o.x - cx) ** 2 + (o.y - cy) ** 2 < 49);
  if (taken.length) orbs = orbs.filter((o) => !taken.includes(o));
  const lights = s.lights + taken.length;
  return {
    y,
    vy,
    speed,
    spikes,
    orbs,
    lights,
    score: s.score + dt * speed + taken.length * ORB_POINTS,
    over: hit,
  };
}

// ---- Memory Match: find the pairs. ----

export const MATCH_GLYPHS = ['✿', '❀', '☀', '☾', '♥', '★'] as const;
export type Card = { id: number; glyph: string; open: boolean; done: boolean };

export function newDeck(rand: () => number = Math.random): Card[] {
  const glyphs = [...MATCH_GLYPHS, ...MATCH_GLYPHS];
  for (let i = glyphs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [glyphs[i], glyphs[j]] = [glyphs[j]!, glyphs[i]!];
  }
  return glyphs.map((glyph, id) => ({ id, glyph, open: false, done: false }));
}

/** Turn a card over. Two open cards that differ are shown, then `closeMismatch` turns them back. */
export function flip(deck: Card[], id: number): Card[] {
  const c = deck.find((d) => d.id === id);
  if (!c || c.open || c.done || deck.filter((d) => d.open).length >= 2) return deck;
  const next = deck.map((d) => (d.id === id ? { ...d, open: true } : d));
  const open = next.filter((d) => d.open);
  if (open.length === 2 && open[0]!.glyph === open[1]!.glyph) {
    return next.map((d) => (d.open ? { ...d, open: false, done: true } : d));
  }
  return next;
}

export const needsClosing = (deck: Card[]) => deck.filter((d) => d.open).length === 2;
export const closeMismatch = (deck: Card[]): Card[] => deck.map((d) => (d.open ? { ...d, open: false } : d));
/** Each pair found is worth 100 points; each wrong try costs 10. */
export const PAIR_POINTS = 100;
export const MISS_POINTS = 10;
export const matchScore = (pairs: number, tries: number) =>
  Math.max(0, pairs * PAIR_POINTS - (tries - pairs) * MISS_POINTS);

export const allMatched = (deck: Card[]) => deck.every((d) => d.done);

// ---- Petal Sequence: watch the petals light up, then tap them in the same order. ----

export const PETALS = 4;

/** The pattern for a level: one petal longer each round, starting at 2. */
export function growSequence(prev: number[], rand: () => number = Math.random): number[] {
  const base = prev.length ? prev : [Math.floor(rand() * PETALS), Math.floor(rand() * PETALS)];
  return prev.length ? [...prev, Math.floor(rand() * PETALS)] : base;
}

export type Answer = 'wrong' | 'more' | 'done';
/** Check what the person has tapped so far against the pattern. */
export function checkTaps(sequence: number[], taps: number[]): Answer {
  for (let i = 0; i < taps.length; i++) if (taps[i] !== sequence[i]) return 'wrong';
  return taps.length === sequence.length ? 'done' : 'more';
}
