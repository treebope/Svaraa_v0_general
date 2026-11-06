import * as Location from 'expo-location';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { flags } from '@/config/flags';
import * as notifications from '@/services/notifications/permissions';
import type { PermissionStatus, WearerPermission } from './types';

export { WEARER_PERMISSIONS, type PermissionStatus, type WearerPermission } from './types';

const read = (p: { granted: boolean; canAskAgain: boolean }): PermissionStatus =>
  p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';

/** Android 12+ asks for "Nearby devices" (scan + connect). */
const ANDROID_BLE = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
].filter(Boolean);
const androidBleNeeded = () => Platform.OS === 'android' && Number(Platform.Version) >= 31;

async function bluetooth(ask: boolean): Promise<PermissionStatus> {
  // PENDING BLE: the simulator needs no Bluetooth. iOS asks only when react-native-ble-plx first scans.
  if (flags.pendantTransport === 'simulator' || !androidBleNeeded()) return 'granted';
  if (!ask) {
    const all = await Promise.all(ANDROID_BLE.map((p) => PermissionsAndroid.check(p)));
    return all.every(Boolean) ? 'granted' : 'undetermined';
  }
  const result = await PermissionsAndroid.requestMultiple(ANDROID_BLE);
  const values = Object.values(result);
  if (values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED)) return 'granted';
  return values.includes(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) ? 'denied' : 'undetermined';
}

/** "Always" location, so SOS can share where the wearer is even when the app is closed. */
async function location(ask: boolean): Promise<PermissionStatus> {
  if (!ask) return read(await Location.getBackgroundPermissionsAsync());
  // The system only offers "Always" after "While using the app" is allowed.
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return foreground.canAskAgain ? 'undetermined' : 'denied';
  try {
    return read(await Location.requestBackgroundPermissionsAsync());
  } catch {
    // Expo Go cannot ask for background location (needs a development build). Use the foreground answer for now.
    return 'granted';
  }
}

export async function getWearerPermission(p: WearerPermission): Promise<PermissionStatus> {
  if (p === 'bluetooth') return bluetooth(false);
  if (p === 'location') return location(false);
  return notifications.getPermission();
}

/** Shows the system question. After a "Don't allow" the system will not ask again; then this returns 'denied'. */
export async function requestWearerPermission(p: WearerPermission): Promise<PermissionStatus> {
  if (p === 'bluetooth') return bluetooth(true);
  if (p === 'location') return location(true);
  return notifications.requestPermission();
}

export const openAppSettings = () => Linking.openSettings();

export const canAskBatteryExemption = Platform.OS === 'android';
/** Opens Android's battery optimisation list, where the wearer can turn it off for Svaraa. */
export const openBatterySettings = () =>
  Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
    Linking.openSettings(),
  );

export const canGrantPermissions = true;
