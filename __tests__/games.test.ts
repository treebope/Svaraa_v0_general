import {
  allMatched,
  checkTaps,
  closeMismatch,
  flip,
  growSequence,
  matchScore,
  ORB_HEIGHT,
  ORB_POINTS,
  needsClosing,
  newDeck,
  newRun,
  RUN,
  stepRun,
} from '@/features/games/logic';

describe('Lotus Pulse', () => {
  it('jumps only from the line and lands again', () => {
    let s = stepRun(newRun(), 0.016, true, () => 0.5);
    expect(s.y).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) s = stepRun({ ...s, spikes: [] }, 0.016, false, () => 0.99);
    expect(s.y).toBe(0);
  });
  it('ends when a spike reaches the lotus on the ground, not when she is in the air', () => {
    const spike = [{ x: RUN.playerX }];
    expect(stepRun({ ...newRun(), spikes: spike }, 0.001, false, () => 0.5).over).toBe(true);
    expect(stepRun({ ...newRun(), y: 20, vy: 0, spikes: spike }, 0.001, false, () => 0.5).over).toBe(false);
  });
  it('adds spikes and scores over time', () => {
    let s = newRun();
    for (let i = 0; i < 60; i++) s = stepRun({ ...s, y: 30 }, 0.05, false, () => 0.5);
    expect(s.spikes.length).toBeGreaterThan(0);
    expect(s.score).toBeGreaterThan(0);
  });
});

describe('Lotus Pulse lights', () => {
  it('scores a golden light when the lotus leaps through it', () => {
    const s = stepRun(
      { ...newRun(), y: 10, orbs: [{ x: RUN.playerX + RUN.playerSize / 2, y: ORB_HEIGHT }] },
      0.001,
      false,
      () => 0.99,
    );
    expect(s.lights).toBe(1);
    expect(s.orbs.filter((o) => o.x < 50)).toHaveLength(0);
    expect(s.score).toBeGreaterThanOrEqual(ORB_POINTS);
  });
});

describe('Memory Match', () => {
  it('scores 100 per pair and takes 10 off per wrong try', () => {
    expect(matchScore(0, 0)).toBe(0);
    expect(matchScore(6, 6)).toBe(600);
    expect(matchScore(6, 9)).toBe(570);
    expect(matchScore(0, 5)).toBe(0);
  });
  it('deals six pairs', () => {
    const deck = newDeck();
    expect(deck).toHaveLength(12);
    expect(new Set(deck.map((d) => d.glyph)).size).toBe(6);
  });
  it('keeps a match, and closes a mismatch', () => {
    const deck = newDeck(() => 0);
    const a = deck[0]!;
    const same = deck.find((d) => d.id !== a.id && d.glyph === a.glyph)!;
    const other = deck.find((d) => d.glyph !== a.glyph)!;
    expect(flip(flip(deck, a.id), same.id).filter((d) => d.done)).toHaveLength(2);
    const miss = flip(flip(deck, a.id), other.id);
    expect(needsClosing(miss)).toBe(true);
    expect(flip(miss, same.id)).toBe(miss); // a third card is ignored while two are open
    expect(needsClosing(closeMismatch(miss))).toBe(false);
  });
  it('is won when every card is matched', () => {
    expect(allMatched(newDeck().map((d) => ({ ...d, done: true })))).toBe(true);
  });
});

describe('Petal Sequence', () => {
  it('starts with two petals and grows by one', () => {
    const first = growSequence([]);
    expect(first).toHaveLength(2);
    expect(growSequence(first)).toHaveLength(3);
  });
  it('checks taps in order', () => {
    expect(checkTaps([1, 2], [1])).toBe('more');
    expect(checkTaps([1, 2], [1, 2])).toBe('done');
    expect(checkTaps([1, 2], [1, 3])).toBe('wrong');
  });
});
