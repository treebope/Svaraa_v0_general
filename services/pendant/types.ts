/**
 * The one interface the app uses to talk to the pendant. Screens never see Bluetooth or WebSocket.
 * SimulatorTransport (in-app, no hardware) and BleTransport (react-native-ble-plx) both implement it.
 * PENDING SPEC: shapes follow the wireframes. Update them to Person 2's interface_spec.md when it is shared.
 */
import type { PendantMessage } from './protocol';

export type { AudioPacket, ControlMessage, HelloMessage, PendantMessage } from './protocol';

/**
 * A pendant found while scanning. `serial` is the short number printed on it (shown as "#2041").
 * `name` is '' when the pendant advertises none; screens show their own label then.
 */
export type FoundPendant = { id: string; name: string; serial: string };

export type Connection = 'disconnected' | 'connecting' | 'connected';

export type PendantStatus = {
  connection: Connection;
  /** 0–100, when known. */
  battery?: number;
  charging?: boolean;
  /** The connected pendant's id (BLE address on Android), when connected. */
  pendantId?: string;
};

/** The three checks on C4: touch tick, spoken status, microphone "Hello". */
export type PendantCheck = 'touch' | 'announce' | 'mic';

/** Things the pendant tells the app by itself. */
export type PendantEvent =
  /** The gold dot was held for three seconds: SOS (or the drill during setup). */
  { type: 'sos' };

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
  /**
   * Audio frames and control messages from the pendant (hello, wake, utterance end, ...), already decoded from the
   * BLE wire format. A new listener first gets the link's hello, if one was already received.
   */
  onMessage(listener: (m: PendantMessage) => void): () => void;
  /** Send to the pendant: audio frames (replies) and control (hello_ack, playback_end, error). In order. */
  send(m: PendantMessage): Promise<void>;
}
