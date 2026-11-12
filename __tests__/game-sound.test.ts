import { sound } from '@/features/games/sound.web';

const made: { type: string; start: jest.Mock }[] = [];
const param = () => ({
  setValueAtTime: jest.fn(),
  linearRampToValueAtTime: jest.fn(),
  exponentialRampToValueAtTime: jest.fn(),
});
class FakeAudio {
  currentTime = 0;
  state = 'suspended';
  destination = { connect: jest.fn() };
  resume = jest.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  createGain = () => ({ gain: param(), connect: jest.fn() });
  createOscillator = () => {
    const o = { type: '', frequency: param(), connect: jest.fn(), start: jest.fn(), stop: jest.fn() };
    made.push(o);
    return o;
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  made.length = 0;
  (globalThis as unknown as { AudioContext: typeof FakeAudio }).AudioContext = FakeAudio;
});
afterEach(() => {
  sound.stopMusic();
  jest.useRealTimers();
});

describe('Game sound (web)', () => {
  it('plays the collect chime and the jump and game-over sounds', () => {
    sound.unlock();
    sound.collect();
    expect(made.length).toBeGreaterThanOrEqual(3);
    const before = made.length;
    sound.jump();
    sound.over();
    expect(made.length).toBeGreaterThan(before);
    made.forEach((o) => expect(o.start).toHaveBeenCalled());
  });

  it('plays music while it is on and stops when told to', () => {
    sound.startMusic();
    const first = made.length;
    expect(first).toBeGreaterThan(0);
    sound.stopMusic();
    jest.advanceTimersByTime(1000);
    expect(made.length).toBe(first);
  });

  it('does not throw when the browser has no audio', () => {
    delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
    expect(() => sound.setMuted(true)).not.toThrow();
  });
});
