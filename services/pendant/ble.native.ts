import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';
import { env } from '@/config/env';
import { base64ToBytes, bytesToBase64 } from './bytes';
import {
  ATT_HEADER_BYTES,
  AUDIO_RX_UUID,
  AUDIO_TX_UUID,
  CONTROL_UUID,
  SERVICE_UUID,
  decodeControl,
  encodeControl,
  packAudio,
  unpackAudio,
  type HelloMessage,
} from './protocol';
import {
  PendantError,
  type FoundPendant,
  type PendantCheck,
  type PendantEvent,
  type PendantMessage,
  type PendantStatus,
  type PendantTransport,
} from './types';

/**
 * The pendant over Bluetooth LE (react-native-ble-plx). The phone is the central; the pendant (or the Mac running
 * the Python simulator) is the peripheral. Needs a development build: BLE is native code and does not run in Expo Go.
 *
 * Link set-up: connect (asking Android for a bigger MTU), discover, subscribe to AUDIO_TX and CONTROL, then write
 * LINK_READY with the MTU. The pendant answers with its hello (the audio format) on CONTROL.
 */

/** ATT MTU asked for on Android (iOS negotiates by itself). 185 fits an Opus frame and what macOS peripherals allow. */
export const REQUEST_MTU = 185;
const CONNECT_TIMEOUT_MS = 15_000;
const DEFAULT_SCAN_TIMEOUT = 20_000;

/** The part of BleManager this class uses, so tests can pass a fake. */
export type BleManagerLike = Pick<
  BleManager,
  | 'onStateChange'
  | 'startDeviceScan'
  | 'stopDeviceScan'
  | 'connectToDevice'
  | 'discoverAllServicesAndCharacteristicsForDevice'
  | 'monitorCharacteristicForDevice'
  | 'writeCharacteristicWithResponseForDevice'
  | 'writeCharacteristicWithoutResponseForDevice'
  | 'onDeviceDisconnected'
  | 'cancelDeviceConnection'
>;

const sameUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export class BleTransport implements PendantTransport {
  private manager?: BleManagerLike;
  private status: PendantStatus = { connection: 'disconnected' };
  private statusListeners = new Set<(s: PendantStatus) => void>();
  private eventListeners = new Set<(e: PendantEvent) => void>();
  private messageListeners = new Set<(m: PendantMessage) => void>();
  private subscriptions: Subscription[] = [];
  private deviceId?: string;
  private mtu = 23;
  private hello?: HelloMessage;
  /** Every write goes through this chain, so frames and control reach the pendant in order. */
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly createManager: () => BleManagerLike = () => new BleManager()) {}

  /** Created on first use: constructing BleManager starts the native module. */
  private ble(): BleManagerLike {
    this.manager ??= this.createManager();
    return this.manager;
  }

  scan(onFound: (p: FoundPendant) => void, options?: { timeoutMs?: number; onTimeout?: () => void }) {
    let stopped = false;
    const seen = new Set<string>();
    const ble = this.ble();
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timeout);
      void ble.stopDeviceScan();
    };
    const timeout = setTimeout(() => {
      stop();
      options?.onTimeout?.();
    }, options?.timeoutMs ?? DEFAULT_SCAN_TIMEOUT);

    void whenPoweredOn(ble).then(
      () => {
        if (stopped) return;
        // No UUID filter: macOS may put the 128-bit service UUID in the scan response, so match in the callback.
        void ble.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
          if (stopped) return;
          if (error) {
            console.warn('[pendant] scan failed', error.message);
            stop();
            options?.onTimeout?.();
            return;
          }
          if (!device || seen.has(device.id) || !isPendant(device)) return;
          seen.add(device.id);
          onFound(toFound(device));
        });
      },
      () => {
        console.warn('[pendant] Bluetooth is off');
        stop();
        options?.onTimeout?.();
      },
    );
    return stop;
  }

  async connect(id: string) {
    const ble = this.ble();
    await ble.stopDeviceScan();
    this.set({ connection: 'connecting' });
    try {
      await whenPoweredOn(ble);
      const connected = await ble.connectToDevice(id, {
        requestMTU: REQUEST_MTU,
        timeout: CONNECT_TIMEOUT_MS,
      });
      const device = await ble.discoverAllServicesAndCharacteristicsForDevice(id);
      this.deviceId = id;
      this.mtu = device.mtu || connected.mtu || 23;
      this.subscriptions.push(
        ble.onDeviceDisconnected(id, () => this.dropped()),
        ble.monitorCharacteristicForDevice(id, SERVICE_UUID, CONTROL_UUID, (error, ch) => {
          if (!error && ch?.value) this.onControl(base64ToBytes(ch.value));
        }),
        ble.monitorCharacteristicForDevice(id, SERVICE_UUID, AUDIO_TX_UUID, (error, ch) => {
          if (!error && ch?.value) this.onAudio(base64ToBytes(ch.value));
        }),
      );
      // Subscribed: tell the pendant the link is ready, so it sends its hello.
      await this.write(encodeControl({ type: 'link_ready', mtu: this.mtu }), true);
      this.set({ connection: 'connected', pendantId: id });
    } catch (e) {
      console.warn('[pendant] connect failed', e instanceof Error ? e.message : e);
      this.cleanup();
      await ble.cancelDeviceConnection(id).catch(() => undefined);
      this.set({ connection: 'disconnected' });
      throw new PendantError('pendant_connect_failed');
    }
  }

  async disconnect() {
    const id = this.deviceId;
    this.cleanup();
    if (id)
      await this.ble()
        .cancelDeviceConnection(id)
        .catch(() => undefined);
    this.set({ connection: 'disconnected' });
  }

  async signChallenge(challenge: string) {
    this.requireConnected();
    // PENDING SPEC: the factory key and signature format come from the hardware team. The mock backend accepts
    // any answer that starts with "sim:", so pairing works end to end with the simulator.
    return `sim:${this.deviceId}:${challenge}`;
  }

  async runCheck(_check: PendantCheck) {
    // PENDING SPEC: the BLE protocol has no check opcodes yet.
    this.requireConnected();
  }

  getStatus() {
    return this.status;
  }

  onStatus(listener: (s: PendantStatus) => void) {
    this.statusListeners.add(listener);
    return () => void this.statusListeners.delete(listener);
  }

  onEvent(listener: (e: PendantEvent) => void) {
    // PENDING SPEC: SOS has no opcode in the BLE protocol yet.
    this.eventListeners.add(listener);
    return () => void this.eventListeners.delete(listener);
  }

  onMessage(listener: (m: PendantMessage) => void) {
    this.messageListeners.add(listener);
    const hello = this.hello;
    if (hello) queueMicrotask(() => this.messageListeners.has(listener) && listener(hello));
    return () => void this.messageListeners.delete(listener);
  }

  send(m: PendantMessage): Promise<void> {
    this.requireConnected();
    if (m.type === 'audio') return this.write(packAudio(m.seq, m.payload), false);
    return this.write(encodeControl(m), true);
  }

  // ------------------------------------------------------------------ internals

  private onControl(data: Uint8Array) {
    try {
      const msg = decodeControl(data);
      if (msg.type === 'hello') this.hello = msg;
      this.emit(msg);
    } catch (e) {
      console.warn('[pendant] bad control packet', e instanceof Error ? e.message : e);
    }
  }

  private onAudio(data: Uint8Array) {
    try {
      this.emit(unpackAudio(data));
    } catch (e) {
      console.warn('[pendant] bad audio packet', e instanceof Error ? e.message : e);
    }
  }

  private emit(m: PendantMessage) {
    for (const l of this.messageListeners) l(m);
  }

  /** Control goes with response (CONTROL), audio without (AUDIO_RX). Queued so order is kept. */
  private write(packet: Uint8Array, control: boolean): Promise<void> {
    const id = this.deviceId;
    if (!id) return Promise.reject(new PendantError('pendant_not_connected'));
    const max = this.mtu - ATT_HEADER_BYTES;
    if (packet.length > max) {
      console.warn(`[pendant] ${packet.length}-byte packet does not fit MTU ${this.mtu}; dropped`);
      return Promise.resolve();
    }
    const value = bytesToBase64(packet);
    const ble = this.ble();
    const next = this.writes.then(async () => {
      if (control) await ble.writeCharacteristicWithResponseForDevice(id, SERVICE_UUID, CONTROL_UUID, value);
      else await ble.writeCharacteristicWithoutResponseForDevice(id, SERVICE_UUID, AUDIO_RX_UUID, value);
    });
    this.writes = next.catch(() => undefined);
    return next;
  }

  private dropped() {
    this.cleanup();
    this.set({ connection: 'disconnected' });
  }

  private cleanup() {
    for (const s of this.subscriptions) s.remove();
    this.subscriptions = [];
    this.deviceId = undefined;
    this.hello = undefined;
    this.mtu = 23;
    this.writes = Promise.resolve();
  }

  private requireConnected() {
    if (this.status.connection !== 'connected' || !this.deviceId)
      throw new PendantError('pendant_not_connected');
  }

  private set(next: PendantStatus) {
    this.status = next;
    for (const l of this.statusListeners) l(next);
  }
}

function isPendant(device: Device): boolean {
  if (device.serviceUUIDs?.some((u) => sameUuid(u, SERVICE_UUID))) return true;
  const name = device.localName ?? device.name ?? '';
  return env.pendantNamePrefixes.some((prefix: string) => name.startsWith(prefix));
}

function toFound(device: Device): FoundPendant {
  // '' when the pendant advertises no name (macOS often leaves it out); screens then show their own label.
  const name = device.localName ?? device.name ?? '';
  // PENDING SPEC: the real pendant should advertise its printed serial. Until then, the end of its address.
  const serial = device.id
    .replace(/[^0-9a-f]/gi, '')
    .slice(-4)
    .toUpperCase();
  return { id: device.id, name, serial };
}

/** Resolves once Bluetooth is on (scanning or connecting before that fails); rejects if it stays off. */
function whenPoweredOn(ble: BleManagerLike, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      // The subscription may not be assigned yet when the current state is reported straight away.
      queueMicrotask(() => sub.remove());
      if (ok) resolve();
      else reject(new Error('Bluetooth is off'));
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const sub = ble.onStateChange((state) => {
      if (state === State.PoweredOn) finish(true);
    }, true);
  });
}
