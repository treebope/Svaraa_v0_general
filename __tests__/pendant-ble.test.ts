import { BleTransport, REQUEST_MTU, type BleManagerLike } from '@/services/pendant/ble.native';
import { base64ToBytes, bytesToBase64 } from '@/services/pendant/bytes';
import { AUDIO_RX_UUID, AUDIO_TX_UUID, CONTROL_UUID, type PendantMessage } from '@/services/pendant/protocol';

type Monitor = (error: unknown, ch: { value: string | null } | null) => void;

/** Just enough of BleManager to drive BleTransport without Bluetooth. */
function fakeManager(
  options: { mtu?: number; devices?: { id: string; name?: string; serviceUUIDs?: string[] }[] } = {},
) {
  const monitors = new Map<string, Monitor>();
  const writes: { char: string; bytes: number[]; withResponse: boolean }[] = [];
  let onDisconnected: (() => void) | undefined;
  const sub = { remove: jest.fn() };
  const m = {
    onStateChange: (cb: (s: string) => void) => {
      setTimeout(() => cb('PoweredOn'), 0);
      return sub;
    },
    startDeviceScan: async (_u: unknown, _o: unknown, cb: (e: unknown, d: unknown) => void) => {
      for (const d of options.devices ?? []) cb(null, { localName: null, serviceUUIDs: null, ...d });
    },
    stopDeviceScan: async () => undefined,
    connectToDevice: async (id: string, o: { requestMTU?: number }) => ({ id, mtu: o.requestMTU ?? 23 }),
    discoverAllServicesAndCharacteristicsForDevice: async (id: string) => ({ id, mtu: options.mtu ?? 185 }),
    monitorCharacteristicForDevice: (_id: string, _s: string, char: string, cb: Monitor) => {
      monitors.set(char, cb);
      return sub;
    },
    writeCharacteristicWithResponseForDevice: async (_id: string, _s: string, char: string, v: string) => {
      writes.push({ char, bytes: Array.from(base64ToBytes(v)), withResponse: true });
    },
    writeCharacteristicWithoutResponseForDevice: async (_id: string, _s: string, char: string, v: string) => {
      writes.push({ char, bytes: Array.from(base64ToBytes(v)), withResponse: false });
    },
    onDeviceDisconnected: (_id: string, cb: () => void) => {
      onDisconnected = cb;
      return sub;
    },
    cancelDeviceConnection: async () => undefined,
  };
  const notify = (char: string, bytes: number[]) =>
    monitors.get(char)?.(null, { value: bytesToBase64(Uint8Array.from(bytes)) });
  return { manager: m as unknown as BleManagerLike, writes, notify, drop: () => onDisconnected?.() };
}

describe('BleTransport', () => {
  it('finds pendants by service UUID or name only', async () => {
    const fake = fakeManager({
      devices: [
        { id: 'AA:BB:CC:DD:20:41', name: 'PendantSim' },
        { id: '11:22', name: 'Headphones' },
        { id: '33:44', name: null as never, serviceUUIDs: ['96B07100-79AC-407F-88A5-23FAE7871E06'] },
      ],
    });
    const t = new BleTransport(() => fake.manager);
    const found: string[] = [];
    const stop = t.scan((p) => found.push(`${p.name}#${p.serial}`));
    await new Promise((r) => setTimeout(r, 5));
    stop();
    // No advertised name (as from macOS): '' here, and the screens show their own translated label.
    expect(found).toEqual(['PendantSim#2041', '#3344']);
  });

  it('connects, asks for a bigger MTU and sends LINK_READY with it', async () => {
    const fake = fakeManager({ mtu: 185 });
    const t = new BleTransport(() => fake.manager);
    await t.connect('dev-1');
    expect(REQUEST_MTU).toBe(185);
    expect(t.getStatus()).toEqual({ connection: 'connected', pendantId: 'dev-1' });
    expect(fake.writes).toEqual([{ char: CONTROL_UUID, bytes: [0x80, 0x00, 0xb9], withResponse: true }]);
  });

  it('decodes notifications and replays the hello to late listeners', async () => {
    const fake = fakeManager();
    const t = new BleTransport(() => fake.manager);
    await t.connect('dev-1');
    const got: PendantMessage[] = [];
    t.onMessage((m) => got.push(m));
    fake.notify(CONTROL_UUID, [0x01, 0x01, 0x3e, 0x80, 0x01, 0x14, 0x00, 0xf0]);
    fake.notify(AUDIO_TX_UUID, [0x00, 0x05, 0xaa, 0xbb]);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fake.notify(CONTROL_UUID, [0x7f]); // unknown opcode: ignored
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(got).toEqual([
      { type: 'hello', codec: 'opus', rate: 16000, channels: 1, frame_ms: 20, bitrate: 24000 },
      { type: 'audio', seq: 5, payload: Uint8Array.of(0xaa, 0xbb) },
    ]);
    const late: PendantMessage[] = [];
    t.onMessage((m) => late.push(m));
    await Promise.resolve();
    expect(late.map((m) => m.type)).toEqual(['hello']);
  });

  it('writes replies in order: audio without response, control with', async () => {
    const fake = fakeManager();
    const t = new BleTransport(() => fake.manager);
    await t.connect('dev-1');
    await Promise.all([
      t.send({ type: 'audio', seq: 1, payload: Uint8Array.of(7) }),
      t.send({ type: 'playback_end' }),
    ]);
    expect(fake.writes.slice(1)).toEqual([
      { char: AUDIO_RX_UUID, bytes: [0, 1, 7], withResponse: false },
      { char: CONTROL_UUID, bytes: [0x82], withResponse: true },
    ]);
  });

  it('drops a packet bigger than the MTU allows', async () => {
    const fake = fakeManager({ mtu: 23 });
    const t = new BleTransport(() => fake.manager);
    await t.connect('dev-1');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await t.send({ type: 'audio', seq: 1, payload: new Uint8Array(40) });
    expect(fake.writes).toHaveLength(1);
    warn.mockRestore();
  });

  it('reports a dropped link and refuses to send afterwards', async () => {
    const fake = fakeManager();
    const t = new BleTransport(() => fake.manager);
    await t.connect('dev-1');
    fake.drop();
    expect(t.getStatus().connection).toBe('disconnected');
    expect(() => t.send({ type: 'hello_ack' })).toThrow();
  });
});
