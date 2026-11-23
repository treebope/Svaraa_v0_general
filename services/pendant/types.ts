/**
 * The one interface the app uses to talk to the pendant. Screens never see Bluetooth or WebSocket.
 * SimulatorTransport implements it now; BleTransport (react-native-ble-plx) replaces it later with no screen changes.
 * PENDING SPEC: shapes follow the wireframes. Update them to Person 2's interface_spec.md when it is shared.
 */

/** A pendant found while scanning. `serial` is the short number printed on it (shown as "#2041"). */
export type FoundPendant = { id: string; name: string; serial: string };

export type Connection = 'disconnected' | 'connecting' | 'connected';

export type PendantStatus = {
  connection: Connection;
  /** 0–100, when known. */
  battery?: number;
  charging?: boolean;
};

/** The three checks on C4: touch tick, spoken status, microphone "Hello". */
export type PendantCheck = 'touch' | 'announce' | 'mic';

/** Things the pendant tells the app by itself (BLE will emit these; the simulator mocks them). */
export type PendantEvent =
  /** Gold dot pressed once: opens the short pairing window so the phone can find it. */
  | { type: 'pairing_press' }
  /** The gold button was pressed 3 times: SOS (or the drill during setup). */
  | { type: 'sos' };

export type PendantErrorCode =
  /** Nothing found while scanning: the dot was not pressed, or the pendant is out of range. */
  | 'pendant_not_found'
  /** Connecting failed or the pendant went away. */
  | 'pendant_connect_failed'
  /** The call needs a connected pendant. */
  | 'pendant_not_connected';

export class PendantError extends Error {
  readonly code: PendantErrorCode;
  constructor(code: PendantErrorCode) {
    super(code);
    this.name = 'PendantError';
    this.code = code;
  }
}

export interface PendantTransport {
  /** Look for pendants in pairing mode. Calls `onFound` for each one. Stops after `timeoutMs`; returns a stop function. */
  scan(
    onFound: (p: FoundPendant) => void,
    options?: { timeoutMs?: number; onTimeout?: () => void },
  ): () => void;
  /** Pair and connect. The pendant confirms itself (one tick and a spoken "Connected"). */
  connect(id: string): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * Sign the server's random challenge with the pendant's factory key, so the server knows it is a genuine pendant.
   * PENDING SPEC: the key and signature format come from the hardware team.
   */
  signChallenge(challenge: string): Promise<string>;
  /** Ask the pendant to do one check again (tick, speak its status, or listen for "Hello"). */
  runCheck(check: PendantCheck): Promise<void>;
  getStatus(): PendantStatus;
  /** Status changes (connection, battery). Returns an unsubscribe function. */
  onStatus(listener: (s: PendantStatus) => void): () => void;
  onEvent(listener: (e: PendantEvent) => void): () => void;
}
