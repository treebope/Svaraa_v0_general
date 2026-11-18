import type { PendantTransport } from './types';

/**
 * Web (and anywhere without BLE): a browser cannot reach the pendant. Phones use ble.native.ts.
 * Same constructor shape as the native class, so services/pendant/index.ts builds on every platform.
 */
export const BleTransport = class {
  constructor(_createManager?: unknown) {
    throw new Error('Bluetooth pendants need the phone app (a development build)');
  }
} as unknown as new (createManager?: unknown) => PendantTransport;
