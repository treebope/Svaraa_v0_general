import { flags } from '@/config/flags';
import { matchPath } from '@/services/mocks/routes';
import {
  pendant,
  resetPendant,
  SIMULATED_PENDANT,
  SimulatorTransport,
  simulatorTiming,
  type PendantStatus,
} from '@/services/pendant';

beforeEach(() => {
  Object.assign(simulatorTiming, { found: 0, connect: 0, check: 0 });
  resetPendant();
});

describe('pendant()', () => {
  it('uses the simulator while flags.pendantTransport is "simulator"', () => {
    expect(flags.pendantTransport).toBe('simulator');
    expect(pendant()).toBeInstanceOf(SimulatorTransport);
    expect(pendant()).toBe(pendant());
  });
});

describe('SimulatorTransport', () => {
  it('finds the pendant when scanning', async () => {
    const t = new SimulatorTransport();
    const found = await new Promise((resolve) => t.scan(resolve));
    expect(found).toEqual(SIMULATED_PENDANT);
  });

  it('reports a scan timeout, and a stopped scan reports nothing', async () => {
    jest.useFakeTimers();
    const t = new SimulatorTransport();
    simulatorTiming.found = 50_000;
    const onTimeout = jest.fn();
    const onFound = jest.fn();
    t.scan(onFound, { timeoutMs: 1000, onTimeout });
    const stop = t.scan(onFound, { timeoutMs: 1000, onTimeout });
    stop();
    jest.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onFound).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('connects, reports status, and signs only when connected', async () => {
    const t = new SimulatorTransport();
    const seen: PendantStatus['connection'][] = [];
    t.onStatus((s) => seen.push(s.connection));
    await expect(t.signChallenge('abc')).rejects.toMatchObject({ code: 'pendant_not_connected' });
    await t.connect(SIMULATED_PENDANT.id);
    expect(seen).toEqual(['connecting', 'connected']);
    expect(t.getStatus().battery).toBe(82);
    expect(await t.signChallenge('abc')).toBe('sim:sim-2041:abc');
    await t.disconnect();
    expect(t.getStatus().connection).toBe('disconnected');
  });

  it('refuses an unknown pendant', async () => {
    await expect(new SimulatorTransport().connect('nope')).rejects.toMatchObject({
      code: 'pendant_connect_failed',
    });
  });

  it('sends an SOS event when the dot is held', () => {
    const t = new SimulatorTransport();
    const listener = jest.fn();
    const off = t.onEvent(listener);
    t.simulateSosPress();
    off();
    t.simulateSosPress();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('mock path parameters', () => {
  it('match one segment per {name}', () => {
    expect(matchPath('/api/v1/circles/{circle_id}/contacts', '/api/v1/circles/h1/contacts')).toEqual({
      circle_id: 'h1',
    });
    expect(matchPath('/api/v1/circles/{circle_id}/contacts', '/api/v1/circles/contacts')).toBeUndefined();
    expect(matchPath('/api/v1/users/me', '/api/v1/users/me')).toEqual({});
  });
});
