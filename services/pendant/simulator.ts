import {
  PendantError,
  type FoundPendant,
  type PendantCheck,
  type PendantEvent,
  type PendantStatus,
  type PendantTransport,
} from './types';

/**
 * A pendant that lives inside the app, so pairing, checks and the SOS drill can be built and demoed with no hardware.
 * PENDING SPEC: Person 2's simulator speaks WebSocket. Once interface_spec.md is shared, this class sends the same
 * calls over that socket instead of answering itself; the PendantTransport interface stays the same.
 */

/** Delays in ms, so it feels like a real pendant. Tests set them to 0. */
export const simulatorTiming = { found: 1200, connect: 1500, check: 600 };

/** The simulated pendant, as it would appear when scanning. */
export const SIMULATED_PENDANT: FoundPendant = { id: 'sim-2041', name: 'Svaraa Fold Over', serial: '2041' };

const DEFAULT_SCAN_TIMEOUT = 20_000;

export class SimulatorTransport implements PendantTransport {
  private status: PendantStatus = { connection: 'disconnected' };
  private statusListeners = new Set<(s: PendantStatus) => void>();
  private eventListeners = new Set<(e: PendantEvent) => void>();

  scan(onFound: (p: FoundPendant) => void, options?: { timeoutMs?: number; onTimeout?: () => void }) {
    const found = setTimeout(() => onFound(SIMULATED_PENDANT), simulatorTiming.found);
    const timeout = setTimeout(() => options?.onTimeout?.(), options?.timeoutMs ?? DEFAULT_SCAN_TIMEOUT);
    return () => {
      clearTimeout(found);
      clearTimeout(timeout);
    };
  }

  async connect(id: string) {
    if (id !== SIMULATED_PENDANT.id) throw new PendantError('pendant_connect_failed');
    this.set({ connection: 'connecting' });
    await wait(simulatorTiming.connect);
    this.set({ connection: 'connected', battery: 82, charging: false });
  }

  async disconnect() {
    this.set({ connection: 'disconnected', battery: undefined, charging: undefined });
  }

  async signChallenge(challenge: string) {
    this.requireConnected();
    // Not a real signature: the mock backend accepts any answer that starts with "sim:".
    return `sim:${SIMULATED_PENDANT.id}:${challenge}`;
  }

  async runCheck(_check: PendantCheck) {
    this.requireConnected();
    await wait(simulatorTiming.check);
  }

  getStatus() {
    return this.status;
  }

  onStatus(listener: (s: PendantStatus) => void) {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  }

  onEvent(listener: (e: PendantEvent) => void) {
    this.eventListeners.add(listener);
    return () => void this.eventListeners.delete(listener);
  }

  /** Demo and tests only: act as if the wearer pressed the gold button once (pairing window). */
  simulatePairingPress() {
    this.emit({ type: 'pairing_press' });
  }

  /** Demo and tests only: act as if the wearer pressed the gold button 3 times (SOS). */
  simulateSosPress() {
    this.emit({ type: 'sos' });
  }

  private emit(e: PendantEvent) {
    for (const l of this.eventListeners) l(e);
  }

  private requireConnected() {
    if (this.status.connection !== 'connected') throw new PendantError('pendant_not_connected');
  }

  private set(next: PendantStatus) {
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
