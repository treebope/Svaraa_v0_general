import { flags } from '@/config/flags';
import { BleTransport } from './ble';
import { SimulatorTransport } from './simulator';
import type { PendantTransport } from './types';

export * from './types';
export { SIMULATED_PENDANT, SimulatorTransport, simulatorTiming } from './simulator';

let transport: PendantTransport | undefined;

/**
 * The pendant connection for the whole app, chosen by `flags.pendantTransport`:
 * 'simulator' answers inside the app; 'ble' talks to a real pendant or the Python simulator over Bluetooth
 * (react-native-ble-plx, development build only).
 */
export function pendant(): PendantTransport {
  if (!transport)
    transport = flags.pendantTransport === 'ble' ? new BleTransport() : new SimulatorTransport();
  return transport;
}

/** Tests only: start again with a fresh pendant. */
export function resetPendant(next?: PendantTransport) {
  transport = next;
}
