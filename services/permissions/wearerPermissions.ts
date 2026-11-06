import type { PermissionStatus, WearerPermission } from './types';

/**
 * B2 permissions, web version. Wearer screens are phone only, so on web nothing can be granted.
 * The phone uses wearerPermissions.native.ts.
 */
export { WEARER_PERMISSIONS, type PermissionStatus, type WearerPermission } from './types';

export const getWearerPermission = async (_p: WearerPermission): Promise<PermissionStatus> => 'denied';
export const requestWearerPermission = async (_p: WearerPermission): Promise<PermissionStatus> => 'denied';
export const openAppSettings = async (): Promise<void> => undefined;
/** Battery exemption is an Android setting. Recommended, never required. */
export const canAskBatteryExemption = false;
export const openBatterySettings = async (): Promise<void> => undefined;
/** A browser cannot give Bluetooth, "always" location or push to the pendant. The screen lets people continue; they allow these later on the phone. */
export const canGrantPermissions = false;
